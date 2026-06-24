import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRESETS, computeGrid, computeSpeedMultiplier } from '../engine';
import type {
  ActiveEffect,
  Cell,
  Direction,
  GameState,
  ModeId,
  PowerupKind,
  Preset,
  PresetId,
  WallBehavior,
} from '../engine/types';
import { MODES } from '../modes';
import type { Mode } from '../modes/Mode';
import {
  createGameController,
  type TerminalPayload,
} from '../runtime/GameController';
import { useGameLoop } from '../runtime/useGameLoop';
import { useAppStatePause } from '../runtime/useAppStatePause';
import { useCountdown } from '../runtime/useCountdown';
import { Board } from '../render/Board';
import { DynamicLayer } from '../render/DynamicLayer';
import { WorldBoard } from '../render/WorldBoard';
import { WorldDynamicLayer } from '../render/WorldDynamicLayer';
import { GpsArrow } from '../render/GpsArrow';
import { computeViewport } from '../render/camera';
import { SwipeInput } from '../input/SwipeInput';
import { DpadInput } from '../input/DpadInput';
import { createMathRandom, type RandomPort } from '../services/RandomPort';
import { createExpoHaptics, type HapticsPort } from '../services/HapticsPort';
import { createSilentSound, type SoundPort } from '../services/SoundPort';
import {
  createScoreSubmitter,
  type ScoreSubmitter,
} from '../services/submitScoreOnTerminal';
import { createInMemoryAuth } from '../services/AuthPort';
import { createInMemoryLeaderboard } from '../services/LeaderboardPort';
import { useSettingsStore } from '../state/useSettingsStore';
import { useScoresStore } from '../state/useScoresStore';
import { useSkin } from '../skins/SkinProvider';
import { PauseOverlay } from './PauseOverlay';
import { ActiveEffectsHud } from './ActiveEffectsHud';
import { PickupBanner } from './PickupBanner';

const SCORE_BAR_HEIGHT = 64;
const COUNTDOWN_SECONDS = 3;

/** Minimal projection of the authoritative state — only what the UI needs. */
interface Projection {
  status: GameState['status'];
  snake: Cell[];
  food: Cell | null;
  bonusFood: Cell | null;
  /** Kind of the pickup in bonusFood (POINTS for the classic bonus). */
  powerupKind: PowerupKind;
  /** Timed powerups in effect, each counting down. */
  activeEffects: ActiveEffect[];
  /** Kind eaten this tick, for the one-shot banner (null when none). */
  pickupBanner: PowerupKind | null;
  obstacles: Cell[];
  /** Cells smashed by WALL_BUSTER this tick, for the destruction burst. */
  bustedCells: Cell[];
  score: number;
  /** Current tick interval (ms); drives the snake's sub-tick glide duration. */
  tickMs: number;
}

const toProjection = (s: GameState): Projection => ({
  status: s.status,
  snake: s.snake,
  food: s.food,
  bonusFood: s.bonusFood,
  powerupKind: s.powerupKind ?? 'POINTS',
  activeEffects: s.activeEffects ?? [],
  pickupBanner: s.pickupBanner ?? null,
  obstacles: s.obstacles,
  bustedCells: s.bustedCells ?? [],
  score: s.score,
  tickMs: s.tickMs,
});

export interface GameScreenProps {
  /** Dependency-injection seams; default to production implementations. */
  mode?: Mode;
  rng?: RandomPort;
  haptics?: HapticsPort;
  sound?: SoundPort;
  /** Offline-safe leaderboard submitter; defaults to a local-only no-op. */
  submitter?: ScoreSubmitter;
}

/**
 * The central integration: composes engine + controller + loop + lifecycle +
 * rendering + input. The authoritative game state lives in the controller; only
 * a minimal Projection is kept in React state and pushed via onState. All side
 * effects go through injected ports/stores. Nothing here reimplements engine,
 * loop, or render logic. (central integration)
 */
export function GameScreen(props: GameScreenProps = {}) {
  const router = useRouter();
  // Hold the router in a ref so callbacks stay identity-stable even if useRouter
  // returns a fresh object each render (avoids recreating the controller).
  const routerRef = useRef(router);
  routerRef.current = router;
  const skin = useSkin();
  const params = useLocalSearchParams<{
    presetId?: string;
    wall?: string;
    modeId?: string;
  }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const storePreset = useSettingsStore((s) => s.presetId);
  const storeWall = useSettingsStore((s) => s.wallBehavior);
  const storeMode = useSettingsStore((s) => s.modeId);
  const controlScheme = useSettingsStore((s) => s.controlScheme);

  // Prefer route params, fall back to the settings store.
  const presetId: PresetId =
    params.presetId && params.presetId in PRESETS
      ? (params.presetId as PresetId)
      : storePreset;
  const preset: Preset = PRESETS[presetId];
  const wall: WallBehavior =
    params.wall === 'SOLID' || params.wall === 'PORTAL'
      ? params.wall
      : storeWall;
  const modeId: ModeId =
    params.modeId === 'CLASSIC' ||
    params.modeId === 'DYNAMIC_WALLS' ||
    params.modeId === 'GPS'
      ? params.modeId
      : storeMode;

  // Route through the selected mode (props.mode wins for tests/DI).
  const mode = props.mode ?? MODES[modeId];
  const rng = useMemo(() => props.rng ?? createMathRandom(), [props.rng]);
  const haptics = useMemo(() => props.haptics ?? createExpoHaptics(), [props.haptics]);
  const sound = useMemo(() => props.sound ?? createSilentSound(), [props.sound]);
  // Local-only by default (in-memory auth has no user => submit no-ops). The
  // real Firebase-backed submitter is injected once auth is wired (step 45+).
  const submitter = useMemo(
    () =>
      props.submitter ??
      createScoreSubmitter({
        auth: createInMemoryAuth(),
        leaderboard: createInMemoryLeaderboard(),
      }),
    [props.submitter],
  );

  // Grid recomputes on dimension/safe-area/preset change (foldables, EH).
  const grid = useMemo(() => {
    const playAreaHeight = Math.max(
      0,
      height - insets.top - insets.bottom - SCORE_BAR_HEIGHT,
    );
    return computeGrid(width, playAreaHeight, preset.targetColumns);
  }, [width, height, insets.top, insets.bottom, preset.targetColumns]);

  const config = useMemo(
    () => mode.buildConfig(grid, wall, preset),
    [mode, grid, wall, preset],
  );

  const [projection, setProjection] = useState<Projection>(() => ({
    status: 'TAP_TO_START',
    snake: [],
    food: null,
    bonusFood: null,
    powerupKind: 'POINTS',
    activeEffects: [],
    pickupBanner: null,
    obstacles: [],
    bustedCells: [],
    score: 0,
    tickMs: config.baseTickMs,
  }));

  const onTerminal = useCallback(
    (payload: TerminalPayload) => {
      const { state, score, isNewBest, foodEaten, length, elapsedMs } = payload;
      routerRef.current.replace({
        pathname: state.status === 'WON' ? '/win' : '/loss',
        params: {
          score: String(score),
          isNewBest: isNewBest ? '1' : '0',
          foodEaten: String(foodEaten),
          length: String(length),
          elapsedMs: String(elapsedMs),
          presetId,
          wall,
          modeId,
        },
      });

      // Fire-and-forget leaderboard submission AFTER local recordRun (done in
      // the controller) and the terminal navigation; never gates the UI path.
      submitter.submit({ modeId, wall }, score);
    },
    [presetId, wall, modeId, submitter],
  );

  // The controller owns authoritative state; recreate only when config changes.
  const controller = useMemo(
    () =>
      createGameController({
        mode,
        config,
        modeId,
        rng,
        haptics,
        sound,
        isHapticsEnabled: () => useSettingsStore.getState().hapticsEnabled,
        isSoundEnabled: () => useSettingsStore.getState().soundEnabled,
        recordRun: (m, w, score) =>
          useScoresStore.getState().recordRun(m, w, score),
        onState: (state) => setProjection(toProjection(state)),
        onTerminal,
      }),
    [mode, config, modeId, rng, haptics, sound, onTerminal],
  );

  // Seed the projection from the freshly created controller's initial state.
  useEffect(() => {
    setProjection(toProjection(controller.getState()));
  }, [controller]);

  const isRunning = projection.status === 'RUNNING';
  useGameLoop(controller, isRunning);
  useAppStatePause(controller);
  const { remaining } = useCountdown({
    active: projection.status === 'COUNTDOWN',
    seconds: COUNTDOWN_SECONDS,
    onComplete: controller.setRunning,
  });

  // Android hardware back: never silently forfeit — pause and show the overlay
  // instead of popping the stack. (EH-11)
  useEffect(() => {
    const onBack = (): boolean => {
      const status = controller.getState().status;
      if (status === 'RUNNING') {
        controller.pause();
        return true;
      }
      if (status === 'PAUSED') {
        return true; // stay on the pause overlay
      }
      return false; // nothing in progress — allow default back
    };
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBack,
    );
    return () => subscription.remove();
  }, [controller]);

  const onSwipe = useCallback(
    (dir: Direction) => controller.enqueue(dir),
    [controller],
  );

  const {
    status,
    snake,
    food,
    bonusFood,
    powerupKind,
    activeEffects,
    pickupBanner,
    obstacles,
    bustedCells,
    score,
    tickMs,
  } = projection;
  // Player-facing speed, relative to this preset's starting pace (1.0× → cap).
  const speedMultiplier = computeSpeedMultiplier(config.baseTickMs, tickMs);

  // GPS render path: a camera window of the world that follows the snake's head.
  const world = config.world;
  const gridOrigin = { x: grid.originX, y: grid.originY };
  const head = snake[0] ?? { x: 0, y: 0 };
  const viewport =
    world !== undefined
      ? computeViewport(head, world, grid.columns, grid.rows)
      : null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: skin.background, paddingTop: insets.top },
      ]}
    >
      <View style={[styles.hud, { height: SCORE_BAR_HEIGHT }]}>
        <Text testID="score-hud" style={[styles.score, { color: skin.snakeHead }]}>
          {score}
        </Text>
        <Text
          testID="speed-hud"
          accessibilityLabel={`Speed ${speedMultiplier.toFixed(1)} times`}
          style={[styles.speed, { color: skin.snakeBody }]}
        >
          {speedMultiplier.toFixed(1)}×
        </Text>
        <Pressable
          testID="pause-button"
          accessibilityRole="button"
          accessibilityLabel="Pause"
          onPress={() => controller.pause()}
          style={styles.pauseButton}
        >
          <Text style={styles.pauseGlyph}>❚❚</Text>
        </Pressable>
      </View>

      {/* Countdown bars for active timed powerups, just under the score bar. */}
      <ActiveEffectsHud effects={activeEffects} />

      <View testID="game-board" style={styles.board}>
        {viewport !== null && world !== undefined ? (
          <>
            <WorldBoard
              viewport={viewport}
              cellSize={world.cellSize}
              gridOrigin={gridOrigin}
            />
            <WorldDynamicLayer
              viewport={viewport}
              world={world}
              cellSize={world.cellSize}
              gridOrigin={gridOrigin}
              snake={snake}
              food={food}
              bonusFood={bonusFood}
              powerupKind={powerupKind}
              obstacles={obstacles}
              bustedCells={bustedCells}
              pickupBanner={pickupBanner}
              tickMs={tickMs}
            />
            <GpsArrow head={head} food={food} viewport={viewport} />
          </>
        ) : (
          <>
            <Board gridSpec={grid} />
            <DynamicLayer
              gridSpec={grid}
              snake={snake}
              food={food}
              tickMs={tickMs}
              bonusFood={bonusFood}
              powerupKind={powerupKind}
              obstacles={obstacles}
              bustedCells={bustedCells}
              pickupBanner={pickupBanner}
            />
          </>
        )}
        {controlScheme === 'SWIPE' && <SwipeInput onDirection={onSwipe} />}

        {/* Flashes "what it does" when a powerup is grabbed. */}
        <PickupBanner pickup={pickupBanner} />

        {status === 'TAP_TO_START' && (
          <Pressable
            testID="tap-to-start-overlay"
            style={styles.overlay}
            onPress={() => controller.tapToStart()}
          >
            <Text style={[styles.overlayTitle, { color: skin.snakeHead }]}>
              Tap to start
            </Text>
          </Pressable>
        )}

        {status === 'COUNTDOWN' && (
          <View testID="countdown-overlay" style={styles.overlay} pointerEvents="none">
            <Text
              testID="countdown-number"
              style={[styles.countdown, { color: skin.snakeHead }]}
            >
              {remaining}
            </Text>
          </View>
        )}

        {status === 'PAUSED' && (
          <PauseOverlay
            controller={controller}
            onQuitToHome={() => routerRef.current.replace('/')}
          />
        )}
      </View>

      {/* D-pad lives in the chrome below the board, never over the grid. */}
      {controlScheme === 'DPAD' && (
        <View
          style={[styles.dpadChrome, { paddingBottom: insets.bottom + 12 }]}
        >
          <DpadInput onDirection={onSwipe} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dpadChrome: { alignItems: 'center', paddingTop: 8 },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  score: { fontSize: 28, fontWeight: '800' },
  speed: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pauseButton: { padding: 8 },
  pauseGlyph: { color: '#fff', fontSize: 20 },
  board: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  overlayTitle: { fontSize: 32, fontWeight: '700' },
  countdown: { fontSize: 96, fontWeight: '800' },
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
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
import { computeViewport, worldToScreen } from '../render/camera';
import { DpadInput } from '../input/DpadInput';
import { AnalogInput } from '../input/AnalogInput';
import { createMathRandom, type RandomPort } from '../services/RandomPort';
import { createExpoHaptics, type HapticsPort } from '../services/HapticsPort';
import type { SoundPort } from '../services/SoundPort';
import { appSound } from '../services/soundInstance';
import {
  createScoreSubmitter,
  type ScoreSubmitter,
} from '../services/submitScoreOnTerminal';
import { appAuth } from '../services/authInstance';
import { appLeaderboard } from '../services/leaderboardInstance';
import { useSettingsStore } from '../state/useSettingsStore';
import { useScoresStore } from '../state/useScoresStore';
import { useEntitlementsStore } from '../state/useEntitlementsStore';
import { useInterstitialGate, useRevive } from '../monetization';
import { useSkin } from '../skins/SkinProvider';
import { GlowButton, IconButton, useReducedMotion, useTheme } from '../ui';
import { PauseOverlay } from './PauseOverlay';
import { ActiveEffectsHud } from './ActiveEffectsHud';
import { PickupBanner } from './PickupBanner';
import { SpeedGauge } from './SpeedGauge';

const SCORE_BAR_HEIGHT = 64;
const COUNTDOWN_SECONDS = 3;
// Vertical space the on-screen D-pad chrome occupies below the board (beyond the
// bottom safe-area inset), reserved so the grid never renders behind it. Matches
// the D-pad: 3 rows of 72px buttons + 10px gaps + chrome padding.
const DPAD_RESERVED_HEIGHT = 256;

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
  /** Ticks left before the on-board pickup despawns (0 when none present). */
  bonusRemaining: number;
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
  bonusRemaining: s.bonusRemaining,
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
  const { ui, type } = useTheme();
  const reducedMotion = useReducedMotion();
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
  // The app-wide sound singleton (real SFX once the audio pipeline lands).
  const sound = useMemo(() => props.sound ?? appSound, [props.sound]);
  // Submit through the APP singletons so the shared identity that signed in on
  // the Account screen is the one whose scores land on the leaderboard.
  const submitter = useMemo(
    () =>
      props.submitter ??
      createScoreSubmitter({ auth: appAuth, leaderboard: appLeaderboard }),
    [props.submitter],
  );

  // Grid recomputes on dimension/safe-area/preset change (foldables, EH). When
  // the D-pad is on, reserve its chrome so the board fits ABOVE it (no overlap).
  const grid = useMemo(() => {
    const dpadReserved = controlScheme === 'DPAD' ? DPAD_RESERVED_HEIGHT : 0;
    const playAreaHeight = Math.max(
      0,
      height - insets.top - insets.bottom - SCORE_BAR_HEIGHT - dpadReserved,
    );
    return computeGrid(width, playAreaHeight, preset.targetColumns);
  }, [
    width,
    height,
    insets.top,
    insets.bottom,
    preset.targetColumns,
    controlScheme,
  ]);

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
    bonusRemaining: 0,
    score: 0,
    tickMs: config.baseTickMs,
  }));

  // Revive flow (monetization): one offer per run; the gate lives in a ref so
  // onTerminal stays referentially stable for the controller memo.
  const [lossOffer, setLossOffer] = useState<TerminalPayload | null>(null);
  const { maybeShowAfterGameOver } = useInterstitialGate();
  const premium = useEntitlementsStore((s) => s.premium);
  const canReviveRef = useRef(true);

  const navigateTerminal = useCallback(
    (payload: TerminalPayload) => {
      const { state, score, isNewBest, foodEaten, length, elapsedMs } = payload;
      const lost = state.status !== 'WON';
      routerRef.current.replace({
        pathname: lost ? '/loss' : '/win',
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

      // Interstitial cadence: losses only, every 3rd, 90s-capped, never for
      // premium — all encapsulated in the gate. Fired after navigation.
      if (lost) {
        void maybeShowAfterGameOver();
      }
    },
    [presetId, wall, modeId, submitter, maybeShowAfterGameOver],
  );
  const navigateTerminalRef = useRef(navigateTerminal);
  navigateTerminalRef.current = navigateTerminal;

  const onTerminal = useCallback((payload: TerminalPayload) => {
    // A loss with the run's revive still available pauses the exit: offer it.
    // Wins, and losses after the revive is spent, go straight out.
    if (payload.state.status === 'LOST' && canReviveRef.current) {
      setLossOffer(payload);
      return;
    }
    navigateTerminalRef.current(payload);
  }, []);

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

  // Bumped on every in-place restart so the snake renderer snaps (no glide
  // streak from the old body) — threaded into DynamicLayer as resetKey.
  const [runKey, setRunKey] = useState(0);

  // One revive per run (keyed by runKey, so Restart re-arms it). Premium
  // revives instantly; free players watch a rewarded ad (mock-earns today).
  const { canRevive, offerRevive } = useRevive(runKey);
  canReviveRef.current = canRevive;
  const [reviving, setReviving] = useState(false);

  // Read via ref so decline stays stable AND the navigation side effect runs
  // outside the state updater (updaters must stay pure).
  const lossOfferRef = useRef<TerminalPayload | null>(null);
  lossOfferRef.current = lossOffer;
  const declineRevive = useCallback(() => {
    const payload = lossOfferRef.current;
    if (payload === null) {
      return;
    }
    setLossOffer(null);
    navigateTerminalRef.current(payload);
  }, []);

  const tryRevive = useCallback(async () => {
    if (reviving) {
      return;
    }
    setReviving(true);
    try {
      const earned = await offerRevive();
      if (!earned) {
        // Ad dismissed/unavailable — the offer survives; player may retry.
        return;
      }
      if (controller.revive()) {
        setRunKey((k) => k + 1); // snap the renderer to the shortened body
        setLossOffer(null);
      } else {
        // Engine says no safe cell (near-full grid) — proceed to the loss.
        declineRevive();
      }
    } finally {
      setReviving(false);
    }
  }, [reviving, offerRevive, declineRevive, controller]);

  // The offer self-expires so an away player isn't stuck on the overlay.
  useEffect(() => {
    if (lossOffer === null) {
      return undefined;
    }
    const timer = setTimeout(declineRevive, 9000);
    return () => clearTimeout(timer);
  }, [lossOffer, declineRevive]);

  // Screen-reader narration, guarded: a missing platform API must never crash
  // the run. Announces each countdown number, then "go".
  const announce = useCallback((message: string) => {
    try {
      AccessibilityInfo.announceForAccessibility(message);
    } catch {
      // No announcement support here — the visual countdown still shows.
    }
  }, []);

  useEffect(() => {
    if (projection.status === 'COUNTDOWN' && remaining > 0) {
      announce(String(remaining));
      if (useSettingsStore.getState().soundEnabled) {
        sound.play('COUNTDOWN_TICK');
      }
    }
  }, [projection.status, remaining, announce, sound]);

  // Flash "GO" for a beat as COUNTDOWN flips into RUNNING.
  const [showGo, setShowGo] = useState(false);
  const prevStatusRef = useRef(projection.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = projection.status;
    if (prev === 'COUNTDOWN' && projection.status === 'RUNNING') {
      announce('go');
      if (useSettingsStore.getState().soundEnabled) {
        sound.play('GO');
      }
      setShowGo(true);
      const timer = setTimeout(() => setShowGo(false), 650);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [projection.status, announce, sound]);

  // Gentle pulse on the tap-to-start hint (static under Reduce Motion).
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reducedMotion || projection.status !== 'TAP_TO_START') {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion, projection.status]);

  // HUD chip: the current board's best, live from the scores store.
  const bests = useScoresStore((s) => s.bests);
  const boardBest = bests[`${modeId}:${wall}`] ?? 0;
  const modeName =
    modeId === 'GPS'
      ? 'GPS'
      : modeId === 'DYNAMIC_WALLS'
        ? 'Dynamic Walls'
        : 'Classic';

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
    (dir: Direction) => {
      // Tactile tick on every direction input (d-pad press / joystick steer),
      // gated by the live haptics setting.
      if (useSettingsStore.getState().hapticsEnabled) {
        haptics.turn?.();
      }
      controller.enqueue(dir);
    },
    [controller, haptics],
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
    bonusRemaining,
    score,
    tickMs,
  } = projection;
  // Player-facing speed: a 0→1 fraction of the run's speed range (start → cap),
  // driving both the HUD gauge and the snake's speed glow.
  const maxMultiplier = computeSpeedMultiplier(config.baseTickMs, config.minTickMs);
  const speedMultiplier = computeSpeedMultiplier(config.baseTickMs, tickMs);
  const speedFraction =
    maxMultiplier > 1
      ? Math.max(0, Math.min(1, (speedMultiplier - 1) / (maxMultiplier - 1)))
      : 0;

  // GPS render path: a camera window of the world that follows the snake's head.
  const world = config.world;
  const gridOrigin = { x: grid.originX, y: grid.originY };
  const head = snake[0] ?? { x: 0, y: 0 };
  const viewport =
    world !== undefined
      ? computeViewport(head, world, grid.columns, grid.rows)
      : null;

  // Despawn counter for the pickup currently on the board: its pixel position
  // (centered above the cell) and the whole seconds left before it vanishes.
  // Shown for every kind while it sits on the grid. (pickup countdown)
  const pickupCounter = (() => {
    if (bonusFood === null || bonusRemaining <= 0) {
      return null;
    }
    const cellSize = world ? world.cellSize : grid.cellSize;
    let cx: number;
    let topY: number;
    if (viewport !== null && world !== undefined) {
      const p = worldToScreen(bonusFood, viewport, cellSize, gridOrigin);
      if (!p.onScreen) {
        return null;
      }
      cx = p.x + cellSize / 2;
      topY = p.y;
    } else {
      cx = grid.originX + bonusFood.x * cellSize + cellSize / 2;
      topY = grid.originY + bonusFood.y * cellSize;
    }
    const seconds = Math.max(1, Math.ceil((bonusRemaining * tickMs) / 1000));
    return { cx, topY, seconds };
  })();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: skin.background,
          paddingTop: insets.top,
          // computeGrid subtracts BOTH insets; when the D-pad chrome is up it
          // pads the bottom inset itself, otherwise the container must, so the
          // board view matches the grid math exactly. (layout consistency)
          paddingBottom: controlScheme === 'DPAD' ? 0 : insets.bottom,
        },
      ]}
    >
      <View style={[styles.hud, { height: SCORE_BAR_HEIGHT }]}>
        <View style={styles.scoreBlock}>
          <Text
            testID="score-hud"
            accessibilityLabel={`Score ${score}`}
            style={[type.score, { color: ui.textPrimary }]}
          >
            {score}
          </Text>
          <View
            testID="hud-mode-chip"
            style={[
              styles.modeChip,
              { borderColor: ui.border, backgroundColor: ui.surfaceRaised },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.modeChipText, { color: ui.textSecondary }]}
            >
              {modeName} · Best {boardBest}
            </Text>
          </View>
        </View>
        <SpeedGauge fraction={speedFraction} coolColor={skin.snakeHead} />
        <IconButton
          testID="pause-button"
          icon="pause"
          accessibilityLabel="Pause"
          color={ui.textPrimary}
          onPress={() => controller.pause()}
        />
      </View>

      <View testID="game-board" style={styles.board}>
        {viewport !== null && world !== undefined ? (
          <>
            <WorldBoard
              viewport={viewport}
              cellSize={world.cellSize}
              gridOrigin={gridOrigin}
              wall={wall}
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
              glow={speedFraction}
            />
            <GpsArrow head={head} food={food} viewport={viewport} />
          </>
        ) : (
          <>
            <Board gridSpec={grid} wall={wall} />
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
              glow={speedFraction}
              resetKey={runKey}
            />
          </>
        )}
        {/* Regular touch control: an invisible joystick (steer by holding/dragging). */}
        {controlScheme === 'SWIPE' && (
          <AnalogInput onDirection={onSwipe} showStick={false} />
        )}
        {controlScheme === 'ANALOG' && <AnalogInput onDirection={onSwipe} />}

        {/* Active-effect countdown bars: an overlay, so they never reflow the
            board (which would resize/shift the grid). */}
        <View style={styles.effectsOverlay} pointerEvents="none">
          <ActiveEffectsHud effects={activeEffects} />
        </View>

        {/* Despawn counter floating above the on-board pickup. */}
        {pickupCounter !== null && (
          <Text
            testID="pickup-timer"
            pointerEvents="none"
            style={[
              styles.pickupTimer,
              {
                left: pickupCounter.cx - 16,
                top: pickupCounter.topY - 16,
                color: skin.snakeHead,
              },
            ]}
          >
            {pickupCounter.seconds}
          </Text>
        )}

        {/* Flashes "what it does" when a powerup is grabbed. */}
        <PickupBanner pickup={pickupBanner} />

        {status === 'TAP_TO_START' && (
          <Pressable
            testID="tap-to-start-overlay"
            accessibilityRole="button"
            accessibilityLabel={`Tap to start. ${modeName} mode`}
            style={[styles.overlay, { backgroundColor: ui.scrim }]}
            onPress={() => controller.tapToStart()}
          >
            <Text
              style={[
                styles.overlayTitle,
                styles.glowText,
                { color: ui.accent, textShadowColor: ui.accent },
              ]}
            >
              TAP TO START
            </Text>
            <Animated.Text
              style={[
                styles.overlayHint,
                { color: ui.textSecondary, opacity: pulse },
              ]}
            >
              {modeName}
            </Animated.Text>
          </Pressable>
        )}

        {status === 'COUNTDOWN' && (
          <View
            testID="countdown-overlay"
            style={[styles.overlay, { backgroundColor: ui.scrim }]}
            pointerEvents="none"
          >
            <Text
              testID="countdown-number"
              style={[
                styles.countdown,
                styles.glowText,
                { color: ui.accent, textShadowColor: ui.accent },
              ]}
            >
              {remaining}
            </Text>
          </View>
        )}

        {showGo && (
          <View testID="go-overlay" style={styles.overlay} pointerEvents="none">
            <Text
              style={[
                styles.countdown,
                styles.glowText,
                { color: ui.accent, textShadowColor: ui.accent },
              ]}
            >
              GO
            </Text>
          </View>
        )}

        {status === 'PAUSED' && (
          <PauseOverlay
            controller={controller}
            onRestart={() => {
              setRunKey((k) => k + 1); // snap the renderer to the fresh body
              controller.restart();
            }}
            onQuitToHome={() => routerRef.current.replace('/')}
          />
        )}

        {lossOffer !== null && (
          <View
            testID="revive-overlay"
            accessibilityViewIsModal
            style={[styles.overlay, { backgroundColor: ui.scrim }]}
          >
            <View
              style={[
                styles.revivePanel,
                {
                  backgroundColor: ui.surfaceRaised,
                  borderColor: ui.border,
                },
              ]}
            >
              <Text
                accessibilityRole="header"
                style={[
                  styles.overlayTitle,
                  styles.glowText,
                  // Title-only display-font adoption (style edit, no logic).
                  type.display.fontFamily !== undefined && {
                    fontFamily: type.display.fontFamily,
                    fontWeight: '400' as const,
                  },
                  {
                    color: ui.danger,
                    textAlign: 'center',
                    textShadowColor: ui.danger,
                  },
                ]}
              >
                SNAKE DOWN
              </Text>
              <Text style={[styles.reviveScore, { color: ui.textPrimary }]}>
                Score {lossOffer.score}
              </Text>
              <Text style={[styles.reviveHint, { color: ui.textSecondary }]}>
                {premium
                  ? 'Coil Premium: revive instantly, once per run.'
                  : 'Watch a short ad to keep this run alive — once per run.'}
              </Text>
              <GlowButton
                testID="revive-accept"
                label={
                  reviving
                    ? 'Reviving…'
                    : premium
                      ? 'Revive'
                      : 'Watch ad & revive'
                }
                variant="primary"
                disabled={reviving}
                onPress={() => void tryRevive()}
              />
              <GlowButton
                testID="revive-decline"
                label="No thanks"
                variant="secondary"
                disabled={reviving}
                onPress={declineRevive}
              />
            </View>
          </View>
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
    gap: 12,
  },
  scoreBlock: { gap: 2, flexShrink: 1 },
  modeChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  modeChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  board: { flex: 1 },
  // Floats the active-effect chips over the top of the board so showing/hiding
  // them never changes the board's height (which would resize the grid).
  effectsOverlay: { position: 'absolute', top: 6, left: 0, right: 0 },
  pickupTimer: {
    position: 'absolute',
    width: 32,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 3,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  overlayTitle: { fontSize: 30, fontWeight: '900', letterSpacing: 4 },
  overlayHint: { fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  revivePanel: {
    alignItems: 'stretch',
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    marginHorizontal: 32,
    padding: 24,
  },
  reviveScore: {
    fontSize: 22,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    textAlign: 'center',
  },
  reviveHint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
    textAlign: 'center',
  },
  countdown: {
    fontSize: 104,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  glowText: {
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
});

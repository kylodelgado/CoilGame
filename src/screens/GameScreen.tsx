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
import { PRESETS, computeGrid } from '../engine';
import type {
  Cell,
  Direction,
  GameState,
  Preset,
  PresetId,
  WallBehavior,
} from '../engine/types';
import { classicMode } from '../modes/classicMode';
import type { Mode } from '../modes/Mode';
import { createGameController } from '../runtime/GameController';
import { useGameLoop } from '../runtime/useGameLoop';
import { useAppStatePause } from '../runtime/useAppStatePause';
import { useCountdown } from '../runtime/useCountdown';
import { Board } from '../render/Board';
import { DynamicLayer } from '../render/DynamicLayer';
import { SwipeInput } from '../input/SwipeInput';
import { createMathRandom, type RandomPort } from '../services/RandomPort';
import { createExpoHaptics, type HapticsPort } from '../services/HapticsPort';
import { createSilentSound, type SoundPort } from '../services/SoundPort';
import { useSettingsStore } from '../state/useSettingsStore';
import { useScoresStore } from '../state/useScoresStore';
import { useSkin } from '../skins/SkinProvider';
import { PauseOverlay } from './PauseOverlay';

const SCORE_BAR_HEIGHT = 64;
const COUNTDOWN_SECONDS = 3;

/** Minimal projection of the authoritative state — only what the UI needs. */
interface Projection {
  status: GameState['status'];
  snake: Cell[];
  food: Cell | null;
  bonusFood: Cell | null;
  score: number;
}

const toProjection = (s: GameState): Projection => ({
  status: s.status,
  snake: s.snake,
  food: s.food,
  bonusFood: s.bonusFood,
  score: s.score,
});

export interface GameScreenProps {
  /** Dependency-injection seams; default to production implementations. */
  mode?: Mode;
  rng?: RandomPort;
  haptics?: HapticsPort;
  sound?: SoundPort;
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
  const params = useLocalSearchParams<{ presetId?: string; wall?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const storePreset = useSettingsStore((s) => s.presetId);
  const storeWall = useSettingsStore((s) => s.wallBehavior);

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

  const mode = props.mode ?? classicMode;
  const rng = useMemo(() => props.rng ?? createMathRandom(), [props.rng]);
  const haptics = useMemo(() => props.haptics ?? createExpoHaptics(), [props.haptics]);
  const sound = useMemo(() => props.sound ?? createSilentSound(), [props.sound]);

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
    score: 0,
  }));

  const onTerminal = useCallback(
    (state: GameState, isNewBest: boolean) => {
      routerRef.current.replace({
        pathname: state.status === 'WON' ? '/win' : '/loss',
        params: {
          score: String(state.score),
          isNewBest: isNewBest ? '1' : '0',
          presetId,
          wall,
        },
      });
    },
    [presetId, wall],
  );

  // The controller owns authoritative state; recreate only when config changes.
  const controller = useMemo(
    () =>
      createGameController({
        mode,
        config,
        rng,
        haptics,
        sound,
        isHapticsEnabled: () => useSettingsStore.getState().hapticsEnabled,
        isSoundEnabled: () => useSettingsStore.getState().soundEnabled,
        recordRun: (w, score) => useScoresStore.getState().recordRun(w, score),
        onState: (state) => setProjection(toProjection(state)),
        onTerminal,
      }),
    [mode, config, rng, haptics, sound, onTerminal],
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

  const { status, snake, food, bonusFood, score } = projection;

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

      <View testID="game-board" style={styles.board}>
        <Board gridSpec={grid} />
        <DynamicLayer
          gridSpec={grid}
          snake={snake}
          food={food}
          bonusFood={bonusFood}
        />
        <SwipeInput onDirection={onSwipe} />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  score: { fontSize: 28, fontWeight: '800' },
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

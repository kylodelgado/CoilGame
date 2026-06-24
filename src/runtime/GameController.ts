import { enqueueDirection } from '../engine';
import type {
  Direction,
  GameConfig,
  GameState,
  ModeId,
  WallBehavior,
} from '../engine/types';
import type { Mode } from '../modes/Mode';
import type { HapticsPort } from '../services/HapticsPort';
import type { RandomPort } from '../services/RandomPort';
import type { SoundPort } from '../services/SoundPort';

/**
 * The end-of-run payload handed to onTerminal. Beyond score/isNewBest it carries
 * the extended stats shown on the Win/Loss screens: snake length, food eaten,
 * and time survived (only the RUNNING portion, paused time excluded). (Prompt 37)
 */
export interface TerminalPayload {
  state: GameState;
  score: number;
  isNewBest: boolean;
  foodEaten: number;
  length: number;
  elapsedMs: number;
}

export interface GameControllerDeps {
  mode: Mode;
  config: GameConfig;
  /** The active mode's id; scores are recorded under this mode×wall board. */
  modeId: ModeId;
  rng: RandomPort;
  haptics: HapticsPort;
  sound: SoundPort;
  /** Reads the live settings store. */
  isHapticsEnabled: () => boolean;
  /** Reads the live settings store. Reserved for Phase 2 SFX gating. */
  isSoundEnabled: () => boolean;
  /**
   * Monotonic clock (ms) for run-time tracking. Injected so tests are
   * deterministic; defaults to Date.now in production.
   */
  clock?: () => number;
  /** Scores store entry point; called on a completed run only. */
  recordRun: (
    modeId: ModeId,
    wall: WallBehavior,
    score: number,
  ) => { isNewBest: boolean };
  /** Notify the renderer/UI of a new authoritative state. */
  onState: (state: GameState) => void;
  /** WON or LOST reached this step. */
  onTerminal: (payload: TerminalPayload) => void;
}

export interface GameController {
  getState(): GameState;
  tapToStart(): void;
  setRunning(): void;
  enqueue(dir: Direction): void;
  step(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  quit(): void;
}

/**
 * Owns authoritative game state in a closure variable (never React state, to
 * avoid per-tick re-renders), routes lifecycle/input transitions, and dispatches
 * engine events to the injected services and stores — haptics gated by the
 * settings toggle. The screen drives step() on a timer and reads new state via
 * onState. (runtime glue)
 */
export function createGameController(deps: GameControllerDeps): GameController {
  const {
    mode,
    config,
    modeId,
    rng,
    haptics,
    sound,
    isHapticsEnabled,
    clock = Date.now,
    recordRun,
    onState,
    onTerminal,
  } = deps;

  // The authoritative state ref.
  let state: GameState = mode.createInitialState(config, rng);
  let forfeited = false;

  // Run-time tracking: accumulate only the RUNNING segments. runStartedAt is the
  // clock reading at the last RUNNING entry, or null while not running.
  let accumulatedMs = 0;
  let runStartedAt: number | null = null;

  // Fold the segment ending now into the accumulator (called on pause/terminal).
  const closeRunSegment = (): void => {
    if (runStartedAt !== null) {
      accumulatedMs += clock() - runStartedAt;
      runStartedAt = null;
    }
  };

  // Returns whether the transition fired, so callers can hook the time tracker.
  const transition = (
    status: GameState['status'],
    from: GameState['status'],
  ): boolean => {
    if (state.status !== from) {
      return false;
    }
    state = { ...state, status };
    onState(state);
    return true;
  };

  return {
    getState(): GameState {
      return state;
    },

    tapToStart(): void {
      transition('COUNTDOWN', 'TAP_TO_START');
    },

    setRunning(): void {
      // Each RUNNING entry (initial start and every resume) restarts the clock.
      if (transition('RUNNING', 'COUNTDOWN')) {
        runStartedAt = clock();
      }
    },

    enqueue(dir: Direction): void {
      if (state.status !== 'RUNNING') {
        return;
      }
      state = enqueueDirection(state, dir);
    },

    step(): void {
      if (forfeited || state.status !== 'RUNNING') {
        return;
      }

      const result = mode.tick(state, config, rng);
      state = result.state;
      onState(state);

      for (const event of result.events) {
        switch (event) {
          case 'ATE_FOOD':
            if (isHapticsEnabled()) {
              haptics.eat();
            }
            sound.play('ATE_FOOD');
            break;
          case 'ATE_BONUS':
            // Reuse the eat haptic; sound is out of scope this phase.
            if (isHapticsEnabled()) {
              haptics.eat();
            }
            break;
          case 'BONUS_EXPIRED':
            // No side effect — the bonus simply despawned.
            break;
          case 'GOT_POWERUP':
            // A powerup was grabbed — reuse the eat haptic for tactile feedback.
            if (isHapticsEnabled()) {
              haptics.eat();
            }
            break;
          case 'EFFECT_EXPIRED':
            // A timed effect ended; no haptic/sound this phase.
            break;
          case 'DIED':
            if (isHapticsEnabled()) {
              haptics.death();
            }
            sound.play('DIED');
            break;
          case 'WON':
            sound.play('WON');
            break;
        }
      }

      if (state.status === 'WON' || state.status === 'LOST') {
        closeRunSegment();
        const { isNewBest } = recordRun(modeId, config.wallBehavior, state.score);
        onTerminal({
          state,
          score: state.score,
          isNewBest,
          foodEaten: state.foodEaten,
          length: state.snake.length,
          elapsedMs: accumulatedMs,
        });
      }
    },

    pause(): void {
      // Stop the run clock while paused so paused time is excluded.
      if (transition('PAUSED', 'RUNNING')) {
        closeRunSegment();
      }
    },

    resume(): void {
      transition('COUNTDOWN', 'PAUSED');
    },

    restart(): void {
      forfeited = false;
      accumulatedMs = 0;
      runStartedAt = null;
      state = mode.createInitialState(config, rng);
      onState(state);
    },

    quit(): void {
      // Mark forfeited and stop advancing. Navigation is the screen's job;
      // crucially, a forfeit must never record a score. (FR-P6)
      forfeited = true;
    },
  };
}

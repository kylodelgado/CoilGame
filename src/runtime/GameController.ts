import { enqueueDirection } from '../engine';
import type {
  Direction,
  GameConfig,
  GameState,
  WallBehavior,
} from '../engine/types';
import type { Mode } from '../modes/Mode';
import type { HapticsPort } from '../services/HapticsPort';
import type { RandomPort } from '../services/RandomPort';
import type { SoundPort } from '../services/SoundPort';

export interface GameControllerDeps {
  mode: Mode;
  config: GameConfig;
  rng: RandomPort;
  haptics: HapticsPort;
  sound: SoundPort;
  /** Reads the live settings store. */
  isHapticsEnabled: () => boolean;
  /** Reads the live settings store. Reserved for Phase 2 SFX gating. */
  isSoundEnabled: () => boolean;
  /** Scores store entry point; called on a completed run only. */
  recordRun: (wall: WallBehavior, score: number) => { isNewBest: boolean };
  /** Notify the renderer/UI of a new authoritative state. */
  onState: (state: GameState) => void;
  /** WON or LOST reached this step. */
  onTerminal: (state: GameState, isNewBest: boolean) => void;
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
    rng,
    haptics,
    sound,
    isHapticsEnabled,
    recordRun,
    onState,
    onTerminal,
  } = deps;

  // The authoritative state ref.
  let state: GameState = mode.createInitialState(config, rng);
  let forfeited = false;

  const transition = (status: GameState['status'], from: GameState['status']) => {
    if (state.status !== from) {
      return;
    }
    state = { ...state, status };
    onState(state);
  };

  return {
    getState(): GameState {
      return state;
    },

    tapToStart(): void {
      transition('COUNTDOWN', 'TAP_TO_START');
    },

    setRunning(): void {
      transition('RUNNING', 'COUNTDOWN');
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
        const { isNewBest } = recordRun(config.wallBehavior, state.score);
        onTerminal(state, isNewBest);
      }
    },

    pause(): void {
      transition('PAUSED', 'RUNNING');
    },

    resume(): void {
      transition('COUNTDOWN', 'PAUSED');
    },

    restart(): void {
      forfeited = false;
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

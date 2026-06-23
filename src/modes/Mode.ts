import type { RandomPort } from '../services/RandomPort';
import type {
  GameConfig,
  GameState,
  GridSpec,
  Preset,
  TickResult,
  WallBehavior,
} from '../engine/types';

/**
 * The mode seam: the runtime's single entry point to game rules. A Mode
 * assembles a GameConfig and delegates state creation and stepping to the pure
 * engine. Wall behavior is part of the config, not a separate mode.
 */
export interface Mode {
  id: string;
  buildConfig(grid: GridSpec, wall: WallBehavior, preset: Preset): GameConfig;
  createInitialState(config: GameConfig, rng: RandomPort): GameState;
  tick(state: GameState, config: GameConfig, rng: RandomPort): TickResult;
}

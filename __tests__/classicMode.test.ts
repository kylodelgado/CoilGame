import { classicMode } from '../src/modes/classicMode';
import {
  createInitialState as engineCreateInitialState,
  tick as engineTick,
  PRESETS,
  POINTS_PER_FOOD,
  START_LENGTH,
  START_DIRECTION,
} from '../src/engine';
import { createSeededRandom } from '../src/services/RandomPort';
import type {
  GameConfig,
  GridSpec,
  PresetId,
  WallBehavior,
} from '../src/engine/types';

const grid: GridSpec = {
  columns: 12,
  rows: 16,
  cellSize: 20,
  originX: 4,
  originY: 8,
};

describe('classicMode (mode seam)', () => {
  it('has id CLASSIC', () => {
    expect(classicMode.id).toBe('CLASSIC');
  });

  const presetIds: PresetId[] = ['CLASSIC', 'STANDARD', 'DENSE'];
  const walls: WallBehavior[] = ['SOLID', 'PORTAL'];

  it.each(presetIds)('buildConfig maps %s tunables and wall correctly', (id) => {
    const preset = PRESETS[id];
    for (const wall of walls) {
      const config = classicMode.buildConfig(grid, wall, preset);
      // Powerups are enabled in every mode; compare the rest against the mapping.
      const { powerups, ...rest } = config;
      const expected: Omit<GameConfig, 'powerups'> = {
        grid,
        wallBehavior: wall,
        baseTickMs: preset.baseTickMs,
        minTickMs: preset.minTickMs,
        accelMsPerFood: preset.accelMsPerFood,
        pointsPerFood: POINTS_PER_FOOD,
        startLength: START_LENGTH,
        startDirection: START_DIRECTION,
        bonus: {
          enabled: true,
          spawnEveryTicks: 60,
          lifetimeTicks: 25,
          points: 50,
        },
      };
      expect(rest).toEqual(expected);
      expect(config.pointsPerFood).toBe(10);
      expect(config.startLength).toBe(3);
      expect(config.startDirection).toBe('RIGHT');
      // Classic has no obstacles, so WALL_BUSTER is gated out of its pool.
      expect(powerups?.pool).toBeDefined();
      expect(powerups?.pool).not.toContain('WALL_BUSTER');
    }
  });

  it('createInitialState delegates to the engine (identical result)', () => {
    const config = classicMode.buildConfig(grid, 'SOLID', PRESETS.STANDARD);
    const viaMode = classicMode.createInitialState(config, createSeededRandom(5));
    const viaEngine = engineCreateInitialState(config, createSeededRandom(5));
    expect(viaMode).toEqual(viaEngine);
  });

  it('tick delegates to the engine (identical result)', () => {
    const config = classicMode.buildConfig(grid, 'SOLID', PRESETS.STANDARD);
    const start = engineCreateInitialState(config, createSeededRandom(9));
    const running = { ...start, status: 'RUNNING' as const };

    const viaMode = classicMode.tick(running, config, createSeededRandom(1));
    const viaEngine = engineTick(running, config, createSeededRandom(1));
    expect(viaMode).toEqual(viaEngine);
  });
});

import {
  PRESETS,
  POINTS_PER_FOOD,
  START_LENGTH,
  START_DIRECTION,
} from '../src/engine/presets';
import type { PresetId } from '../src/engine/types';

const ALL_IDS: PresetId[] = ['CLASSIC', 'STANDARD', 'DENSE'];

describe('preset constants', () => {
  it('has an entry for every PresetId, keyed by its own id', () => {
    expect(Object.keys(PRESETS).sort()).toEqual([...ALL_IDS].sort());
    for (const id of ALL_IDS) {
      expect(PRESETS[id].id).toBe(id);
    }
  });

  it.each(ALL_IDS)('%s satisfies the tuning invariants', (id) => {
    const preset = PRESETS[id];
    expect(preset.minTickMs).toBeLessThan(preset.baseTickMs);
    expect(preset.accelMsPerFood).toBeGreaterThan(0);
    expect(preset.targetColumns).toBeGreaterThanOrEqual(6);
    expect(typeof preset.label).toBe('string');
    expect(preset.label.length).toBeGreaterThan(0);
  });

  it('uses the expected labels', () => {
    expect(PRESETS.CLASSIC.label).toBe('Classic');
    expect(PRESETS.STANDARD.label).toBe('Standard');
    expect(PRESETS.DENSE.label).toBe('Dense');
  });

  it('exposes the shared scoring/start constants', () => {
    expect(POINTS_PER_FOOD).toBe(10);
    expect(START_LENGTH).toBe(3);
    expect(START_DIRECTION).toBe('RIGHT');
  });
});

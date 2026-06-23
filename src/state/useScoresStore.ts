import { create } from 'zustand';
import type { ModeId, PersistedScores, WallBehavior } from '../engine/types';
import { DEFAULT_SCORES, type StoragePort } from '../services/StoragePort';

interface ScoresState {
  /** Best scores keyed by `${ModeId}:${WallBehavior}`. */
  bests: Record<string, number>;
  hydrated: boolean;

  hydrate(storage: StoragePort): Promise<void>;
  recordRun(
    modeId: ModeId,
    wall: WallBehavior,
    score: number,
  ): { isNewBest: boolean };
  getBest(modeId: ModeId, wall: WallBehavior): number;
  reset(storage: StoragePort): Promise<void>;
}

/** The StoragePort injected at hydrate time; recordRun persists through it. */
let storageRef: StoragePort | null = null;

/** Compose the per-board key used throughout the scores record. */
export const bestKey = (modeId: ModeId, wall: WallBehavior): string =>
  `${modeId}:${wall}`;

/**
 * High-scores store: a best per mode×wall board (keyed `${ModeId}:${WallBehavior}`)
 * that updates ONLY on completed runs (callers must not record forfeits/quits).
 * A new best updates in memory immediately and persists fire-and-forget; a
 * rejected write is swallowed and the in-memory value is kept. (FR-SC3/4, EH-3)
 */
export const useScoresStore = create<ScoresState>((set, get) => ({
  ...DEFAULT_SCORES,
  hydrated: false,

  async hydrate(storage: StoragePort): Promise<void> {
    storageRef = storage;
    const loaded = await storage.getScores();
    set({ bests: loaded.bests, hydrated: true });
  },

  recordRun(
    modeId: ModeId,
    wall: WallBehavior,
    score: number,
  ): { isNewBest: boolean } {
    const key = bestKey(modeId, wall);
    const best = get().bests[key] ?? 0;

    if (score <= best) {
      return { isNewBest: false };
    }

    const bests = { ...get().bests, [key]: score };
    set({ bests });
    const payload: PersistedScores = { bests };
    storageRef?.setScores(payload).catch(() => undefined);
    return { isNewBest: true };
  },

  getBest(modeId: ModeId, wall: WallBehavior): number {
    return get().bests[bestKey(modeId, wall)] ?? 0;
  },

  async reset(storage: StoragePort): Promise<void> {
    storageRef = storage;
    set({ bests: {} });
    await storage.resetScores();
  },
}));

import { create } from 'zustand';
import type { PersistedScores, WallBehavior } from '../engine/types';
import { DEFAULT_SCORES, type StoragePort } from '../services/StoragePort';

interface ScoresState {
  bestSolid: number;
  bestPortal: number;
  hydrated: boolean;

  hydrate(storage: StoragePort): Promise<void>;
  recordRun(wall: WallBehavior, score: number): { isNewBest: boolean };
  reset(storage: StoragePort): Promise<void>;
}

/** The StoragePort injected at hydrate time; recordRun persists through it. */
let storageRef: StoragePort | null = null;

function toPersisted(state: ScoresState): PersistedScores {
  return { bestSolid: state.bestSolid, bestPortal: state.bestPortal };
}

/**
 * High-scores store: separate Solid/Portal bests that update ONLY on completed
 * runs (callers must not record forfeits/quits). A new best updates in memory
 * immediately and persists fire-and-forget; a rejected write is swallowed and
 * the in-memory value is kept. (FR-SC3/4, §8.4, EH-3)
 */
export const useScoresStore = create<ScoresState>((set, get) => ({
  ...DEFAULT_SCORES,
  hydrated: false,

  async hydrate(storage: StoragePort): Promise<void> {
    storageRef = storage;
    const loaded = await storage.getScores();
    set({ ...loaded, hydrated: true });
  },

  recordRun(wall: WallBehavior, score: number): { isNewBest: boolean } {
    const state = get();
    const best = wall === 'SOLID' ? state.bestSolid : state.bestPortal;

    if (score <= best) {
      return { isNewBest: false };
    }

    set(wall === 'SOLID' ? { bestSolid: score } : { bestPortal: score });
    storageRef?.setScores(toPersisted(get())).catch(() => undefined);
    return { isNewBest: true };
  },

  async reset(storage: StoragePort): Promise<void> {
    storageRef = storage;
    set({ bestSolid: 0, bestPortal: 0 });
    await storage.resetScores();
  },
}));

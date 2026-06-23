import type { Skin } from './Skin';
import { greenOnBlack } from './greenOnBlack';
import { amberCrt } from './amberCrt';
import { monoLcd } from './monoLcd';
import { neon } from './neon';

/**
 * The skin registry: a single source of truth for which skins exist, used by the
 * settings validator and the selection UI. Renderers still read tokens via
 * useSkin, so adding skins here requires no renderer changes. (Prompt 31)
 */
export type SkinId = 'greenOnBlack' | 'amberCrt' | 'monoLcd' | 'neon';

export const SKIN_IDS: readonly SkinId[] = [
  'greenOnBlack',
  'amberCrt',
  'monoLcd',
  'neon',
];

export const SKINS: Record<SkinId, Skin> = {
  greenOnBlack,
  amberCrt,
  monoLcd,
  neon,
};

/**
 * Total lookup: an unknown id falls back to the default greenOnBlack so callers
 * never have to handle a missing skin.
 */
export function getSkin(id: SkinId): Skin {
  return SKINS[id] ?? greenOnBlack;
}

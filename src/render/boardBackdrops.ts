/**
 * Skin id → pre-rendered board backdrop asset. The backdrop is the Blender
 * ground render (pool of light and vignette baked in) that Board/WorldBoard
 * draw on top of the flat skin background. Kept as a standalone mapping so
 * per-skin backdrops swap in at exactly one place: the renderers only ask
 * "which asset for this skin id?" and treat null as "no backdrop image — use
 * the boardOrganic gradient fallback only". (boardBackdrop)
 */

// One Blender render per skin (art/skin_backdrops.py): the amber, LCD and
// neon floors are palette re-tints of the hand-tuned moss terrarium, so every
// skin's ground belongs to the same family.
const BACKDROPS: Record<string, number> = {
  greenOnBlack: require('../../assets/board/backdrop_greenOnBlack.webp'),
  amberCrt: require('../../assets/board/backdrop_amberCrt.webp'),
  monoLcd: require('../../assets/board/backdrop_monoLcd.webp'),
  neon: require('../../assets/board/backdrop_neon.webp'),
};

/**
 * The require()d asset id for a skin's backdrop image, or null when the skin
 * has none (unknown/custom ids). Callers gate on the skin's `boardBackdrop`
 * flag separately; null here means the organic gradient is the final look,
 * not just the decode-time stand-in.
 */
export function getBoardBackdropSource(skinId: string): number | null {
  return BACKDROPS[skinId] ?? null;
}

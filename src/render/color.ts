/**
 * Tiny hex-color helpers for deriving shades (tail tint, effect highlights) from
 * a skin's colors. Pure, JS-thread only (results are passed to Skia as color
 * strings). Accepts #rgb or #rrggbb. (snake texture/effects)
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

function parse(hex: string): Rgb {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }: Rgb): string {
  const h = (v: number) => clampByte(v).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Linear blend from a to b (both hex) at t in [0,1]. */
export function mix(a: string, b: string, t: string | number): string {
  const tt = typeof t === 'number' ? t : Number(t);
  const A = parse(a);
  const B = parse(b);
  return toHex({
    r: A.r + (B.r - A.r) * tt,
    g: A.g + (B.g - A.g) * tt,
    b: A.b + (B.b - A.b) * tt,
  });
}

/** Blend toward white by amt (0..1). */
export function lighten(hex: string, amt: number): string {
  return mix(hex, '#ffffff', amt);
}

/** Blend toward black by amt (0..1). */
export function darken(hex: string, amt: number): string {
  return mix(hex, '#000000', amt);
}

/** Same color as an rgba() string with the given alpha (0..1). */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

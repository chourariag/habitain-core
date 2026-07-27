/**
 * Contrast utilities — pick a legible text color for any given background.
 * Uses WCAG 2.1 relative luminance; returns the light/dark option with the
 * higher contrast ratio (guaranteed >= 4.5:1 when one of the pair is white
 * or near-black, for any typical brand color).
 */

type RGB = { r: number; g: number; b: number };

function clamp(n: number, lo = 0, hi = 255) {
  return Math.min(hi, Math.max(lo, n));
}

function parseHex(hex: string): RGB | null {
  const h = hex.replace("#", "").trim();
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length === 6 || h.length === 8) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return null;
}

function parseRgb(str: string): RGB | null {
  const m = str.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
  if (!m) return null;
  return { r: clamp(+m[1]), g: clamp(+m[2]), b: clamp(+m[3]) };
}

function parseHsl(str: string): RGB | null {
  const m = str.match(/hsla?\(\s*([\d.]+)(?:deg)?[ ,]+([\d.]+)%[ ,]+([\d.]+)%/i);
  if (!m) return null;
  const h = ((+m[1] % 360) + 360) % 360 / 360;
  const s = +m[2] / 100;
  const l = +m[3] / 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(h + 1 / 3) * 255),
    g: Math.round(hue2rgb(h) * 255),
    b: Math.round(hue2rgb(h - 1 / 3) * 255),
  };
}

/** Parse a CSS color string (hex, rgb/rgba, hsl/hsla) into RGB. */
export function parseColor(input: string): RGB | null {
  if (!input) return null;
  const s = input.trim();
  if (s.startsWith("#")) return parseHex(s);
  if (s.startsWith("rgb")) return parseRgb(s);
  if (s.startsWith("hsl")) return parseHsl(s);
  return null;
}

function channelLuminance(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(rgb: RGB): number {
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

/** Contrast ratio between two colors per WCAG 2.1. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Pick the option with the highest contrast against `background`.
 * Defaults to a near-black / white pair, which guarantees >= 4.5:1 for any
 * mid-tone brand color.
 */
export function readableTextColor(
  background: string,
  options: { dark?: string; light?: string } = {},
): string {
  const dark = options.dark ?? "#1A1A1A";
  const light = options.light ?? "#FFFFFF";
  const bg = parseColor(background);
  if (!bg) return dark;
  const darkRgb = parseColor(dark)!;
  const lightRgb = parseColor(light)!;
  return contrastRatio(bg, darkRgb) >= contrastRatio(bg, lightRgb) ? dark : light;
}

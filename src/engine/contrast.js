// WCAG 2.x contrast checks and automatic lightness correction in OKLCH.
// Pure functions, no browser or DOM dependencies.

import { hexToRgb, hexToOklch, oklchToHex, rgbToLinear } from './color.js';

/** WCAG AA thresholds. */
export const AA_TEXT = 4.5;
export const AA_UI = 3;

/** WCAG relative luminance of a hex color (0 = black, 1 = white). */
export function relativeLuminance(hex) {
  const { r, g, b } = rgbToLinear(hexToRgb(hex));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastRatio(hexA, hexB) {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Lowest contrast of `fg` against every color in `bgs`. */
export function minContrast(fg, bgs) {
  return Math.min(...bgs.map((bg) => contrastRatio(fg, bg)));
}

/** Rounds a ratio for display, e.g. 4.4999 -> 4.49 (never rounds up past a threshold). */
export function formatRatio(ratio) {
  return Math.floor(ratio * 100) / 100;
}

/**
 * Returns `fg` unchanged if it reaches `min` contrast against every
 * background. Otherwise moves its OKLCH lightness (keeping hue, and chroma
 * as far as the sRGB gamut allows) by the smallest amount that passes.
 *
 * @param {string} fg - Foreground hex color.
 * @param {string[]} bgs - Background hex colors it must contrast with.
 * @param {number} min - Required ratio (e.g. AA_TEXT).
 * @returns {{color: string, ratio: number, adjusted: boolean, resolved: boolean}}
 */
export function ensureContrast(fg, bgs, min) {
  const startRatio = minContrast(fg, bgs);
  if (startRatio >= min) return { color: fg, ratio: startRatio, adjusted: false, resolved: true };

  const { L: L0, C, h } = hexToOklch(fg);
  const at = (L) => oklchToHex({ L, C, h });
  const passes = (L) => minContrast(at(L), bgs) >= min;

  // Walk away from the start lightness in both directions and refine the
  // first passing step with bisection. Contrast is not monotonic when fg
  // sits between backgrounds, so a coarse walk is safer than pure bisection.
  const STEP = 0.01;
  const candidates = [];
  for (const dir of [1, -1]) {
    let prev = L0;
    for (let L = L0 + dir * STEP; L >= -STEP && L <= 1 + STEP; L += dir * STEP) {
      const Lc = Math.min(1, Math.max(0, L));
      if (passes(Lc)) {
        let lo = prev;
        let hi = Lc;
        for (let i = 0; i < 20; i++) {
          const mid = (lo + hi) / 2;
          if (passes(mid)) hi = mid;
          else lo = mid;
        }
        candidates.push(hi);
        break;
      }
      prev = Lc;
      if (Lc === 0 || Lc === 1) break;
    }
  }

  if (candidates.length === 0) {
    // Not reachable (e.g. backgrounds on both sides of fg): pick the best effort.
    const best = [0, 1].map((L) => ({ L, r: minContrast(at(L), bgs) })).sort((a, b) => b.r - a.r)[0];
    const color = at(best.L);
    return { color, ratio: best.r, adjusted: color !== fg, resolved: false };
  }

  candidates.sort((a, b) => Math.abs(a - L0) - Math.abs(b - L0));
  const color = at(candidates[0]);
  return { color, ratio: minContrast(color, bgs), adjusted: true, resolved: true };
}

/** Picks black-ish or white-ish text for a fill, whichever contrasts more. */
export function pickOnColor(fill, light = '#ffffff', dark = '#141414') {
  return contrastRatio(light, fill) >= contrastRatio(dark, fill) ? light : dark;
}

// Color conversions: hex <-> sRGB <-> linear RGB <-> OKLab <-> OKLCH.
// Pure functions, no browser or DOM dependencies.
// OKLab matrices from Björn Ottosson, https://bottosson.github.io/posts/oklab/

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** True if the string is a 3- or 6-digit hex color (with or without '#'). */
export function isHex(value) {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}

/** Normalizes a hex color to lowercase '#rrggbb'. Throws on invalid input. */
export function normalizeHex(value) {
  if (!isHex(value)) throw new TypeError(`Invalid hex color: ${value}`);
  let h = value.trim().replace('#', '').toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h}`;
}

/** '#rrggbb' -> {r, g, b} with channels in 0..1 (gamma-encoded sRGB). */
export function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** {r, g, b} in 0..1 -> '#rrggbb'. Channels are clamped. */
export function rgbToHex({ r, g, b }) {
  const to = (x) => Math.round(clamp01(x) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

// sRGB transfer function.
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function rgbToLinear({ r, g, b }) {
  return { r: toLinear(r), g: toLinear(g), b: toLinear(b) };
}

export function linearToRgb({ r, g, b }) {
  return { r: toGamma(r), g: toGamma(g), b: toGamma(b) };
}

/** Linear sRGB -> OKLab {L, a, b}. */
export function linearToOklab({ r, g, b }) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** OKLab {L, a, b} -> linear sRGB (may be out of gamut). */
export function oklabToLinear({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

export function oklabToOklch({ L, a, b }) {
  const C = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  // Hue is meaningless for near-neutral colors; report 0 for stability.
  return { L, C, h: C < 1e-4 ? 0 : h };
}

export function oklchToOklab({ L, C, h }) {
  const rad = (h * Math.PI) / 180;
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
}

/** '#rrggbb' -> OKLCH {L (0..1), C (0..~0.37), h (0..360)}. */
export function hexToOklch(hex) {
  return oklabToOklch(linearToOklab(rgbToLinear(hexToRgb(hex))));
}

/** '#rrggbb' -> OKLab. */
export function hexToOklab(hex) {
  return linearToOklab(rgbToLinear(hexToRgb(hex)));
}

const EPS = 1e-6;
const inGamutLinear = ({ r, g, b }) =>
  r >= -EPS && r <= 1 + EPS && g >= -EPS && g <= 1 + EPS && b >= -EPS && b <= 1 + EPS;

/** True if the OKLCH color can be shown in sRGB without clipping. */
export function isInGamut(lch) {
  return inGamutLinear(oklabToLinear(oklchToOklab(lch)));
}

/**
 * OKLCH -> '#rrggbb'. Out-of-gamut colors are mapped by reducing chroma
 * (keeping lightness and hue), which preserves perceived lightness better
 * than clipping each channel.
 */
export function oklchToHex({ L, C, h }) {
  const l = Math.min(1, Math.max(0, L));
  let c = Math.max(0, C);
  if (!isInGamut({ L: l, C: c, h })) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (isInGamut({ L: l, C: mid, h })) lo = mid;
      else hi = mid;
    }
    c = lo;
  }
  return rgbToHex(linearToRgb(oklabToLinear(oklchToOklab({ L: l, C: c, h }))));
}

/** '#rrggbb' -> HSL components {h (deg), s (%), l (%)}. */
export function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

/** Perceptual distance between two hex colors (Euclidean in OKLab). */
export function deltaOk(hexA, hexB) {
  const a = hexToOklab(hexA);
  const b = hexToOklab(hexB);
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

// Theme token generation: input colors -> full light and dark token sets.
// Works in OKLCH so lightness steps look even across hues.
// Pure functions, no browser or DOM dependencies.

import { hexToOklch, normalizeHex, oklchToHex } from './color.js';
import { AA_TEXT, AA_UI, contrastRatio, ensureContrast, pickOnColor } from './contrast.js';

/**
 * Every token a generated theme contains. Keep in sync with
 * themes/theme.schema.json ($defs.tokenSet); a test checks both match.
 */
export const TOKEN_NAMES = Object.freeze([
  'bg', // main page background
  'surfaceLow', // recessed areas (sidebar, page edges)
  'surface', // cards and panels
  'surfaceRaised', // composer and raised controls
  'popover', // menus, popovers, tooltips
  'text', // primary text
  'textSecondary', // secondary text
  'textMuted', // placeholders and metadata
  'accent', // accent fill (buttons, focus rings)
  'accentHover', // accent fill on hover
  'onAccent', // text and icons on top of accent fills
  'accentText', // accent used as text (links)
  'accentSoft', // subtle accent-tinted background
  'border', // decorative dividers (not contrast-checked, see docs)
  'borderStrong', // control borders, checked at 3:1
  'danger', // error text
  'success', // success text
  'warning', // warning text
]);

export const MODES = Object.freeze(['light', 'dark']);

// Lightness recipes per mode (OKLCH L, 0..1). Chosen to sit close to the
// spacing of claude.ai's own neutral scale so layouts keep their depth cues.
const RECIPE = {
  light: {
    surfaces: { surfaceLow: 0.955, bg: 0.975, surface: 0.99, surfaceRaised: 0.995, popover: 1 },
    tint: 0.35, // share of the base chroma used for surfaces
    maxTint: 0.03,
    text: { text: 0.24, textSecondary: 0.44, textMuted: 0.51 },
    border: 0.895,
    borderStrong: 0.64,
    accentSoft: 0.93,
    hoverShift: 0.05,
    states: { L: 0.5, C: 0.16 },
  },
  dark: {
    surfaces: { surfaceLow: 0.17, bg: 0.205, surface: 0.235, surfaceRaised: 0.26, popover: 0.3 },
    tint: 0.3,
    maxTint: 0.025,
    text: { text: 0.95, textSecondary: 0.79, textMuted: 0.68 },
    border: 0.32,
    borderStrong: 0.55,
    accentSoft: 0.3,
    hoverShift: 0.05,
    states: { L: 0.74, C: 0.14 },
  },
};

const STATE_HUES = { danger: 27, success: 150, warning: 75 };

/**
 * Generates both token sets from the input colors.
 *
 * @param {{base: string, accent: string}} inputs - Hex colors. `base` sets the
 *   hue and tint of backgrounds and text; `accent` drives interactive elements.
 * @returns {{light: Object<string,string>, dark: Object<string,string>, corrections: Array<Correction>}}
 *
 * @typedef {Object} Correction
 * @property {'light'|'dark'} mode
 * @property {string} token - Token that was adjusted.
 * @property {string[]} against - Tokens it was checked against.
 * @property {number} min - Required ratio.
 * @property {string} from - Color before the fix.
 * @property {string} to - Color after the fix.
 * @property {number} ratioBefore
 * @property {number} ratioAfter
 * @property {boolean} resolved - False if the target could not be reached.
 */
export function generateTokens(inputs) {
  const base = hexToOklch(normalizeHex(inputs.base));
  const accent = normalizeHex(inputs.accent);
  const corrections = [];
  const result = { corrections };
  for (const mode of MODES) {
    result[mode] = generateMode(mode, base, accent, corrections);
  }
  return result;
}

function generateMode(mode, base, accentHex, corrections) {
  const r = RECIPE[mode];
  const t = {};
  const tintC = Math.min(base.C * r.tint, r.maxTint);
  const neutral = (L, cScale = 1) => oklchToHex({ L, C: tintC * cScale, h: base.h });

  // Track every adjustment so the UI can show what was fixed.
  const fix = (token, against, min) => {
    const bgs = against.map((name) => t[name]);
    const before = t[token];
    const res = ensureContrast(before, bgs, min);
    if (res.adjusted || !res.resolved) {
      corrections.push({
        mode,
        token,
        against,
        min,
        from: before,
        to: res.color,
        ratioBefore: Math.min(...bgs.map((bg) => contrastRatio(before, bg))),
        ratioAfter: res.ratio,
        resolved: res.resolved,
      });
    }
    t[token] = res.color;
  };

  // Backgrounds and surfaces.
  for (const [name, L] of Object.entries(r.surfaces)) {
    t[name] = neutral(L, name === 'popover' ? 0.6 : 1);
  }
  const surfaces = ['bg', 'surfaceLow', 'surface', 'surfaceRaised', 'popover'];

  // Text, checked against every surface it can sit on.
  for (const [name, L] of Object.entries(r.text)) {
    t[name] = neutral(L, 0.6);
    fix(name, surfaces, AA_TEXT);
  }

  // Accent fill and the text on top of it. The fill is adjusted, not the
  // on-color, so buttons keep a clean white or near-black label.
  t.accent = accentHex;
  t.onAccent = pickOnColor(t.accent);
  fix('accent', ['onAccent'], AA_TEXT);
  fix('accent', ['bg', 'surfaceRaised'], AA_UI);
  t.onAccent = pickOnColor(t.accent);
  fix('accent', ['onAccent'], AA_TEXT);

  const acc = hexToOklch(t.accent);
  // Hover moves away from the label color so the label keeps its contrast:
  // darker under a white label, lighter under a dark one.
  const hoverShift = Math.abs(r.hoverShift) * (t.onAccent === '#ffffff' ? -1 : 1);
  t.accentHover = oklchToHex({ L: acc.L + hoverShift, C: acc.C, h: acc.h });
  fix('accentHover', ['onAccent'], AA_TEXT);

  t.accentSoft = oklchToHex({ L: r.accentSoft, C: Math.min(acc.C, 0.05), h: acc.h });

  // Accent as text (links) must read on surfaces and on its soft tint.
  t.accentText = accentHex;
  fix('accentText', [...surfaces, 'accentSoft'], AA_TEXT);

  // Borders: dividers stay subtle on purpose (WCAG 1.4.11 does not cover
  // decorative lines); control borders must reach 3:1.
  t.border = neutral(r.border, 1.5);
  t.borderStrong = neutral(r.borderStrong, 1.5);
  fix('borderStrong', ['bg', 'surface', 'surfaceRaised'], AA_UI);

  // Status colors, used as text.
  for (const [name, h] of Object.entries(STATE_HUES)) {
    t[name] = oklchToHex({ L: r.states.L, C: r.states.C, h });
    fix(name, surfaces, AA_TEXT);
  }

  // Return tokens in canonical order.
  return Object.fromEntries(TOKEN_NAMES.map((name) => [name, t[name]]));
}

// Contrast audit for a complete token set (WCAG 2.x, same formula as
// common checkers such as siegemedia.com/contrast-ratio).
// Pure functions, no browser or DOM dependencies.

import { AA_TEXT, AA_UI, contrastRatio } from './contrast.js';

export const AAA_TEXT = 7;

const SURFACES = ['bg', 'surfaceLow', 'surface', 'surfaceRaised', 'popover'];

/**
 * Every foreground/background pair a theme must satisfy.
 * `min` is the hard requirement; `kind` explains why.
 */
export const CONTRAST_PAIRS = Object.freeze([
  { fg: 'text', bg: SURFACES, min: AA_TEXT, kind: 'text' },
  { fg: 'textSecondary', bg: SURFACES, min: AA_TEXT, kind: 'text' },
  { fg: 'textMuted', bg: SURFACES, min: AA_TEXT, kind: 'text' },
  { fg: 'accentText', bg: [...SURFACES, 'accentSoft'], min: AA_TEXT, kind: 'text' },
  { fg: 'danger', bg: SURFACES, min: AA_TEXT, kind: 'text' },
  { fg: 'success', bg: SURFACES, min: AA_TEXT, kind: 'text' },
  { fg: 'warning', bg: SURFACES, min: AA_TEXT, kind: 'text' },
  { fg: 'onAccent', bg: ['accent', 'accentHover'], min: AA_TEXT, kind: 'text' },
  { fg: 'accent', bg: ['bg', 'surfaceRaised'], min: AA_UI, kind: 'ui' },
  { fg: 'borderStrong', bg: ['bg', 'surface', 'surfaceRaised'], min: AA_UI, kind: 'ui' },
]);

/**
 * Checks a token set against CONTRAST_PAIRS.
 * @param {Object<string,string>} tokens - One mode's tokens.
 * @returns {{pass: boolean, results: Array<{fg: string, bg: string, ratio: number, min: number, pass: boolean}>,
 *            textRatio: number, level: 'AAA'|'AA'|'fail'}}
 *   `textRatio` is the lowest primary-text contrast; `level` rates it.
 */
export function auditTokens(tokens) {
  const results = [];
  for (const pair of CONTRAST_PAIRS) {
    for (const bg of pair.bg) {
      const ratio = contrastRatio(tokens[pair.fg], tokens[bg]);
      results.push({ fg: pair.fg, bg, ratio, min: pair.min, pass: ratio >= pair.min });
    }
  }
  const textRatio = Math.min(...SURFACES.map((bg) => contrastRatio(tokens.text, tokens[bg])));
  const level = textRatio >= AAA_TEXT ? 'AAA' : textRatio >= AA_TEXT ? 'AA' : 'fail';
  return { pass: results.every((r) => r.pass), results, textRatio, level };
}

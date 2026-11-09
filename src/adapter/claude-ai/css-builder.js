// Turns theme tokens into a stylesheet for claude.ai.
// The output holds both the light and the dark version, keyed on the page's
// own data-mode attribute and on prefers-color-scheme for "system", so the
// theme follows the user's mode choice without any script.

import { hexToHsl } from '../../engine/color.js';
import { relativeLuminance } from '../../engine/contrast.js';
import {
  ELEMENT_RULES,
  MODE_ATTRIBUTE,
  MODE_ROOT,
  ROOT_VARIABLES,
  SCOPED_VARIABLES,
  STATIC_VARIABLES,
  THEME_PROPERTY_PREFIX,
  TOKEN_HOSTS,
} from './selectors.js';

const round = (n, d = 2) => Number(n.toFixed(d));

function formatValue(hex, format) {
  if (format === 'hsl') {
    const { h, s, l } = hexToHsl(hex);
    return `${round(h)} ${round(s)}% ${round(l)}%`;
  }
  return hex;
}

function declarations(variables, tokens) {
  return variables
    .filter((v) => tokens[v.token])
    .map((v) => `  ${v.name}: ${formatValue(tokens[v.token], v.format)} !important;`)
    .join('\n');
}

/** Selectors for a given mode root, e.g. html[data-mode="dark"]. */
function modeRoots(mode) {
  const attr = (value) => `${MODE_ROOT}[${MODE_ATTRIBUTE}="${value}"]`;
  return {
    explicit: [attr(mode)],
    // "system" (or no attribute at all) follows the OS preference.
    system: [attr('system'), `${MODE_ROOT}:not([${MODE_ATTRIBUTE}])`],
  };
}

function rule(roots, suffixes, body) {
  const selector = roots.flatMap((r) => suffixes.map((s) => `${r}${s}`)).join(',\n');
  return `${selector} {\n${body}\n}`;
}

/** The theme's own tokens as --ct-* properties, for ELEMENT_RULES. */
function themeProperties(tokens) {
  return Object.entries(tokens)
    .map(([name, value]) => `  ${THEME_PROPERTY_PREFIX}${name}: ${value};`)
    .join('\n');
}

function blocksForMode(mode, tokens) {
  const { explicit, system } = modeRoots(mode);
  // Native controls and scrollbars follow the theme's darkness, not the mode name.
  const scheme = relativeLuminance(tokens.bg) < 0.2 ? 'dark' : 'light';
  const rootBody = [
    declarations(ROOT_VARIABLES, tokens),
    themeProperties(tokens),
    `  color-scheme: ${scheme} !important;`,
  ].join('\n');
  const scoped = SCOPED_VARIABLES.map((s) => ({ suffix: ` ${s.selector}`, body: declarations(s.variables, tokens) }));

  const forRoots = (roots) => [
    rule(roots, TOKEN_HOSTS, rootBody),
    ...scoped.map((s) => rule(roots, [s.suffix], s.body)),
  ];

  const media = `(prefers-color-scheme: ${mode})`;
  return [
    ...forRoots(explicit),
    `@media ${media} {\n${forRoots(system).join('\n')}\n}`,
  ].join('\n');
}

/**
 * Builds the full stylesheet.
 * @param {{light: Object<string,string>, dark: Object<string,string>}} tokens
 * @param {{name?: string}} [meta] - Only used in the header comment.
 * @returns {string}
 */
export function buildCss(tokens, meta = {}) {
  if (!tokens || !tokens.light || !tokens.dark) throw new TypeError('buildCss needs light and dark tokens');
  const name = String(meta.name || 'custom').replace(/\*\//g, '');
  return [
    `/* Contrast Themes: ${name} */`,
    blocksForMode('light', tokens.light),
    blocksForMode('dark', tokens.dark),
    `${MODE_ROOT}, ${MODE_ROOT} .cds-root {\n${STATIC_VARIABLES.map((v) => `  ${v.name}: ${v.value} !important;`).join('\n')}\n}`,
    ...ELEMENT_RULES.map((r) => `/* ${r.area} */\n${r.selector} { ${r.css} }`),
    '',
  ].join('\n');
}

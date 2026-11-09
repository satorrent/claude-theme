import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCss } from '../../src/adapter/claude-ai/css-builder.js';
import { ELEMENT_RULES, ROOT_VARIABLES, SCOPED_VARIABLES } from '../../src/adapter/claude-ai/selectors.js';
import { TOKEN_NAMES, generateTokens } from '../../src/engine/tokens.js';

const tokens = generateTokens({ base: '#1e3a8a', accent: '#60a5fa' });

test('every mapped variable points to a real token', () => {
  const all = [...ROOT_VARIABLES, ...SCOPED_VARIABLES.flatMap((s) => s.variables)];
  for (const v of all) assert.ok(TOKEN_NAMES.includes(v.token), `${v.name} -> ${v.token}`);
  const names = ROOT_VARIABLES.map((v) => v.name);
  assert.equal(new Set(names).size, names.length, 'no duplicated variables');
});

test('css covers explicit modes and system mode via media queries', () => {
  const css = buildCss(tokens, { name: 'Test' });
  assert.match(css, /html\[data-mode="light"\],\nhtml\[data-mode="light"\] \.cds-root,\nhtml\[data-mode="light"\] #static-composer-box \{/);
  assert.match(css, /html\[data-mode="dark"\] \.dframe-sidebar \{/);
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{\nhtml\[data-mode="system"\]/);
  assert.match(css, /html:not\(\[data-mode\]\)/);
});

test('light and dark blocks carry their own token values', () => {
  const css = buildCss(tokens);
  const [lightPart, darkPart] = css.split('html[data-mode="dark"],');
  assert.ok(lightPart.includes(`--cds-surface-1: ${tokens.light.bg} !important;`));
  assert.ok(darkPart.includes(`--cds-surface-1: ${tokens.dark.bg} !important;`));
});

test('legacy variables are written as bare HSL components', () => {
  const css = buildCss({ light: { ...tokens.light, bg: '#d97757' }, dark: tokens.dark });
  assert.ok(css.includes('--bg-100: 14.77 63.11% 59.61% !important;'));
});

test('theme names cannot close the header comment', () => {
  const css = buildCss(tokens, { name: 'evil */ body{display:none} /*' });
  const header = css.split('\n')[0];
  assert.equal(header.indexOf('*/'), header.length - 2, 'only the real end of the comment');
  assert.ok(!css.includes('*/ body'));
});

test('element rules only reference existing theme tokens', () => {
  for (const rule of ELEMENT_RULES) {
    for (const [, name] of rule.css.matchAll(/var\(--ct-([a-zA-Z]+)\)/g)) {
      assert.ok(TOKEN_NAMES.includes(name), `${rule.area}: --ct-${name}`);
    }
  }
  const css = buildCss(tokens);
  assert.ok(css.includes(`--ct-borderStrong: ${tokens.dark.borderStrong};`));
});

test('color-scheme follows how dark the theme background is', () => {
  const darkBg = { ...tokens.light, bg: '#0b1f3a' };
  const css = buildCss({ light: darkBg, dark: darkBg });
  assert.ok(css.includes('color-scheme: dark !important;'));
  assert.ok(!css.includes('color-scheme: light !important'));
});

test('rejects missing token sets', () => {
  assert.throws(() => buildCss({ light: tokens.light }), TypeError);
});

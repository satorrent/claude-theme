import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { AAA_TEXT, CONTRAST_PAIRS, auditTokens } from '../../src/engine/audit.js';
import { completeTheme } from '../../src/engine/theme.js';
import { TOKEN_NAMES, generateTokens } from '../../src/engine/tokens.js';

const themesDir = new URL('../../themes/', import.meta.url);
const presetFiles = readdirSync(themesDir).filter((f) => f.endsWith('.json') && f !== 'theme.schema.json');
const load = (file) => JSON.parse(readFileSync(new URL(file, themesDir), 'utf8'));

test('contrast pairs only use known tokens', () => {
  for (const pair of CONTRAST_PAIRS) {
    assert.ok(TOKEN_NAMES.includes(pair.fg), pair.fg);
    for (const bg of pair.bg) assert.ok(TOKEN_NAMES.includes(bg), bg);
  }
});

test('generated themes always pass the audit', () => {
  const { light, dark } = generateTokens({ base: '#00ff88', accent: '#ffe600', tint: 1 });
  assert.equal(auditTokens(light).pass, true);
  assert.equal(auditTokens(dark).pass, true);
});

test('audit reports failing pairs and the text level', () => {
  const { dark } = generateTokens({ base: '#1e3a8a', accent: '#60a5fa' });
  const bad = { ...dark, textMuted: dark.surface };
  const audit = auditTokens(bad);
  assert.equal(audit.pass, false);
  assert.ok(audit.results.some((r) => r.fg === 'textMuted' && !r.pass));
  assert.equal(auditTokens(dark).level, auditTokens(dark).textRatio >= AAA_TEXT ? 'AAA' : 'AA');
});

test('there are exactly the six preset themes', () => {
  assert.deepEqual(presetFiles.sort(), ['black-green.json', 'black-orange.json', 'cream-green.json', 'cream-navy.json', 'cream-terracotta.json', 'navy-orange.json']);
});

for (const file of presetFiles) {
  test(`preset ${file} passes WCAG AA in both modes`, () => {
    const { audit } = completeTheme(load(file));
    for (const mode of ['light', 'dark']) {
      const failing = audit[mode].results.filter((r) => !r.pass);
      assert.deepEqual(failing, [], `${mode}: ${JSON.stringify(failing)}`);
    }
  });

  test(`preset ${file} has visible borders (3:1 against every surface)`, () => {
    const { theme } = completeTheme(load(file));
    const t = theme.tokens.dark;
    const audit = auditTokens(t);
    const border = audit.results.filter((r) => r.fg === 'borderStrong');
    assert.ok(border.length > 0 && border.every((r) => r.ratio >= 3));
  });
}

test('completeTheme rejects hand-written tokens with low contrast', () => {
  const theme = load('navy-orange.json');
  theme.tokens.dark = { ...theme.tokens.dark, text: theme.tokens.dark.bg };
  assert.throws(() => completeTheme(theme), /Contrast too low: dark text on bg/);
});

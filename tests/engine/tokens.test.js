import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToOklch } from '../../src/engine/color.js';
import { AA_TEXT, AA_UI, contrastRatio } from '../../src/engine/contrast.js';
import { schemaTokenNames } from '../../src/engine/schema.js';
import { MODES, TOKEN_NAMES, generateTokens } from '../../src/engine/tokens.js';

const SURFACES = ['bg', 'surfaceLow', 'surface', 'surfaceRaised', 'popover'];
const TEXT_TOKENS = ['text', 'textSecondary', 'textMuted', 'accentText', 'danger', 'success', 'warning'];

// A spread of inputs, including hostile ones (neon, near-white, near-black).
const INPUTS = [
  { base: '#c2410c', accent: '#c2410c' },
  { base: '#888888', accent: '#2a78d6' },
  { base: '#1e3a8a', accent: '#60a5fa' },
  { base: '#00ff88', accent: '#ff00ff' },
  { base: '#ffe600', accent: '#ffff00' },
  { base: '#000000', accent: '#000000' },
  { base: '#ffffff', accent: '#ffffff' },
  { base: '#7c3aed', accent: '#22c55e' },
];

test('token list matches the JSON schema', () => {
  assert.deepEqual([...TOKEN_NAMES], schemaTokenNames());
});

test('generates every token as hex in both modes', () => {
  const out = generateTokens(INPUTS[0]);
  for (const mode of MODES) {
    assert.deepEqual(Object.keys(out[mode]), [...TOKEN_NAMES]);
    for (const value of Object.values(out[mode])) assert.match(value, /^#[0-9a-f]{6}$/);
  }
});

for (const inputs of INPUTS) {
  test(`AA contrast holds for ${inputs.base} / ${inputs.accent}`, () => {
    const out = generateTokens(inputs);
    for (const mode of MODES) {
      const t = out[mode];
      for (const fg of TEXT_TOKENS) {
        for (const bg of SURFACES) {
          const r = contrastRatio(t[fg], t[bg]);
          assert.ok(r >= AA_TEXT, `${mode} ${fg} on ${bg}: ${r.toFixed(2)}`);
        }
      }
      assert.ok(contrastRatio(t.accentText, t.accentSoft) >= AA_TEXT, `${mode} accentText on accentSoft`);
      assert.ok(contrastRatio(t.onAccent, t.accent) >= AA_TEXT, `${mode} onAccent on accent`);
      assert.ok(contrastRatio(t.onAccent, t.accentHover) >= AA_TEXT, `${mode} onAccent on accentHover`);
      assert.ok(contrastRatio(t.accent, t.bg) >= AA_UI, `${mode} accent vs bg`);
      assert.ok(contrastRatio(t.borderStrong, t.bg) >= AA_UI, `${mode} borderStrong vs bg`);
    }
  });
}

test('light mode is light and dark mode is dark', () => {
  const out = generateTokens(INPUTS[2]);
  assert.ok(hexToOklch(out.light.bg).L > 0.9);
  assert.ok(hexToOklch(out.dark.bg).L < 0.3);
  assert.ok(hexToOklch(out.light.text).L < 0.4);
  assert.ok(hexToOklch(out.dark.text).L > 0.85);
});

test('surface levels are ordered and evenly spaced in lightness', () => {
  const { light, dark } = generateTokens(INPUTS[0]);
  const L = (hex) => hexToOklch(hex).L;
  assert.ok(L(light.surfaceLow) < L(light.bg) && L(light.bg) < L(light.surface));
  assert.ok(L(dark.surfaceLow) < L(dark.bg) && L(dark.bg) < L(dark.surface) && L(dark.surface) < L(dark.surfaceRaised));
});

test('backgrounds take the hue of the base color', () => {
  const { light, dark } = generateTokens({ base: '#1e3a8a', accent: '#60a5fa' });
  const baseHue = hexToOklch('#1e3a8a').h;
  for (const hex of [light.bg, dark.bg]) {
    assert.ok(Math.abs(hexToOklch(hex).h - baseHue) < 12, `hue of ${hex}`);
  }
});

test('a passing accent is kept exactly as chosen', () => {
  // Deep blue reaches 4.5:1 with white and 3:1 with the light background.
  const { light } = generateTokens({ base: '#888888', accent: '#1d4ed8' });
  assert.equal(light.accent, '#1d4ed8');
});

test('corrections describe what was adjusted', () => {
  const { corrections } = generateTokens({ base: '#888888', accent: '#ffff00' });
  const fix = corrections.find((c) => c.mode === 'light' && c.token === 'accentText');
  assert.ok(fix, 'yellow link text on light background must be corrected');
  assert.equal(fix.from, '#ffff00');
  assert.ok(fix.ratioBefore < AA_TEXT);
  assert.ok(fix.ratioAfter >= AA_TEXT);
  assert.equal(fix.min, AA_TEXT);
  assert.equal(fix.resolved, true);
});

test('generation is deterministic', () => {
  assert.deepEqual(generateTokens(INPUTS[3]), generateTokens(INPUTS[3]));
});

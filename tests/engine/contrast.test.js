import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToOklch } from '../../src/engine/color.js';
import {
  AA_TEXT,
  AA_UI,
  contrastRatio,
  ensureContrast,
  minContrast,
  pickOnColor,
  relativeLuminance,
} from '../../src/engine/contrast.js';

test('relative luminance of black and white', () => {
  assert.equal(relativeLuminance('#000000'), 0);
  assert.ok(Math.abs(relativeLuminance('#ffffff') - 1) < 1e-9);
});

test('contrast ratios match WCAG reference values', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 1e-9);
  assert.equal(contrastRatio('#777777', '#777777'), 1);
  // #767676 on white is the classic "just passes AA" gray (4.54:1).
  assert.ok(Math.abs(contrastRatio('#767676', '#ffffff') - 4.54) < 0.01);
  // Order does not matter.
  assert.equal(contrastRatio('#c2410c', '#fff'), contrastRatio('#fff', '#c2410c'));
});

test('ensureContrast leaves passing colors untouched', () => {
  const res = ensureContrast('#111111', ['#ffffff'], AA_TEXT);
  assert.equal(res.adjusted, false);
  assert.equal(res.color, '#111111');
});

test('ensureContrast fixes failing text with the smallest lightness change', () => {
  const fg = '#9a9a9a'; // ~2.8:1 on white
  const res = ensureContrast(fg, ['#ffffff'], AA_TEXT);
  assert.equal(res.adjusted, true);
  assert.equal(res.resolved, true);
  assert.ok(res.ratio >= AA_TEXT);
  assert.ok(res.ratio < AA_TEXT + 0.15, 'does not overshoot');
  assert.ok(hexToOklch(res.color).L < hexToOklch(fg).L, 'darkens on a light background');
});

test('ensureContrast lightens on dark backgrounds and keeps the hue', () => {
  const fg = '#8a2d0a';
  const res = ensureContrast(fg, ['#191919'], AA_TEXT);
  assert.ok(res.ratio >= AA_TEXT);
  assert.ok(hexToOklch(res.color).L > hexToOklch(fg).L);
  assert.ok(Math.abs(hexToOklch(res.color).h - hexToOklch(fg).h) < 6);
});

test('ensureContrast checks against every background', () => {
  const bgs = ['#ffffff', '#ececec', '#f5f5f5'];
  const res = ensureContrast('#8f8f8f', bgs, AA_UI);
  assert.ok(minContrast(res.color, bgs) >= AA_UI);
});

test('ensureContrast reports unreachable targets instead of looping', () => {
  // Mid gray between black and white backgrounds cannot reach 7:1 with both.
  const res = ensureContrast('#777777', ['#000000', '#ffffff'], 7);
  assert.equal(res.resolved, false);
});

test('pickOnColor chooses the more readable label', () => {
  assert.equal(pickOnColor('#1d4ed8'), '#ffffff');
  assert.notEqual(pickOnColor('#fde047'), '#ffffff');
});

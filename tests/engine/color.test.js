import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deltaOk,
  hexToHsl,
  hexToOklch,
  isHex,
  isInGamut,
  normalizeHex,
  oklchToHex,
} from '../../src/engine/color.js';

test('normalizeHex expands short form and lowercases', () => {
  assert.equal(normalizeHex('#ABC'), '#aabbcc');
  assert.equal(normalizeHex('C2410C'), '#c2410c');
  assert.throws(() => normalizeHex('#12345'), TypeError);
  assert.equal(isHex('red'), false);
});

test('known OKLCH values for reference colors', () => {
  const white = hexToOklch('#ffffff');
  assert.ok(Math.abs(white.L - 1) < 1e-3);
  assert.ok(white.C < 1e-3);
  const black = hexToOklch('#000000');
  assert.ok(Math.abs(black.L) < 1e-3);
  // Pure red in OKLCH is about L 0.628, C 0.258, h 29.2.
  const red = hexToOklch('#ff0000');
  assert.ok(Math.abs(red.L - 0.628) < 0.002);
  assert.ok(Math.abs(red.C - 0.258) < 0.002);
  assert.ok(Math.abs(red.h - 29.2) < 0.3);
});

test('hex -> OKLCH -> hex round-trips', () => {
  for (const hex of ['#000000', '#ffffff', '#c2410c', '#2a78d6', '#7c3aed', '#00ff88', '#191919', '#f9f9f7']) {
    assert.equal(oklchToHex(hexToOklch(hex)), hex);
  }
});

test('out-of-gamut colors are mapped into sRGB by reducing chroma', () => {
  const lch = { L: 0.9, C: 0.4, h: 140 };
  assert.equal(isInGamut(lch), false);
  const hex = oklchToHex(lch);
  assert.match(hex, /^#[0-9a-f]{6}$/);
  const back = hexToOklch(hex);
  assert.ok(Math.abs(back.L - 0.9) < 0.01, 'lightness is preserved');
  assert.ok(back.C < 0.4);
});

test('hexToHsl matches CSS hsl()', () => {
  const { h, s, l } = hexToHsl('#d97757');
  assert.ok(Math.abs(h - 15) < 0.5);
  assert.ok(Math.abs(s - 63.1) < 0.2);
  assert.ok(Math.abs(l - 59.6) < 0.2);
});

test('deltaOk is zero for equal colors and grows with difference', () => {
  assert.equal(deltaOk('#123456', '#123456'), 0);
  assert.ok(deltaOk('#000000', '#ffffff') > deltaOk('#000000', '#333333'));
});

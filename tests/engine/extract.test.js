import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deltaOk, hexToRgb } from '../../src/engine/color.js';
import { extractPalette, suggestInputs } from '../../src/engine/extract.js';

/** Builds RGBA pixels from [hex, pixelCount] pairs, plus optional noise. */
function image(parts, { noise = 0, seed = 7 } = {}) {
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 2 - 1;
  const px = [];
  for (const [hex, n] of parts) {
    const { r, g, b } = hexToRgb(hex);
    for (let i = 0; i < n; i++) {
      const j = (v) => Math.max(0, Math.min(255, Math.round(v * 255 + rand() * noise)));
      px.push(j(r), j(g), j(b), 255);
    }
  }
  return new Uint8ClampedArray(px);
}

test('finds the colors of a flat image, ordered by area', () => {
  const pal = extractPalette(image([['#1e3a8a', 600], ['#f5f5f4', 300], ['#c2410c', 100]]), { count: 3 });
  assert.deepEqual(pal.map((p) => p.hex), ['#1e3a8a', '#f5f5f4', '#c2410c']);
  assert.ok(Math.abs(pal[0].weight - 0.6) < 1e-9);
  assert.ok(Math.abs(pal.reduce((s, p) => s + p.weight, 0) - 1) < 1e-9);
});

test('recovers dominant colors from noisy pixels', () => {
  const src = ['#2a78d6', '#e34948', '#22c55e', '#111111', '#f9f9f7'];
  const pal = extractPalette(image(src.map((h) => [h, 400]), { noise: 12 }), { count: 5 });
  assert.equal(pal.length, 5);
  for (const hex of src) {
    const nearest = Math.min(...pal.map((p) => deltaOk(p.hex, hex)));
    assert.ok(nearest < 0.03, `${hex} not found (nearest ${nearest.toFixed(3)})`);
  }
});

test('returns fewer colors than asked when the image has fewer', () => {
  const pal = extractPalette(image([['#ff0000', 50], ['#0000ff', 50]]), { count: 6 });
  assert.equal(pal.length, 2);
});

test('ignores transparent pixels', () => {
  const px = image([['#00ff00', 10], ['#ff00ff', 90]]);
  for (let i = 10 * 4; i < px.length; i += 4) px[i + 3] = 0;
  const pal = extractPalette(px, { count: 3 });
  assert.deepEqual(pal.map((p) => p.hex), ['#00ff00']);
  assert.deepEqual(extractPalette(new Uint8ClampedArray([0, 0, 0, 0])), []);
});

test('is deterministic for a given seed', () => {
  const px = image([['#2a78d6', 300], ['#e34948', 300], ['#eeeeee', 300]], { noise: 30 });
  assert.deepEqual(extractPalette(px, { seed: 3 }), extractPalette(px, { seed: 3 }));
});

test('samples large images instead of reading every pixel', () => {
  const px = image([['#123456', 200000], ['#abcdef', 100000]]);
  const pal = extractPalette(px, { count: 2, maxSamples: 5000 });
  assert.deepEqual(pal.map((p) => p.hex), ['#123456', '#abcdef']);
});

test('rejects malformed input', () => {
  assert.throws(() => extractPalette(new Uint8ClampedArray([1, 2, 3])), TypeError);
  assert.throws(() => extractPalette(image([['#000000', 4]]), { count: 0 }), RangeError);
});

test('suggestInputs picks the dominant color as base and a vivid one as accent', () => {
  const pal = [
    { hex: '#f5f5f4', weight: 0.6 },
    { hex: '#6b6b6b', weight: 0.25 },
    { hex: '#c2410c', weight: 0.15 },
  ];
  assert.deepEqual(suggestInputs(pal), { base: '#f5f5f4', accent: '#c2410c' });
  assert.deepEqual(suggestInputs([{ hex: '#777777', weight: 1 }]), { base: '#777777', accent: '#777777' });
  assert.throws(() => suggestInputs([]), RangeError);
});

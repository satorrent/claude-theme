// Palette extraction from raw pixels with k-means clustering in OKLab.
// Takes an RGBA byte array (as produced by canvas getImageData) so it stays
// free of browser APIs; decoding the image is the caller's job.

import { hexToOklch, linearToOklab, linearToRgb, oklabToLinear, rgbToHex, rgbToLinear } from './color.js';

/** Small deterministic PRNG (mulberry32) so results are reproducible. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

/**
 * Extracts the dominant colors of an image.
 *
 * @param {Uint8ClampedArray|Uint8Array|number[]} rgba - Pixels, 4 bytes each.
 * @param {{count?: number, maxSamples?: number, iterations?: number, restarts?: number, seed?: number, minAlpha?: number}} [opts]
 * @returns {Array<{hex: string, weight: number}>} Sorted by weight (share of
 *   sampled pixels, 0..1). May return fewer than `count` colors when the
 *   image has fewer distinct colors.
 */
export function extractPalette(rgba, opts = {}) {
  const { count = 6, maxSamples = 20000, iterations = 20, restarts = 4, seed = 1, minAlpha = 128 } = opts;
  if (!rgba || rgba.length < 4 || rgba.length % 4 !== 0) {
    throw new TypeError('extractPalette expects RGBA pixel data (length multiple of 4)');
  }
  if (!Number.isInteger(count) || count < 1) throw new RangeError('count must be a positive integer');

  // Sample pixels evenly and convert to OKLab, skipping transparent ones.
  const total = rgba.length / 4;
  const stride = Math.max(1, Math.floor(total / maxSamples));
  const points = [];
  for (let i = 0; i < total; i += stride) {
    const o = i * 4;
    if (rgba[o + 3] < minAlpha) continue;
    const lab = linearToOklab(rgbToLinear({ r: rgba[o] / 255, g: rgba[o + 1] / 255, b: rgba[o + 2] / 255 }));
    points.push([lab.L, lab.a, lab.b]);
  }
  if (points.length === 0) return [];

  const rand = prng(seed);
  const k = Math.min(count, points.length);

  // k-means can settle in a local minimum (two centers sharing one color
  // while another color is lost), so keep the best of a few restarts.
  let best = null;
  for (let attempt = 0; attempt < restarts; attempt++) {
    const run = kmeans(points, k, iterations, rand);
    if (!best || run.inertia < best.inertia) best = run;
  }
  const { centers, counts } = best;

  // Merge clusters whose colors would round to the same hex.
  const byHex = new Map();
  centers.forEach(([L, a, b], c) => {
    if (counts[c] === 0) return;
    const hex = rgbToHex(linearToRgb(oklabToLinear({ L, a, b })));
    byHex.set(hex, (byHex.get(hex) || 0) + counts[c]);
  });

  return [...byHex.entries()]
    .map(([hex, n]) => ({ hex, weight: n / points.length }))
    .sort((x, y) => y.weight - x.weight);
}

/** One k-means++ run. Returns centers, cluster sizes and total squared error. */
function kmeans(points, k, iterations, rand) {
  const centers = [points[Math.floor(rand() * points.length)].slice()];
  const d = new Float64Array(points.length).fill(Infinity);
  while (centers.length < k) {
    const last = centers[centers.length - 1];
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      d[i] = Math.min(d[i], dist2(points[i], last));
      sum += d[i];
    }
    if (sum === 0) break; // fewer distinct colors than k
    let r = rand() * sum;
    let idx = 0;
    while (idx < points.length - 1 && (r -= d[idx]) > 0) idx++;
    centers.push(points[idx].slice());
  }

  const assign = new Int32Array(points.length);
  const nearest = (p) => {
    let best = 0;
    let bestD = Infinity;
    for (let c = 0; c < centers.length; c++) {
      const dd = dist2(p, centers[c]);
      if (dd < bestD) {
        bestD = dd;
        best = c;
      }
    }
    return [best, bestD];
  };

  // Lloyd iterations.
  for (let it = 0; it < iterations; it++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < points.length; i++) {
      const [c] = nearest(points[i]);
      assign[i] = c;
      const s = sums[c];
      s[0] += points[i][0];
      s[1] += points[i][1];
      s[2] += points[i][2];
      s[3]++;
    }
    let moved = 0;
    sums.forEach((s, c) => {
      if (s[3] === 0) return;
      const next = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
      moved = Math.max(moved, dist2(next, centers[c]));
      centers[c] = next;
    });
    if (moved < 1e-10) break;
  }

  // Final assignment against the final centers.
  const counts = new Array(centers.length).fill(0);
  let inertia = 0;
  for (let i = 0; i < points.length; i++) {
    const [c, dd] = nearest(points[i]);
    counts[c]++;
    inertia += dd;
  }
  return { centers, counts, inertia };
}

/**
 * Picks theme inputs from an extracted palette: the most common color as
 * base, and the most colorful remaining color (weighted by presence) as
 * accent. Falls back to the base when the image is fully neutral.
 *
 * @param {Array<{hex: string, weight: number}>} palette
 * @returns {{base: string, accent: string}}
 */
export function suggestInputs(palette) {
  if (!palette || palette.length === 0) throw new RangeError('palette is empty');
  const base = palette[0].hex;
  const scored = palette.slice(1).map((p) => {
    const { C, L } = hexToOklch(p.hex);
    // Favor chroma, keep some weight for presence, avoid near-black/white.
    const lightnessPenalty = L < 0.2 || L > 0.95 ? 0.3 : 1;
    return { hex: p.hex, score: C * Math.sqrt(p.weight) * lightnessPenalty };
  });
  scored.sort((a, b) => b.score - a.score);
  const accent = scored.length && scored[0].score > 0.001 ? scored[0].hex : base;
  return { base, accent };
}

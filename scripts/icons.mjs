// Draws the extension icon as PNG files in icons/, with no dependencies.
//   node scripts/icons.mjs
//
// The icon is a rounded navy square with an orange edge and a half-cream,
// half-black circle (a contrast symbol). Shapes are defined in a unit square
// and rendered with 8x8 supersampling for smooth edges.

import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'icons');

const NAVY = [0x0b, 0x1f, 0x3a];
const ORANGE = [0xff, 0x8a, 0x1f];
const CREAM = [0xfb, 0xf6, 0xea];
const BLACK = [0x0a, 0x0a, 0x0a];

// Transparent margin per size, as a fraction of the size. The Chrome Web
// Store asks for 16px of padding around the 96px artwork at 128px.
const SIZES = { 16: 0, 32: 1 / 32, 48: 2 / 48, 128: 16 / 128 };

/** Signed distance to a rounded square centered at 0.5 (negative inside). */
function roundedSquare(x, y, half, radius) {
  const qx = Math.abs(x - 0.5) - half + radius;
  const qy = Math.abs(y - 0.5) - half + radius;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Color at a point of the artwork (unit square), or null if transparent. */
function sample(x, y) {
  const square = roundedSquare(x, y, 0.5, 0.22);
  if (square > 0) return null;
  if (square > -0.1) return ORANGE; // edge
  const d = Math.hypot(x - 0.5, y - 0.5);
  if (d > 0.27) return NAVY;
  if (d > 0.23) return CREAM; // circle outline
  return x < 0.5 ? CREAM : BLACK;
}

function render(size, margin) {
  const ss = 8;
  const pixels = Buffer.alloc(size * size * 4);
  const art = 1 - 2 * margin;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = ((px + (sx + 0.5) / ss) / size - margin) / art;
          const v = ((py + (sy + 0.5) / ss) / size - margin) / art;
          const c = u >= 0 && u <= 1 && v >= 0 && v <= 1 ? sample(u, v) : null;
          if (!c) continue;
          r += c[0]; g += c[1]; b += c[2]; a += 1;
        }
      }
      const i = (py * size + px) * 4;
      if (a) {
        pixels[i] = Math.round(r / a);
        pixels[i + 1] = Math.round(g / a);
        pixels[i + 2] = Math.round(b / a);
      }
      pixels[i + 3] = Math.round((a / (ss * ss)) * 255);
    }
  }
  return pixels;
}

// ---------- Minimal PNG encoder (RGBA, 8 bit) ----------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // no filter
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

await mkdir(OUT, { recursive: true });
for (const [size, margin] of Object.entries(SIZES)) {
  const n = Number(size);
  await writeFile(join(OUT, `icon${n}.png`), encodePng(n, render(n, margin)));
}
console.log(`Wrote ${Object.keys(SIZES).map((s) => `icon${s}.png`).join(', ')} to icons/.`);

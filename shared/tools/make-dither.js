#!/usr/bin/env node
// Generates shared/css/dither.png: a seamless, grey, ordered-dither tile (the grainy
// halftone look of the White Knuckle key art). No dependencies.
// Run: node shared/tools/make-dither.js
// Tweak SIZE / LEVELS / SEED below, then re-run.

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE   = 128;                    // tile edge in pixels (shown at 2x, so 256 CSS px)
const LEVELS = [20, 27, 35, 44];       // grey values the dither picks from (0-255)
const SEED   = 17;

// ── Tileable value noise ────────────────────────────────────────────────────

let s = SEED;
const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;

function grid(cells) {
  return Array.from({ length: cells }, () => Array.from({ length: cells }, rand));
}

function sample(g, x, y) {
  const n = g.length;
  const fx = (x / SIZE) * n, fy = (y / SIZE) * n;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const at = (i, j) => g[(j + n) % n][(i + n) % n];   // wrap → seamless
  const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

const octaves = [{ g: grid(4), w: 0.2 }, { g: grid(16), w: 0.35 }, { g: grid(64), w: 0.45 }];

// ── 8x8 Bayer matrix (ordered dither) ───────────────────────────────────────

const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
];

const pixels = Buffer.alloc(SIZE * (SIZE + 1));   // grayscale rows, each with a filter byte
for (let y = 0; y < SIZE; y++) {
  pixels[y * (SIZE + 1)] = 0;
  for (let x = 0; x < SIZE; x++) {
    let v = octaves.reduce((sum, o) => sum + sample(o.g, x, y) * o.w, 0);
    v = Math.min(0.999, Math.max(0, (v - 0.2) / 0.6));   // stretch contrast
    const scaled = v * (LEVELS.length - 1);
    const i = Math.floor(scaled);
    const threshold = (BAYER[y % 8][x % 8] + 0.5) / 64;
    const level = LEVELS[Math.min(LEVELS.length - 1, i + (scaled - i > threshold ? 1 : 0))];
    pixels[y * (SIZE + 1) + 1 + x] = level;
  }
}

// ── Minimal PNG encoder (8-bit grayscale) ───────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 0;   // colour type: grayscale

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(pixels, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, '../css/dither.png');
fs.writeFileSync(out, png);
console.log(`Written: ${out} (${SIZE}x${SIZE}, ${png.length} bytes)`);

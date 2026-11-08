// Generate PWA icons and favicon as "IT" monogram (white on industrial blue).
// The monogram is built from three rectangles; glyphScale is relative to the
// master glyph (140 x 121 units). Pure Node.js built-ins, no dependencies.
'use strict';

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.resolve(__dirname, '..', 'client/src/assets/icons');
const FAVICON = path.resolve(__dirname, '..', 'client/src/favicon.ico');

const BG = [0x1e, 0x3a, 0x5f]; // #1e3a5f
const FG = [0xff, 0xff, 0xff]; // white

// Master "IT" glyph, in a 140 x 121 box (units):
//   I:    vertical bar (full height, left)
//   T:    top bar + vertical stem (centred under the top bar)
const GLYPH = {
  width: 140,
  height: 121,
  rects: [
    { x: 0, y: 0, w: 27, h: 121 },   // I bar
    { x: 44, y: 0, w: 96, h: 21 },   // T top bar
    { x: 78, y: 0, w: 27, h: 121 },  // T stem
  ],
};

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------
function crc32(buf) {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
  return Buffer.concat([len, typeB, data, crcVal]);
}

function renderRGBA(size, glyphScale) {
  // Rasterize the glyph rectangles (pixel coords) and find the union bbox.
  const rs = GLYPH.rects.map((r) => {
    const x0 = Math.round(r.x * glyphScale);
    const y0 = Math.round(r.y * glyphScale);
    const x1 = Math.round((r.x + r.w) * glyphScale) - 1;
    const y1 = Math.round((r.y + r.h) * glyphScale) - 1;
    return { x0, y0, x1, y1 };
  });

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rs) {
    if (r.x0 < minX) minX = r.x0;
    if (r.y0 < minY) minY = r.y0;
    if (r.x1 > maxX) maxX = r.x1;
    if (r.y1 > maxY) maxY = r.y1;
  }
  const gw = maxX - minX + 1;
  const gh = maxY - minY + 1;
  const left = Math.round((size - gw) / 2);
  const top = Math.round((size - gh) / 2);

  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = (y * size + x) * 4;
      pixels[p] = BG[0];
      pixels[p + 1] = BG[1];
      pixels[p + 2] = BG[2];
      pixels[p + 3] = 255;
    }
  }
  for (const r of rs) {
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const px = x - minX + left;
        const py = y - minY + top;
        if (px < 0 || px >= size || py < 0 || py >= size) continue;
        const p = (py * size + px) * 4;
        pixels[p] = FG[0];
        pixels[p + 1] = FG[1];
        pixels[p + 2] = FG[2];
        pixels[p + 3] = 255;
      }
    }
  }
  return pixels;
}

function encodePNG(size, pixels) {
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter: none
    pixels.copy(row, 1, y * size * 4, (y + 1) * size * 4);
    rawRows.push(row);
  }
  const raw = Buffer.concat(rawRows);
  const deflated = zlib.deflateSync(raw);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// ICO (48/32/16, 32bpp BITMAPINFOHEADER + AND mask)
// ---------------------------------------------------------------------------
function encodeIcoBmp(size, pixels) {
  const rowSize = size * 4; // already 4-byte aligned
  const andStride = ((size + 31) >> 5) * 4;
  const andSize = andStride * size;
  const xorSize = rowSize * size;
  const total = 40 + xorSize + andSize;

  const out = Buffer.alloc(total);
  out.writeUInt32LE(40, 0);          // biSize
  out.writeInt32LE(size, 4);         // biWidth
  out.writeInt32LE(size * 2, 8);     // biHeight (XOR + AND)
  out.writeUInt16LE(1, 12);          // biPlanes
  out.writeUInt16LE(32, 14);         // biBitCount
  out.writeUInt32LE(0, 16);          // biCompression
  out.writeUInt32LE(xorSize + andSize, 20); // biSizeImage

  // XOR data: bottom-up, BGRA
  for (let y = 0; y < size; y++) {
    const srcY = size - 1 - y;
    for (let x = 0; x < size; x++) {
      const si = (y * size + x) * 4;
      const di = 40 + srcY * rowSize + x * 4;
      const r = pixels[si], g = pixels[si + 1], b = pixels[si + 2], a = pixels[si + 3];
      out[di] = b;
      out[di + 1] = g;
      out[di + 2] = r;
      out[di + 3] = a;
    }
  }
  // AND mask: all zeros (fully opaque), already zeroed in Buffer.alloc.
  return out;
}

function buildIco(entries) {
  const count = entries.length;
  const headerSize = 6 + count * 16;
  const datas = entries.map((e) => encodeIcoBmp(e.size, e.pixels));
  let offset = headerSize;
  const dir = Buffer.alloc(headerSize);
  dir.writeUInt16LE(0, 0);  // reserved
  dir.writeUInt16LE(1, 2);  // type: icon
  dir.writeUInt16LE(count, 4);
  entries.forEach((e, i) => {
    const o = 6 + i * 16;
    dir[o] = e.size >= 256 ? 0 : e.size;
    dir[o + 1] = e.size >= 256 ? 0 : e.size;
    dir[o + 2] = 0; // palette
    dir[o + 3] = 0; // reserved
    dir.writeUInt16LE(1, o + 4); // planes
    dir.writeUInt16LE(32, o + 6); // bpp
    dir.writeUInt32LE(datas[i].length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += datas[i].length;
  });
  return Buffer.concat([dir, ...datas]);
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------
fs.mkdirSync(ICONS_DIR, { recursive: true });

// (icon size, current glyph height) -> new scale = (currentH / masterH) * 1.8
const PNG_SPECS = [
  [72, 18],
  [96, 23],
  [128, 30],
  [144, 34],
  [152, 36],
  [192, 46],
  [384, 91],
  [512, 121],
  [192, 32, true],  // maskable
  [512, 85, true],  // maskable
];

for (const [size, curH, maskable] of PNG_SPECS) {
  const scale = (curH / GLYPH.height) * 1.8;
  const pixels = renderRGBA(size, scale);
  const png = encodePNG(size, pixels);
  const name = `icon-${size}x${size}${maskable ? '-maskable' : ''}.png`;
  fs.writeFileSync(path.join(ICONS_DIR, name), png);
  console.log(`  ${name} — ${png.length} bytes (glyph height ${Math.round(curH * 1.8)})`);
}

// Favicon (48/32/16) — smaller glyph, same monogram.
const ICO_SPECS = [
  [48, 12],
  [32, 8],
  [16, 4],
];
const icoEntries = ICO_SPECS.map(([size, curH]) => {
  const scale = (curH / GLYPH.height) * 1.8;
  return { size, pixels: renderRGBA(size, scale) };
});
const ico = buildIco(icoEntries);
fs.writeFileSync(FAVICON, ico);
console.log(`  favicon.ico — ${ico.length} bytes`);

console.log('\nAll icons generated successfully.');

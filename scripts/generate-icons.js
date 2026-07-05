// Generate PWA icons — minimal PNG generator using only Node.js built-ins
'use strict';

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', 'client/src/assets/icons');
fs.mkdirSync(OUT, { recursive: true });

// Industrial blue palette
const BG = [0x1e, 0x3a, 0x5f]; // #1e3a5f
const FG = [0x22, 0xc5, 0x5e]; // #22c55e

function pushColor(row, color) {
  row.push(color[0], color[1], color[2]);
}

function crc32(buf) {
  var c, n, k;
  var table = new Int32Array(256);
  for (n = 0; n < 256; n++) {
    c = n;
    for (k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  c = 0xffffffff;
  for (var i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  var len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  var typeB = Buffer.from(type, 'ascii');
  var crcInput = Buffer.concat([typeB, data]);
  var crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeB, data, crcVal]);
}

function generatePNG(size) {
  var rawRows = [];
  var cx = size / 2, cy = size / 2;
  var r = size * 0.35;
  var teeth = 8;
  var toothDepth = size * 0.08;

  for (var y = 0; y < size; y++) {
    var row = [0]; // filter: none
    for (var x = 0; x < size; x++) {
      var dx = x - cx, dy = y - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var angle = Math.atan2(dy, dx);
      var modulatedR = r + Math.sin(angle * teeth) * toothDepth;
      if (dist < modulatedR) {
        pushColor(row, FG);
      } else {
        pushColor(row, BG);
      }
    }
    rawRows.push(Buffer.from(row));
  }

  var raw = Buffer.concat(rawRows);
  var deflated = zlib.deflateSync(raw);

  var signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  var ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdrData),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function generateMaskable(size) {
  var safe = Math.floor(size * 0.8);
  var pad = Math.floor((size - safe) / 2);
  var cx = safe / 2, cy = safe / 2;
  var r = safe * 0.38;
  var rawRows = [];

  for (var y = 0; y < size; y++) {
    var row = [0];
    for (var x = 0; x < size; x++) {
      if (x < pad || x >= pad + safe || y < pad || y >= pad + safe) {
        pushColor(row, BG);
      } else {
        var dx = (x - pad) - cx, dy = (y - pad) - cy;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < r) {
          pushColor(row, FG);
        } else {
          pushColor(row, BG);
        }
      }
    }
    rawRows.push(Buffer.from(row));
  }

  var raw = Buffer.concat(rawRows);
  var deflated = zlib.deflateSync(raw);

  var signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  var ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdrData),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Generate all icons
var sizes = [72, 96, 128, 144, 152, 192, 384, 512];
for (var i = 0; i < sizes.length; i++) {
  var s = sizes[i];
  var png = generatePNG(s);
  fs.writeFileSync(path.join(OUT, 'icon-' + s + 'x' + s + '.png'), png);
  console.log('  icon-' + s + 'x' + s + '.png — ' + png.length + ' bytes');
}

// Maskable 192 and 512
var maskableSizes = [192, 512];
for (var j = 0; j < maskableSizes.length; j++) {
  var ms = maskableSizes[j];
  var mpng = generateMaskable(ms);
  fs.writeFileSync(path.join(OUT, 'icon-' + ms + 'x' + ms + '-maskable.png'), mpng);
  console.log('  icon-' + ms + 'x' + ms + '-maskable.png — ' + mpng.length + ' bytes');
}

// Favicon (32x32 PNG as favicon.ico)
var fav = generatePNG(32);
var favOut = path.resolve(__dirname, '..', 'client/src/favicon.ico');
fs.writeFileSync(favOut, fav);
console.log('  favicon.ico — ' + fav.length + ' bytes');

console.log('\nAll icons generated successfully.');

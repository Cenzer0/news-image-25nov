// The World Today — 25 November 2026.
//
// A program that draws one newspaper front page summing up the world's
// news of Wednesday 25 November 2026 and writes it to /output/entry.png.
//
// Everything is drawn in code: a small software rasterizer, a 5x7 bitmap
// font written for this picture, and a PNG encoder built on node:zlib.
// No network, no files read, no randomness: two runs write the same bytes.
//
// Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph is 7 rows; each row is 5 bits, bit 4 leftmost.
// Only the capitals, digits and punctuation this picture needs are defined.
// ---------------------------------------------------------------------------

type Glyph = number[];

const FONT: Record<string, Glyph> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ',': [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ':': [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ';': [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '-': [0, 0, 0, 0x0e, 0, 0, 0],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '%': [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  '+': [0, 0x04, 0x04, 0x0e, 0x04, 0x04, 0],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  '?': [0x0e, 0x11, 0x01, 0x06, 0x04, 0, 0x04],
  '"': [0x0a, 0x0a, 0, 0, 0, 0, 0],
  '=': [0, 0, 0x1f, 0, 0x1f, 0, 0],
  '$': [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  '•': [0, 0, 0x0c, 0x0c, 0x0c, 0, 0],
};

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

const PAPER: RGB = [246, 241, 229];
const CARD: RGB = [255, 253, 247];
const INK: RGB = [20, 20, 20];
const NAVY: RGB = [16, 35, 63];
const GOLD: RGB = [201, 162, 39];
const RED: RGB = [179, 38, 30];
const TEAL: RGB = [14, 107, 92];
const GREY: RGB = [105, 105, 100];
const WHITE: RGB = [255, 255, 255];

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// Canvas: a plain RGB buffer with the drawing primitives the picture needs.
// ---------------------------------------------------------------------------

const img = Buffer.alloc(W * H * 3);

function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  img[i] = c[0];
  img[i + 1] = c[1];
  img[i + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) px(xx, yy, c);
  }
}

function hline(x0: number, x1: number, y: number, c: RGB): void {
  for (let x = x0; x <= x1; x++) px(x, y, c);
}

function vline(x: number, y0: number, y1: number, c: RGB): void {
  for (let y = y0; y <= y1; y++) px(x, y, c);
}

function thickLine(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const half = Math.floor(t / 2);
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + (dx * s) / steps);
    const y = Math.round(y0 + (dy * s) / steps);
    for (let oy = -half; oy <= half; oy++) {
      for (let ox = -half; ox <= half; ox++) px(x + ox, y + oy, c);
    }
  }
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) px(cx + x, cy + y, c);
    }
  }
}

type Pt = [number, number];

function polygon(points: Pt[], c: RGB): void {
  // Scanline fill.
  let minY = H;
  let maxY = -1;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(Math.round(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0)));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = xs[k]; x <= xs[k + 1]; x++) px(x, y, c);
    }
  }
}

function burst(cx: number, cy: number, rOuter: number, rInner: number, points: number, c: RGB): void {
  const pts: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (i * Math.PI) / points - Math.PI / 2;
    pts.push([Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]);
  }
  polygon(pts, c);
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawChar(x: number, y: number, ch: string, scale: number, c: RGB): void {
  const g = FONT[ch] ?? FONT['?'];
  for (let row = 0; row < 7; row++) {
    const bits = g[row];
    for (let col = 0; col < 5; col++) {
      if ((bits >> (4 - col)) & 1) {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            px(x + col * scale + dx, y + row * scale + dy, c);
          }
        }
      }
    }
  }
}

function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    drawChar(cx, y, ch, scale, c);
    cx += 6 * scale;
  }
}

function drawTextCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

function wrapLines(s: string, maxWidth: number, scale: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur === '' ? w : cur + ' ' + w;
    if (textWidth(next, scale) <= maxWidth) {
      cur = next;
    } else {
      if (cur !== '') lines.push(cur);
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

function drawPara(x: number, y: number, s: string, maxWidth: number, scale: number, lineH: number, c: RGB, maxLines: number): void {
  const lines = wrapLines(s, maxWidth, scale).slice(0, maxLines);
  for (let i = 0; i < lines.length; i++) {
    drawText(x, y + i * lineH, lines[i], scale, c);
  }
}

// ---------------------------------------------------------------------------
// Pictograms. Each draws one flat scene inside a 170x140 box at (x, y).
// ---------------------------------------------------------------------------

const PW = 170;
const PH = 140;

function picTanker(x: number, y: number): void {
  rect(x, y, PW, PH, [126, 178, 205]); // sea sky
  rect(x, y + 88, PW, 52, [23, 68, 110]); // sea
  for (let i = 0; i < 5; i++) {
    thickLine(x + 6 + i * 34, y + 100 + (i % 2) * 12, x + 30 + i * 34, y + 100 + (i % 2) * 12, 2, [160, 200, 225]);
  }
  // tanker hull, bow right
  polygon([[x + 18, y + 78], [x + 152, y + 78], [x + 142, y + 98], [x + 28, y + 98]], [52, 58, 66]);
  rect(x + 26, y + 56, 26, 22, [230, 230, 225]); // bridge block
  rect(x + 30, y + 60, 18, 4, [40, 60, 90]); // bridge windows
  rect(x + 118, y + 60, 10, 18, [179, 38, 30]); // funnel
  // deck pipes
  hline(x + 56, x + 112, y + 74, [180, 180, 175]);
  // naval mine in the water ahead of the bow
  disc(x + 156, y + 106, 6, [30, 30, 30]);
  thickLine(x + 150, y + 100, x + 162, y + 112, 2, [30, 30, 30]);
  thickLine(x + 150, y + 112, x + 162, y + 100, 2, [30, 30, 30]);
  // explosion and smoke at the bow
  burst(x + 138, y + 70, 22, 10, 8, [240, 140, 40]);
  burst(x + 138, y + 70, 11, 5, 8, [250, 220, 90]);
  disc(x + 118, y + 52, 11, [80, 80, 80]);
  disc(x + 104, y + 40, 14, [60, 60, 60]);
}

function picRocket(x: number, y: number): void {
  rect(x, y, PW, PH, [18, 24, 48]); // space
  // stars
  const stars: Pt[] = [[14, 12], [44, 26], [96, 10], [150, 30], [130, 52], [24, 48], [70, 60], [158, 66], [36, 84]];
  for (const [sx, sy] of stars) rect(x + sx, y + sy, 2, 2, WHITE);
  // Earth arc at the bottom, clipped to the pictogram box
  polygon(
    [
      [x, y + PH],
      [x + PW, y + PH],
      [x + PW, y + 128],
      [x + 140, y + 120],
      [x + 85, y + 116],
      [x + 30, y + 120],
      [x, y + 128],
    ],
    [31, 78, 121],
  );
  // space station: module + solar panels
  rect(x + 96, y + 30, 58, 14, [190, 190, 185]);
  rect(x + 96, y + 34, 58, 3, [120, 120, 115]);
  rect(x + 104, y + 18, 42, 12, [30, 90, 160]); // panel
  rect(x + 104, y + 44, 42, 12, [30, 90, 160]); // panel
  disc(x + 154, y + 37, 6, [240, 200, 90]);
  // rocket climbing, nose up
  polygon([[x + 42, y + 96], [x + 52, y + 66], [x + 62, y + 96]], [220, 220, 220]); // nose cone
  rect(x + 42, y + 96, 20, 26, [220, 220, 220]); // body
  rect(x + 50, y + 104, 4, 10, [179, 38, 30]); // window stripe
  polygon([[x + 42, y + 122], [x + 34, y + 134], [x + 42, y + 128]], [179, 38, 30]); // fin left
  polygon([[x + 62, y + 122], [x + 70, y + 134], [x + 62, y + 128]], [179, 38, 30]); // fin right
  polygon([[x + 46, y + 122], [x + 58, y + 122], [x + 52, y + 140]], [240, 140, 40]); // flame
  burst(x + 52, y + 128, 10, 5, 6, [250, 220, 90]);
}

function picHighway(x: number, y: number): void {
  rect(x, y, PW, PH, [70, 52, 66]); // dusk
  disc(x + 138, y + 22, 11, [230, 200, 140]); // low sun
  // road
  rect(x, y + 96, PW, 44, [30, 30, 34]);
  for (let i = 0; i < 5; i++) rect(x + 8 + i * 36, y + 116, 18, 3, [220, 200, 90]);
  // overturned tanker: tank on its side, cab crushed beside it
  polygon([[x + 34, y + 96], [x + 120, y + 96], [x + 128, y + 84], [x + 42, y + 84]], [150, 150, 145]); // tank
  rect(x + 122, y + 80, 22, 16, [90, 40, 40]); // cab
  // big flames over the wreck
  burst(x + 80, y + 66, 30, 14, 9, [240, 140, 40]);
  burst(x + 80, y + 66, 16, 8, 9, [250, 220, 90]);
  burst(x + 118, y + 74, 18, 9, 8, [240, 140, 40]);
  // smoke
  disc(x + 60, y + 40, 13, [70, 70, 70]);
  disc(x + 92, y + 28, 16, [55, 55, 55]);
  // charred cars
  rect(x + 10, y + 88, 18, 8, [20, 20, 20]);
  rect(x + 146, y + 90, 16, 6, [20, 20, 20]);
}

function picIsland(x: number, y: number): void {
  rect(x, y, PW, PH, [140, 190, 220]); // sky
  disc(x + 140, y + 22, 11, [250, 220, 120]); // sun
  rect(x, y + 92, PW, 48, [23, 90, 140]); // sea
  thickLine(x + 8, y + 106, x + 60, y + 106, 2, [170, 210, 235]);
  thickLine(x + 110, y + 122, x + 162, y + 122, 2, [170, 210, 235]);
  // island
  polygon([[x + 40, y + 92], [x + 70, y + 58], [x + 110, y + 58], [x + 138, y + 92]], [34, 139, 92]);
  // palm
  thickLine(x + 78, y + 66, x + 78, y + 44, 3, [110, 80, 40]);
  thickLine(x + 78, y + 44, x + 62, y + 36, 3, [20, 110, 60]);
  thickLine(x + 78, y + 44, x + 94, y + 36, 3, [20, 110, 60]);
  thickLine(x + 78, y + 44, x + 78, y + 30, 3, [20, 110, 60]);
  // small base hut, barred: no foreign base
  rect(x + 104, y + 74, 22, 18, [120, 120, 115]);
  polygon([[x + 102, y + 74], [x + 115, y + 64], [x + 128, y + 74]], [90, 90, 88]);
  disc(x + 115, y + 83, 13, [255, 255, 255]);
  disc(x + 115, y + 83, 13, [255, 255, 255]);
  ring(x + 115, y + 83, 12, 3, [179, 38, 30]);
  thickLine(x + 106, y + 92, x + 124, y + 74, 3, [179, 38, 30]);
}

function ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++) {
      px(Math.round(cx + (r + k) * Math.cos(rad)), Math.round(cy + (r + k) * Math.sin(rad)), c);
    }
  }
}

function picFactory(x: number, y: number): void {
  rect(x, y, PW, PH, [214, 196, 160]); // warm sky
  // factory with sawtooth roof
  rect(x + 14, y + 70, 96, 70, [150, 70, 60]);
  polygon([[x + 14, y + 70], [x + 38, y + 50], [x + 62, y + 70]], [120, 55, 48]);
  polygon([[x + 62, y + 70], [x + 86, y + 50], [x + 110, y + 70]], [120, 55, 48]);
  for (let c = 0; c < 4; c++) rect(x + 22 + c * 22, y + 84, 12, 14, [250, 220, 130]);
  // chimney with smoke
  rect(x + 122, y + 34, 14, 106, [110, 55, 48]);
  disc(x + 128, y + 24, 9, [90, 90, 90]);
  disc(x + 140, y + 14, 12, [75, 75, 75]);
  // gold coin with $ and the rise
  disc(x + 138, y + 100, 24, [201, 162, 39]);
  disc(x + 138, y + 100, 19, [240, 200, 90]);
  drawText(x + 132, y + 90, '$', 3, [120, 90, 20]);
  drawText(x + 12, y + 8, '+36%', 2, [14, 107, 92]);
  thickLine(x + 12, y + 48, x + 58, y + 32, 4, [14, 107, 92]);
  polygon([[x + 58, y + 32], [x + 46, y + 30], [x + 58, y + 44]], [14, 107, 92]);
}

function picRefinery(x: number, y: number): void {
  rect(x, y, PW, PH, [28, 34, 52]); // night
  disc(x + 140, y + 22, 10, [220, 190, 130]); // low moon
  rect(x, y + 118, PW, 22, [18, 22, 30]); // ground
  // distillation towers
  rect(x + 30, y + 44, 22, 74, [150, 150, 145]);
  rect(x + 34, y + 36, 14, 8, [150, 150, 145]);
  rect(x + 66, y + 62, 18, 56, [170, 170, 165]);
  rect(x + 70, y + 54, 10, 8, [170, 170, 165]);
  // pipes
  thickLine(x + 52, y + 80, x + 120, y + 80, 4, [110, 110, 105]);
  thickLine(x + 84, y + 80, x + 84, y + 118, 4, [110, 110, 105]);
  // storage tank
  disc(x + 132, y + 104, 18, [130, 130, 125]);
  rect(x + 114, y + 104, 36, 14, [130, 130, 125]);
  // flame at the tall tower
  burst(x + 41, y + 30, 20, 9, 8, [240, 140, 40]);
  burst(x + 41, y + 30, 10, 5, 8, [250, 220, 90]);
  disc(x + 58, y + 18, 10, [70, 70, 70]);
  disc(x + 76, y + 12, 12, [55, 55, 55]);
}

// ---------------------------------------------------------------------------
// The six stories, as reported on 25 November 2026.
// ---------------------------------------------------------------------------

type Story = { tag: string; head: string; sub: string; pic: (x: number, y: number) => void };

const STORIES: Story[] = [
  {
    tag: 'HORMUZ',
    head: 'TANKERS HIT MINES IN HORMUZ',
    sub: "TWO OIL TANKERS EXPLODE AND BURN AFTER STRIKING NAVAL MINES IN THE STRAIT, IRAN'S GUARDS SAY.",
    pic: picTanker,
  },
  {
    tag: 'SPACE',
    head: "PAKISTAN'S FIRST MAN IN ORBIT",
    sub: "SHENZHOU-24 DOCKS AT TIANGONG WITH THE FIRST FOREIGN ASTRONAUT ABOARD CHINA'S STATION.",
    pic: picRocket,
  },
  {
    tag: 'CAIRO',
    head: '31 KILLED IN CAIRO TANKER FIRE',
    sub: 'FUEL TANKER OVERTURNS ON THE RING ROAD AND IGNITES, BURNING DOZENS OF CARS.',
    pic: picHighway,
  },
  {
    tag: 'PACIFIC',
    head: 'PACIFIC PACT BARS FOREIGN BASES',
    sub: 'SOLOMON ISLANDS AND AUSTRALIA SIGN A SECURITY TREATY; HONIARA ENDS ITS 2022 DEAL WITH CHINA.',
    pic: picIsland,
  },
  {
    tag: 'BANGLADESH',
    head: 'GARMENT PAY RISES 36%',
    sub: 'DHAKA LIFTS THE MINIMUM WAGE TO $139 A MONTH AFTER WEEKS OF WORKER PROTESTS.',
    pic: picFactory,
  },
  {
    tag: 'SAUDI ARABIA',
    head: 'HOUTHIS STRIKE SAUDI REFINERY',
    sub: "YEMEN'S HOUTHIS SAY THEY HIT THE RAS TANURA REFINERY; FIRES REPORTED AT THE PLANT.",
    pic: picRefinery,
  },
];

const TICKER =
  'ALSO TODAY: SUDAN DRONE STRIKES KILL 19 CIVILIANS • POPE WARNS AS COP31 TALKS FAIL • US TARIFFS ON BRAZIL • COLOMBIA FREES 76 HOSTAGES';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function drawPanel(px0: number, py0: number, s: Story): void {
  const PW_PANEL = 480;
  const PH_PANEL = 250;
  rect(px0, py0, PW_PANEL, PH_PANEL, CARD);
  // border
  hline(px0, px0 + PW_PANEL - 1, py0, INK);
  hline(px0, px0 + PW_PANEL - 1, py0 + PH_PANEL - 1, INK);
  vline(px0, py0, py0 + PH_PANEL - 1, INK);
  vline(px0 + PW_PANEL - 1, py0, py0 + PH_PANEL - 1, INK);
  // tag chip
  const tagW = textWidth(s.tag, 2) + 16;
  rect(px0 + 12, py0 + 10, tagW, 20, RED);
  drawText(px0 + 20, py0 + 13, s.tag, 2, WHITE);
  // headline, up to two lines
  drawPara(px0 + 12, py0 + 36, s.head, PW_PANEL - 24, 3, 26, INK, 2);
  // pictogram, lower left (170x140)
  const picY = py0 + 98;
  s.pic(px0 + 12, picY);
  // subhead, lower right
  drawPara(px0 + 194, picY + 2, s.sub, PW_PANEL - 206, 2, 18, [40, 40, 40], 6);
}

function drawPage(): void {
  rect(0, 0, W, H, PAPER);

  // Masthead
  rect(0, 0, W, 132, NAVY);
  drawTextCentered(512, 16, 'THE WORLD TODAY', 2, GOLD);
  drawTextCentered(512, 46, 'WEDNESDAY 25 NOVEMBER 2026', 6, WHITE);
  hline(24, 1000, 118, GOLD);
  hline(24, 1000, 122, GOLD);

  // Kicker
  drawTextCentered(512, 142, 'SIX STORIES THAT DEFINED THE DAY', 2, INK);

  // Grid: 2 columns x 3 rows
  const xs = [24, 520];
  const ys = [164, 424, 684];
  for (let i = 0; i < 6; i++) {
    drawPanel(xs[i % 2], ys[Math.floor(i / 2)], STORIES[i]);
  }

  // Ticker
  rect(24, 944, 976, 64, NAVY);
  drawPara(40, 954, TICKER, 944, 2, 20, WHITE, 2);
}

// ---------------------------------------------------------------------------
// PNG encoder (8-bit RGB, filter 0, zlib level 9)
// ---------------------------------------------------------------------------

const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    img.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

drawPage();
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const png = encodePNG();
writeFileSync(join(outDir, 'entry.png'), png);

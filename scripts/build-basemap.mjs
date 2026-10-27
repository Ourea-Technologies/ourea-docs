#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Builds src/data/geo/conus-states.json, the coverage map's outline, from the
// US Census Bureau's cartographic boundary file for states (1:20,000,000),
// which is in the public domain. Run by hand when the source changes:
//
//   curl -sSO https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_20m.zip
//   unzip cb_2024_us_state_20m.zip -d <dir>
//   node scripts/build-basemap.mjs <dir>/cb_2024_us_state_20m
//
// Keeps the 48 contiguous states and DC, simplifies each ring
// (Douglas-Peucker, 0.02°) and rounds to 0.01°: an outline for a small map,
// not a boundary to measure with.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2];
if (!base) {
  console.error('usage: node scripts/build-basemap.mjs <path without extension>');
  process.exit(2);
}
const SOURCE = 'https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_20m.zip';
const NOT_CONUS = new Set(['AK', 'HI', 'PR', 'VI', 'GU', 'MP', 'AS']);

// dBASE attributes: the STUSPS code of each record.
const dbf = readFileSync(`${base}.dbf`);
const nRec = dbf.readUInt32LE(4);
const headerLen = dbf.readUInt16LE(8);
const recLen = dbf.readUInt16LE(10);
const fields = [];
for (let o = 32, at = 1; dbf[o] !== 0x0d; o += 32) {
  const name = dbf.toString('latin1', o, o + 11).replace(/\0.*$/, '');
  const len = dbf[o + 16];
  fields.push({ name, at, len });
  at += len;
}
const code = fields.find((f) => f.name === 'STUSPS');
const codes = Array.from({ length: nRec }, (_, i) => dbf.toString('latin1', headerLen + i * recLen + code.at, headerLen + i * recLen + code.at + code.len).trim());

// Shapefile polygons.
const shp = readFileSync(`${base}.shp`);
const rings = [];
let o = 100;
for (let i = 0; o < shp.length; i++) {
  const len = shp.readInt32BE(o + 4) * 2;
  const c = o + 8;
  if (shp.readInt32LE(c) === 5 && !NOT_CONUS.has(codes[i])) {
    const parts = shp.readInt32LE(c + 36);
    const points = shp.readInt32LE(c + 40);
    const starts = Array.from({ length: parts }, (_, p) => shp.readInt32LE(c + 44 + p * 4));
    const pts = c + 44 + parts * 4;
    for (let p = 0; p < parts; p++) {
      const end = p + 1 < parts ? starts[p + 1] : points;
      const ring = [];
      for (let k = starts[p]; k < end; k++) ring.push([shp.readDoubleLE(pts + k * 16), shp.readDoubleLE(pts + k * 16 + 8)]);
      rings.push({ state: codes[i], ring });
    }
  }
  o = c + len;
}

const simplify = (pts, tol) => {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1;
    let at = -1;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const norm = Math.hypot(dx, dy) || 1;
    for (let k = a + 1; k < b; k++) {
      const d = Math.abs(dy * pts[k][0] - dx * pts[k][1] + bx * ay - by * ax) / norm;
      if (d > best) [best, at] = [d, k];
    }
    if (best > tol) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, k) => keep[k]);
};
// A ring is closed (first point = last), so simplify its two halves, split
// at the point farthest from the start.
const simplifyRing = (ring, tol) => {
  let far = 0;
  let best = -1;
  ring.forEach(([x, y], k) => {
    const d = Math.hypot(x - ring[0][0], y - ring[0][1]);
    if (d > best) [best, far] = [d, k];
  });
  return [...simplify(ring.slice(0, far + 1), tol), ...simplify(ring.slice(far), tol).slice(1)];
};
const round = (v) => Math.round(v * 100) / 100;
const out = rings
  .map(({ state, ring }) => ({ state, ring: simplifyRing(ring, 0.02).map(([x, y]) => [round(x), round(y)]) }))
  .filter((r) => r.ring.length >= 4);

mkdirSync(join(root, 'src/data/geo'), { recursive: true });
writeFileSync(
  join(root, 'src/data/geo/conus-states.json'),
  `${JSON.stringify({
    $comment: 'The 48 contiguous states and DC, simplified (Douglas-Peucker 0.02°, rounded to 0.01°) by scripts/build-basemap.mjs.',
    source: 'U.S. Census Bureau, Cartographic Boundary Files, States, 1:20,000,000 (2024). Public domain.',
    source_url: SOURCE,
    rings: out,
  })}\n`,
);
console.log(`${new Set(out.map((r) => r.state)).size} states, ${out.length} rings, ${out.reduce((a, r) => a + r.ring.length, 0)} points`);

// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The build-time charts draw recorded values and nothing else: each
// recording names its request, date, API version and shape, and the charts'
// vertices are exactly the served values (one per served hour or member
// value, none added between them).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { blendDiagram, coverageMap, fanChart, plumeChart } from '../src/lib/charts.mjs';
import { loadRecording, membersAt } from '../src/lib/recorded.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vertices = (d) => (d.match(/[ML]-?[\d.]+,-?[\d.]+/g) ?? []).length;
const pathOf = (svg, cls) => [...svg.matchAll(new RegExp(`<path class="${cls}" d="([^"]*)"`, 'g'))].map((m) => m[1]);

for (const name of ['fan', 'plume']) {
  test(`recording ${name} says where it came from`, () => {
    const r = loadRecording(root, name);
    assert.match(r.request, /^GET https:\/\/api\.oureawx\.com\/api\/v1\//);
    assert.match(r.recorded_at, /^\d{4}-\d\d-\d\dT/);
    assert.ok(r.api_version, 'api_version');
    assert.equal(r.shape, 'v1');
  });
}

test('fan chart: one vertex per served value, no more', () => {
  const rec = loadRecording(root, 'fan');
  for (const variable of ['temperature', 'snowfall']) {
    const svg = fanChart(rec, variable);
    const hours = rec.response.timeseries.filter((h) => h.ensemble?.[variable]?.p50 != null).length;
    assert.equal(vertices(pathOf(svg, 'median')[0]), hours);
    assert.equal(vertices(pathOf(svg, 'band-outer')[0]), 2 * rec.response.timeseries.filter((h) => h.ensemble?.[variable]?.p10 != null && h.ensemble[variable].p90 != null).length);
  }
});

test('plume chart: one vertex per served member value', () => {
  const rec = loadRecording(root, 'plume');
  let served = 0;
  for (const h of rec.response.timeseries) for (const list of membersAt(h).values()) served += list.filter((m) => m.cumulative_snowfall != null).length;
  const drawn = [...plumeChart(rec).matchAll(/<path class="member[^"]*" d="([^"]*)"/g)].reduce((a, m) => a + vertices(m[1]), 0);
  assert.equal(drawn, served);
});

test('blend diagram and coverage map render', () => {
  assert.match(blendDiagram(loadRecording(root, 'plume')), /<svg[\s\S]*<rect/);
  const geo = JSON.parse(readFileSync(join(root, 'src/data/geo/conus-states.json'), 'utf8'));
  assert.match(geo.source, /Census Bureau/);
  assert.match(coverageMap(geo, { lat: [24, 50], lon: [-125, -66] }), /class="coverage"/);
});

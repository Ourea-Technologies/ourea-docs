#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Records the responses the docs' charts draw, from the live API, into
// src/data/recorded/<name>.json. Run by hand, never in CI:
//
//   node scripts/record-fixtures.mjs            every recording
//   node scripts/record-fixtures.mjs --only plume
//
// Anonymous GETs only, with a generic User-Agent, one request every few
// seconds. Each file keeps the request, the date, the API version the server
// reported (its ETag carries it) and only the fields the charts read, with
// every value exactly as served: the script drops fields, it never changes
// or computes one. Charts read the recordings through src/lib/recorded.mjs.
// A response that is not the v1 shape is refused.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.oureawx.com';
const UA = 'ourea-docs-build (+https://docs.oureawx.com)';
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
const QUANTILES = ['mean', 'min', 'p10', 'p25', 'p50', 'p75', 'p90', 'max'];
const modelRun = (r) => pick(r, ['initialized_at', 'total_members', 'models']);
const MEMBER_FIELDS = ['member_id', 'cumulative_snowfall'];
const members = (m) => m.map((e) => ({ id: e.id, members: e.members.map((x) => pick(x, MEMBER_FIELDS)) }));

const RECORDINGS = {
  // The fan charts: hourly temperature and snowfall quantiles, 72 h.
  fan: {
    path: '/api/v1/locations/or/mt-hood-meadows?max_hours=72&units=imperial',
    keep: (b) => ({
      location: pick(b.location, ['name', 'state', 'slug', 'elevation_m', 'timezone']),
      model_run: modelRun(b.model_run),
      units: b.units,
      timeseries: b.forecast.timeseries.map((t) => ({
        valid_time: t.valid_time,
        lead_time_hours: t.lead_time_hours,
        ensemble: { temperature: pick(t.ensemble.temperature, QUANTILES), snowfall: pick(t.ensemble.snowfall, QUANTILES) },
      })),
    }),
  },
  // The plume chart and the blend diagram: every member, 240 h (the Free horizon).
  plume: {
    path: '/api/v1/locations/or/mt-hood-meadows?daily=false&max_hours=240&members=true&nowcast=false&units=imperial',
    keep: (b) => ({
      location: pick(b.location, ['name', 'state', 'slug', 'elevation_m', 'timezone']),
      model_run: modelRun(b.model_run),
      units: b.units,
      timeseries: b.forecast.timeseries.map((t) => ({ valid_time: t.valid_time, lead_time_hours: t.lead_time_hours, ...(t.members ? { members: members(t.members) } : {}) })),
    }),
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = join(root, 'src/data/recorded');
mkdirSync(outDir, { recursive: true });
let first = true;
for (const [name, rec] of Object.entries(RECORDINGS)) {
  if (only && !only.includes(name)) continue;
  if (!first) await sleep(3000);
  first = false;
  const res = await fetch(`${API}${rec.path}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} for ${rec.path}`);
  const etag = res.headers.get('etag') ?? '';
  const body = await res.json();
  if (!Array.isArray(body.model_run?.models)) throw new Error(`${name}: not a v1 response (no model_run.models[])`);
  const file = {
    $comment: 'Recorded from the live API by scripts/record-fixtures.mjs: only the fields the charts draw, every value as served. Re-record with that script.',
    recorded_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    request: `GET ${API}${rec.path}`,
    api_version: /-v(\d+\.\d+\.\d+)-/.exec(etag)?.[1] ?? null,
    shape: 'v1',
    response: rec.keep(body),
  };
  writeFileSync(join(outDir, `${name}.json`), `${JSON.stringify(file)}\n`);
  console.log(`${name}: ${file.shape}, API ${file.api_version}, ${file.response.timeseries.length} hours`);
}

// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The request builder's output against the docs' mock API, which is stricter
// than the server about canonical form (alphabetical order, no defaults,
// literal ':' and ','): every URL the builder writes must be answered 200.
// And each language snippet must carry the URL exactly as built.
//
//   node --test tests/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { handle } from '../scripts/mock-server.mjs';
import { SNIPPETS } from '../src/lib/builder-snippets.mjs';
import { canonicalQuery, locationPath, probParam, totalsParam } from '../src/lib/canonical.mjs';
import { ALL } from '../src/lib/languages.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spec = YAML.parse(readFileSync(join(root, 'spec/openapi/v1/openapi.yaml'), 'utf8'));
const r = (o) => (o?.$ref ? o.$ref.replace(/^#\//, '').split('/').reduce((a, k) => a[k], spec) : o);
const defaults = Object.fromEntries(
  spec.paths['/api/v1/locations/{state}/{name}'].get.parameters.map(r).filter((p) => p.in === 'query' && r(p.schema ?? {}).default !== undefined).map((p) => [p.name, r(p.schema).default]),
);

const built = [
  { units: 'imperial', prob: probParam([{ variable: 'snowfall', op: 'ge', threshold: 6, window: { start: 0, end: 24 } }], 'imperial') },
  {
    units: 'metric',
    members: true,
    max_hours: 72,
    hourly: true,
    daily: false,
    prob: probParam(
      [
        { variable: 'temperature', op: 'le', threshold: 0, window: { start: 6, end: 18 }, aggregation: 'all' },
        { variable: 'precipitation', op: 'ge', threshold: 10, window: { start: 0, end: 48 } },
        { variable: 'wind_speed', op: 'ge', threshold: 15, window: { start: 0, end: 24 } },
      ],
      'metric',
    ),
    totals: totalsParam([
      { variable: 'snowfall', window: { start: 0, end: 72 } },
      { variable: 'precipitation', window: { start: 24, end: 48 } },
    ]),
  },
];

for (const [i, values] of built.entries()) {
  test(`built URL ${i + 1} is canonical for the mock`, () => {
    const query = canonicalQuery(values, defaults);
    const url = `${locationPath('OR', 'mt-hood-meadows')}?${query}`;
    const res = handle({ url, headers: {} });
    assert.equal(res.status, 200, `${url}: ${res.body}`);
  });
}

test('every language tab has a snippet, and each carries the URL as built', () => {
  const url = 'https://api.oureawx.com/api/v1/locations/or/mt-hood-meadows?prob=snowfall:ge:6.000:24h&units=imperial';
  for (const l of ALL) {
    assert.ok(SNIPPETS[l.slug], `no snippet for ${l.slug}`);
    const code = SNIPPETS[l.slug](url);
    if (l.slug === 'capnp') assert.ok(code.includes('?format=capnp&prob=snowfall:ge:6.000:24h&units=imperial'), code);
    else assert.equal(code.split(url).length - 1, 1, `${l.slug} should carry the URL once`);
  }
});

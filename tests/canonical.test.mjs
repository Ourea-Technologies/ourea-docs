// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The request builder's canonical URLs (src/lib/canonical.mjs) against the
// spec's own test vectors: every getLocationForecast and searchLocations
// vector in canonical/, prob/, totals/ and request/ whose call the builder
// can express. The builder takes thresholds in the request's units, so a
// vector that converts a threshold's unit (6 in on a metric request) is
// out of its scope and listed in SKIP with the reason.
//
//   node --test tests/
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { canonicalQuery, encodeValue, formatThreshold, locationPath, probParam, totalsParam } from '../src/lib/canonical.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vectors = join(root, 'spec/vectors');
const spec = YAML.parse(readFileSync(join(root, 'spec/openapi/v1/openapi.yaml'), 'utf8'));
const resolveRef = (o) => (o?.$ref ? o.$ref.replace(/^#\//, '').split('/').reduce((a, k) => a[k], spec) : o);
const defaultsOf = (path) =>
  Object.fromEntries(
    spec.paths[path].get.parameters
      .map(resolveRef)
      .filter((p) => p.in === 'query')
      .map((p) => [p.name, resolveRef(p.schema ?? {})?.default])
      .filter(([, d]) => d !== undefined),
  );

// The unit each request unit system takes its thresholds in (BEHAVIOR.md section 7).
const REQUEST_UNITS = {
  metric: { temperature: 'degC', wind_speed: 'm/s', snow_level: 'm', precipitation: 'mm', snowfall: 'mm' },
  imperial: { temperature: 'degF', wind_speed: 'mph', snow_level: 'ft', precipitation: 'in', snowfall: 'in' },
};
REQUEST_UNITS.kelvin = { ...REQUEST_UNITS.metric, temperature: 'K' };

const SKIP = {
  'prob/temperature-fahrenheit-on-metric': 'converts a °F threshold to a metric request (the builder takes request units)',
  'prob/threshold-converted-to-request-units': 'converts an inch threshold to a metric request (the builder takes request units)',
  'prob/invalid-aggregation': 'a refusal, tested below',
  'request/point-forecast': 'coordinates (Pro): the builder builds named-location URLs',
  'request/path-segments-encoded': 'tested below by locationPath',
};

const window = (w) => (w ? (w.hours !== undefined ? { start: 0, end: w.hours } : { start: w.start_hours, end: w.end_hours }) : { start: 0, end: 24 });

const forecastUrl = (args) => {
  const units = args.units ?? 'metric';
  const terms = (args.prob ?? []).map((t) => {
    assert.equal(t.threshold.unit, REQUEST_UNITS[units][t.variable], 'threshold unit must be the request unit');
    return { variable: t.variable, op: t.op, threshold: t.threshold.value, window: window(t.window), aggregation: t.aggregation };
  });
  const totals = (args.totals ?? []).map((t) => ({ variable: t.variable, window: window(t.window) }));
  const values = {
    units: args.units,
    max_hours: args.max_hours,
    max_days: args.max_days,
    include_past: args.include_past,
    members: args.members,
    models: args.models,
    nowcast: args.nowcast,
    hourly: args.hourly,
    daily: args.daily,
    prob: terms.length ? probParam(terms, units) : undefined,
    totals: totals.length ? totalsParam(totals) : undefined,
  };
  return { path: locationPath(args.state, args.name), query: canonicalQuery(values, defaultsOf('/api/v1/locations/{state}/{name}')) };
};

const cases = [];
for (const area of ['canonical', 'prob', 'totals', 'request']) {
  for (const f of readdirSync(join(vectors, area)).filter((x) => x.endsWith('.json')).sort()) {
    const v = JSON.parse(readFileSync(join(vectors, area, f), 'utf8'));
    const calls = v.calls ?? [v.call];
    const expects = v.expect_requests ?? [v.expect_request];
    calls.forEach((call, i) => cases.push({ name: v.name, call, expect: expects[i], client: v.client ?? {} }));
  }
}

let covered = 0;
for (const c of cases) {
  const op = c.call.operation;
  if (SKIP[c.name] || (op !== 'getLocationForecast' && op !== 'searchLocations') || !c.expect || c.client.base_url) continue;
  covered++;
  test(`${c.name}: ${op}`, () => {
    if (op === 'searchLocations') {
      const query = canonicalQuery({ q: c.call.args.q, state: c.call.args.state, type: c.call.args.type, limit: c.call.args.limit }, defaultsOf('/api/v1/search/locations'));
      assert.equal(query, c.expect.query_string);
      return;
    }
    const args = { ...c.call.args };
    if (args.location) [args.state, args.name] = args.location.split('/');
    const url = forecastUrl(args);
    assert.equal(url.path, c.expect.path);
    if (c.expect.query_string !== undefined) assert.equal(url.query, c.expect.query_string);
  });
}

test('at least the canonical/ vectors are all covered', () => {
  const canonical = readdirSync(join(vectors, 'canonical')).filter((x) => x.endsWith('.json')).length;
  assert.ok(covered >= canonical, `covered ${covered} calls, fewer than the ${canonical} canonical vectors`);
});

test('prob/invalid-aggregation: any on precipitation is refused before a URL exists', () => {
  assert.throws(() => probParam([{ variable: 'precipitation', op: 'ge', threshold: 10, window: { start: 0, end: 24 }, aggregation: 'any' }], 'metric'), /total/);
  assert.throws(() => probParam([{ variable: 'temperature', op: 'le', threshold: 0, window: { start: 0, end: 24 }, aggregation: 'total' }], 'metric'), /never total/);
});

test('request/path-segments-encoded: both path segments are percent-encoded', () => {
  const v = JSON.parse(readFileSync(join(vectors, 'request/path-segments-encoded.json'), 'utf8'));
  const [state, name] = v.call.args.location ? v.call.args.location.split('/') : [v.call.args.state, v.call.args.name];
  assert.equal(locationPath(state, name), v.expect_request.path);
});

test('threshold rounding: half away from zero in doubles, -0 is 0, exact decimals', () => {
  assert.equal(formatThreshold(1.005, 2), '1.00');
  assert.equal(formatThreshold(0.0625, 3), '0.063');
  assert.equal(formatThreshold(-0.04, 1), '0.0');
  assert.equal(formatThreshold(-5, 1), '-5.0');
  assert.equal(formatThreshold(1524.4, 0), '1524');
  assert.equal(formatThreshold(2.5, 0), '3');
  assert.equal(formatThreshold(-2.5, 0), '-3');
});

test('RFC 3986 encoding: !*\'() are escaped, space is %20', () => {
  assert.equal(encodeValue("a b!*'()"), 'a%20b%21%2A%27%28%29');
});

// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The status Worker's probe, its 24-hour record and what it serves, with a
// stand-in for fetch and an in-memory KV: nothing here calls the API.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../workers/status/index.mjs';
import { CHECKS, KEY, USER_AGENT, badge, blendOf, probe, record, summary } from '../workers/status/status.mjs';

const v1Run = { initialized_at: '2026-11-15T00:00:00Z', total_members: 131, models: [{ id: 'ifs_ens', members: 50, cycle: '2026-11-14T12:00:00Z' }, { id: 'gefs', members: 31 }] };
const preV1Run = { initialized_at: '2026-10-27T00:00:00Z', total_members: 163, source_models: 'aifs,rrfs', aifs_members: 51, rrfs_members: 1, model_cycles: { aifs: '2026-10-26T18:00:00Z', rrfs: '2026-10-27T00:00:00Z' } };

const fakeFetch = (status = 200, run = v1Run) => {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, ua: init.headers['User-Agent'] });
    return new Response(JSON.stringify({ model_run: run }), { status });
  };
  return { fn, calls };
};

test('blendOf reads both response shapes, values unchanged', () => {
  assert.deepEqual(blendOf(v1Run), { initialized_at: v1Run.initialized_at, total_members: 131, models: [{ id: 'ifs_ens', members: 50, cycle: '2026-11-14T12:00:00Z' }, { id: 'gefs', members: 31, cycle: null }] });
  assert.deepEqual(blendOf(preV1Run).models, [{ id: 'aifs', members: 51, cycle: '2026-10-26T18:00:00Z' }, { id: 'rrfs', members: 1, cycle: '2026-10-27T00:00:00Z' }]);
});

test('probe calls every check anonymously with the generic User-Agent', async () => {
  const f = fakeFetch();
  const run = await probe(f.fn);
  assert.equal(f.calls.length, CHECKS.length);
  for (const c of f.calls) {
    assert.match(c.url, /^https:\/\/api\.oureawx\.com\/api\/v1\//);
    assert.equal(c.ua, USER_AGENT);
    assert.doesNotMatch(c.ua, /@/);
  }
  assert.ok(run.results.every((r) => r.ok));
  assert.equal(run.blend.initialized_at, v1Run.initialized_at);
});

test('a failing route is recorded, not thrown', async () => {
  const run = await probe(async () => {
    throw new TypeError('fetch failed');
  });
  assert.ok(run.results.every((r) => !r.ok && r.error === 'network error'));
});

test('record keeps 24 hours; summary counts them', () => {
  const now = Date.parse('2026-11-15T12:00:00Z');
  const old = { at: '2026-11-14T11:00:00Z', results: CHECKS.map((c) => ({ id: c.id, ok: false, status: 503, ms: 1 })), blend: null };
  const fresh = { at: '2026-11-15T12:00:00Z', results: CHECKS.map((c) => ({ id: c.id, ok: true, status: 200, ms: 40 })), blend: blendOf(v1Run) };
  const state = record(record(null, old, Date.parse(old.at)), fresh, now);
  assert.equal(state.history.length, 1, 'the run from 25 h ago is dropped');
  const s = summary(state);
  assert.equal(s.checks[0].ok_runs, 1);
  assert.equal(s.checks[0].runs, 1);
  assert.match(badge(state), /latest blend: 00Z Nov 15 · 2 models/);
});

test('scheduled writes one KV key; fetch serves the JSON and the badge', async () => {
  const kv = new Map();
  const env = { STATUS: { get: async (k) => (kv.has(k) ? JSON.parse(kv.get(k)) : null), put: async (k, v) => kv.set(k, v) } };
  const waits = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch(200, preV1Run).fn;
  try {
    await worker.scheduled({}, env, { waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual([...kv.keys()], [KEY]);
  const data = await (await worker.fetch(new Request('https://docs.oureawx.com/status/data.json'), env)).json();
  assert.equal(data.blend.initialized_at, preV1Run.initialized_at);
  assert.equal(data.checks.length, CHECKS.length);
  const svg = await worker.fetch(new Request('https://docs.oureawx.com/status/badge.svg'), env);
  assert.equal(svg.headers.get('content-type'), 'image/svg+xml');
});

// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The status probe: every few minutes (a cron trigger) it calls a few
// anonymous API routes, records each one's HTTP status and latency, and
// keeps the latest blend run the forecast route reports (model_run). One KV
// key holds the last 24 hours: one write per run, inside the free tier.
// The docs Worker serves the result at /status/data.json and
// /status/badge.svg (workers/docs/index.mjs, through a service binding).

export const API = 'https://api.oureawx.com';
export const USER_AGENT = 'ourea-docs-status (+https://docs.oureawx.com/status/)';
export const KEY = 'status:v1';
export const WINDOW_MS = 24 * 3600 * 1000;
const TIMEOUT_MS = 10_000;

/** What is probed: anonymous, cacheable GETs on canonical URLs. */
export const CHECKS = [
  { id: 'forecast', name: 'Forecast for a named location', path: '/api/v1/locations/or/mt-hood-meadows' },
  { id: 'current', name: 'Current conditions', path: '/api/v1/locations/or/mt-hood-meadows/current' },
  { id: 'search', name: 'Location search', path: '/api/v1/search/locations?q=hood' },
  { id: 'runs', name: 'Available model runs', path: '/api/v1/runs' },
];

/** The blend's composition from a forecast's model_run, v1 or pre-v1 shape. Values as served. */
export const blendOf = (run) => {
  if (!run?.initialized_at) return null;
  const models = Array.isArray(run.models)
    ? run.models.map((m) => ({ id: m.id, members: m.members ?? null, cycle: m.cycle ?? null }))
    : (run.source_models ?? '')
        .split(',')
        .filter(Boolean)
        .map((id) => ({ id, members: run[`${id}_members`] ?? null, cycle: run.model_cycles?.[id] ?? null }));
  return { initialized_at: run.initialized_at, total_members: run.total_members ?? null, models };
};

/** Runs every check once. `fetchFn` is fetch (or a stand-in in tests). */
export const probe = async (fetchFn, now = Date.now()) => {
  const results = [];
  let blend = null;
  for (const c of CHECKS) {
    const started = Date.now();
    try {
      const res = await fetchFn(`${API}${c.path}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      const ms = Date.now() - started;
      if (c.id === 'forecast' && res.ok) blend = blendOf((await res.json())?.model_run);
      else await res.body?.cancel();
      results.push({ id: c.id, status: res.status, ok: res.ok, ms });
    } catch (e) {
      results.push({ id: c.id, status: null, ok: false, ms: Date.now() - started, error: e.name === 'TimeoutError' ? 'timeout' : 'network error' });
    }
  }
  return { at: new Date(now).toISOString(), results, blend };
};

/** Appends a run to the stored state, keeping 24 hours. */
export const record = (state, run, now = Date.now()) => {
  const history = [...(state?.history ?? []), { at: run.at, results: run.results.map(({ id, ok, status, ms }) => ({ id, ok, status, ms })) }].filter((h) => now - Date.parse(h.at) <= WINDOW_MS);
  return { latest: run, blend: run.blend ?? state?.blend ?? null, history };
};

/** The public JSON: the latest run, the blend, and per-check counts over the window. */
export const summary = (state) => {
  if (!state?.latest) return { checks: [], latest: null, blend: null, window_hours: 24 };
  const checks = CHECKS.map((c) => {
    const runs = state.history.map((h) => h.results.find((r) => r.id === c.id)).filter(Boolean);
    const last = state.latest.results.find((r) => r.id === c.id) ?? null;
    return { id: c.id, name: c.name, path: c.path, last, runs: runs.length, ok_runs: runs.filter((r) => r.ok).length };
  });
  return { checked_at: state.latest.at, window_hours: 24, checks, blend: state.blend };
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const runLabel = (iso) => {
  const d = new Date(iso);
  const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${String(d.getUTCHours()).padStart(2, '0')}Z ${mon} ${d.getUTCDate()}`;
};

/** A small shields-style badge: "latest blend | 00Z Oct 27 · 5 models". */
export const badge = (state) => {
  const b = state?.blend;
  const value = b ? `${runLabel(b.initialized_at)} · ${b.models.length} models` : 'unknown';
  const label = 'latest blend';
  const lw = 6 * label.length + 12;
  const vw = Math.round(6.2 * value.length + 12);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + vw}" height="20" role="img" aria-label="${esc(`${label}: ${value}`)}"><title>${esc(`${label}: ${value}`)}</title><rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${vw}" height="20" fill="${b ? '#146a9c' : '#9f9f9f'}"/><g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11"><text x="6" y="14">${esc(label)}</text><text x="${lw + 6}" y="14">${esc(value)}</text></g></svg>`;
};

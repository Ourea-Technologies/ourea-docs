#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// A local stand-in for https://api.oureawx.com, used to run the docs' curl
// and Cap'n Proto examples in CI without touching the real API.
//
// It answers from the shared test vectors in spec/vectors/ (an exact
// path + query match first, then the vector body for the route), and for the
// few routes the vectors carry no body for, from tests/mock-bodies/.
//
// It is STRICTER than the real server on purpose, so an example that would
// cost a cache miss or a 301 fails here:
//   * every query parameter must be one the operation defines (the server
//     also refuses unknown ones: 400 BAD_REQUEST);
//   * parameters must be in alphabetical order and none may be sent at its
//     default (BEHAVIOR.md 3.1; the server serves a reordered URL but it is a
//     separate edge-cache entry);
//   * `prob` and `totals` must use literal ':' and ',';
//   * the state segment must be the lowercase USPS code.
//
// Keys: `mock-pro-key` is Pro, `mock-free-key` is Free, any other X-API-Key
// is 401 INVALID_API_KEY. No key is anonymous (Free tier).
//
//   node scripts/mock-server.mjs [--port 0]   prints "listening <url>"
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spec = YAML.parse(readFileSync(join(root, 'public/openapi/v1/openapi.yaml'), 'utf8'));
const vectorsDir = join(root, 'spec/vectors');
const schemaPath = join(root, 'public/schema/v1/ourea.capnp');
const goldenForecast = join(root, 'examples/capnp/fixtures/forecast_response.v9.bin');

const PRO_KEY = 'mock-pro-key';
const FREE_KEY = 'mock-free-key';

// ── Operations from the spec ────────────────────────────────────────────
const resolveRef = (obj) => {
  if (!obj || !obj.$ref) return obj;
  const path = obj.$ref.replace(/^#\//, '').split('/');
  return path.reduce((o, k) => o[k], spec);
};
const operations = [];
for (const [template, item] of Object.entries(spec.paths)) {
  const op = item.get;
  if (!op) continue;
  const params = (op.parameters ?? []).map(resolveRef);
  const query = new Map(
    params.filter((p) => p.in === 'query').map((p) => [p.name, resolveRef(p.schema ?? {}) ?? {}]),
  );
  const security = op.security ?? spec.security;
  const open = security.length === 0;
  const anonymousOk = open || security.some((s) => Object.keys(s).length === 0);
  const capnpDesc = op.responses?.['200']?.content?.['application/x-capnp']?.schema?.description ?? '';
  const capnpRoot = /root is `(\w+)`/.exec(capnpDesc)?.[1];
  const names = [];
  const regex = new RegExp(
    '^' +
      template.replace(/\{(\w+)\}/g, (_, n) => {
        names.push(n);
        return '([^/]+)';
      }) +
      '$',
  );
  operations.push({ id: op.operationId, template, regex, names, query, open, anonymousOk, capnpRoot });
}
// Templates are anchored and no two v1 templates overlap, so the first match wins.

const matchOperation = (path) => {
  for (const op of operations) {
    const m = op.regex.exec(path);
    if (m) return { op, pathParams: Object.fromEntries(op.names.map((n, i) => [n, m[i + 1]])) };
  }
  return null;
};

// ── Vector responses ────────────────────────────────────────────────────
const vectorFiles = readdirSync(vectorsDir, { recursive: true })
  .filter((f) => f.endsWith('.json') && !f.startsWith('bodies'))
  .map((f) => join(vectorsDir, f));
const exact = new Map();
for (const file of vectorFiles) {
  const v = JSON.parse(readFileSync(file, 'utf8'));
  const reqs = v.expect_requests ?? [v.expect_request];
  reqs.forEach((r, i) => {
    const resp = v.responses?.[i];
    if (!r || !r.path || r.query_string === undefined || !resp || resp.status !== 200) return;
    exact.set(`${r.path}?${r.query_string}`, resp.body_file);
  });
}
const body = (rel) => readFileSync(rel.startsWith('bodies/') ? join(vectorsDir, rel) : join(root, 'tests/mock-bodies', rel));

const fallbackBody = (opId, q) => {
  switch (opId) {
    case 'getLocationForecast':
    case 'getPointForecast':
      if (q.has('totals')) return 'bodies/forecast-totals.json';
      if (q.has('prob')) return q.get('prob').includes('snowfall') ? 'bodies/forecast-prob-snow.json' : 'bodies/forecast-prob-mixed.json';
      return q.get('units') === 'imperial' ? 'bodies/forecast-imperial.json' : 'bodies/forecast-metric.json';
    case 'searchLocations':
      return 'bodies/search.json';
    case 'listCatalogLocations':
    case 'listCatalogStations':
      return q.has('cursor') ? 'bodies/catalog-page-2.json' : 'bodies/catalog-page-1.json';
    case 'getCatalogLocation':
    case 'getCatalogStation':
      return 'bodies/catalog-detail.json';
    case 'getAttribution':
      return 'bodies/attribution.json';
    case 'getCurrentConditions':
    case 'getCurrentByCoordinates':
      return 'current.json';
    case 'getLocationAlerts':
    case 'getAlertsByCoordinates':
      return 'alerts.json';
    case 'getNearbyLocations':
      return 'nearby.json';
    case 'getNearbyByCoordinates':
      return 'nearby-point.json';
    case 'getAvailableRuns':
      return 'runs.json';
    case 'getStormReports':
      return 'storm-reports.json';
    case 'getAllLocations':
    case 'getLocations':
      return 'locations-page.json';
    default:
      return null;
  }
};

// ── Cap'n Proto bodies ──────────────────────────────────────────────────
// ForecastResponse is the golden message from the Ourea repository. Other
// roots have no golden; the mock encodes an empty root of the right type,
// which is enough to prove the example's request and decode command.
const capnpCache = new Map();
const capnpBody = (rootName) => {
  if (rootName === 'ForecastResponse') return readFileSync(goldenForecast);
  if (!capnpCache.has(rootName)) {
    capnpCache.set(rootName, execFileSync('capnp', ['encode', schemaPath, rootName], { input: '()' }));
  }
  return capnpCache.get(rootName);
};

// ── Helpers ─────────────────────────────────────────────────────────────
const error = (status, code, message, extra = {}) => ({
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
  body: Buffer.from(JSON.stringify({ error: code, message })),
});
const defaultOf = (schema) => (schema.default === undefined ? undefined : String(schema.default));

const handle = (req) => {
  const url = new URL(req.url, 'http://mock');
  const rawQuery = url.search.slice(1);
  const match = matchOperation(url.pathname);
  if (!match) return error(404, 'NOT_FOUND', `No route for ${url.pathname}`);
  const { op, pathParams } = match;

  // Query: known names, no repeats, canonical order, no defaults, literal ':' ','.
  const pairs = rawQuery === '' ? [] : rawQuery.split('&').map((kv) => {
    const i = kv.indexOf('=');
    return i < 0 ? [kv, ''] : [kv.slice(0, i), kv.slice(i + 1)];
  });
  const q = new Map();
  for (const [name, raw] of pairs) {
    if (!op.query.has(name)) {
      return error(400, 'BAD_REQUEST', `unknown query parameter '${name}'; this route accepts: ${[...op.query.keys()].sort().join(', ')}`);
    }
    if (q.has(name) && name !== 'capability') return error(400, 'BAD_REQUEST', `repeated query parameter '${name}'`);
    if ((name === 'prob' || name === 'totals') && /%3A|%2C/i.test(raw)) {
      return error(400, 'BAD_REQUEST', `mock: send '${name}' with literal ':' and ',' (BEHAVIOR.md 3.1)`);
    }
    const value = decodeURIComponent(raw);
    if (defaultOf(op.query.get(name)) === value) {
      return error(400, 'BAD_REQUEST', `mock: '${name}=${value}' is the default; omit it (BEHAVIOR.md 3.1)`);
    }
    q.set(name, value);
  }
  const names = pairs.map(([n]) => n);
  if (names.join('&') !== [...names].sort().join('&')) {
    return error(400, 'BAD_REQUEST', `mock: parameters must be in alphabetical order (BEHAVIOR.md 3.1), got ${names.join(',')}`);
  }
  if ('state' in pathParams && !/^[a-z]{2}$/.test(pathParams.state)) {
    return error(400, 'BAD_REQUEST', `mock: state must be the lowercase USPS code, got '${pathParams.state}' (the server would 301)`);
  }

  // Credentials.
  const key = req.headers['x-api-key'];
  let tier = 'anonymous';
  if (key !== undefined) {
    if (key === PRO_KEY) tier = 'pro';
    else if (key === FREE_KEY) tier = 'free';
    else {
      return error(401, 'INVALID_API_KEY', 'The X-API-Key is not a valid, active API key. Check it, or send no key for anonymous Free access.');
    }
  }
  if (!op.anonymousOk && tier !== 'pro') {
    return error(403, 'PRO_REQUIRED', 'This route requires a Pro subscription; authenticate with a Pro API key or session');
  }
  if ((q.get('models') === 'true' || q.has('run')) && tier !== 'pro') {
    return error(403, 'PRO_REQUIRED', '`models` requires a Pro subscription; authenticate with a Pro API key or session, or drop the parameter for the Free forecast');
  }

  // Resource checks the examples rely on.
  if (pathParams.name === 'nowhere') return error(404, 'LOCATION_NOT_FOUND', `No location ${pathParams.state}/nowhere.`);
  if (q.has('lat')) {
    const lat = Number(q.get('lat'));
    const lon = Number(q.get('lon'));
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return error(400, 'INVALID_COORDINATES', `\`lat\` must be a finite number in [-90, 90], got '${q.get('lat')}'`);
    if (lat < 24 || lat > 50 || lon < -125 || lon > -66) {
      return error(404, 'OUTSIDE_COVERAGE', `(${lat}, ${lon}) is outside the forecast coverage window (lat 24..50, lon -125..-66)`);
    }
  }

  // Body.
  let payload;
  let contentType = 'application/json';
  if (q.get('format') === 'capnp') {
    if (!op.capnpRoot) return error(400, 'BAD_REQUEST', 'format: capnp is not served on this route');
    payload = capnpBody(op.capnpRoot);
    contentType = 'application/x-capnp';
  } else {
    const rel = exact.get(`${url.pathname}?${rawQuery}`) ?? fallbackBody(op.id, q);
    if (!rel) return error(501, 'INTERNAL_ERROR', `mock: no body for ${op.id}`);
    payload = body(rel);
  }

  const headers = { 'content-type': contentType };
  headers.etag = `"${createHash('sha256').update(payload).update(tier).digest('hex').slice(0, 32)}"`;
  if (tier === 'anonymous') {
    headers['cache-control'] = 'public, max-age=0, s-maxage=60, stale-while-revalidate=30';
    headers.vary = 'Authorization, X-API-Key, Cookie';
  } else {
    headers['cache-control'] = 'private, max-age=0';
    // Illustrative values only: the real numbers come from the server.
    headers['ratelimit-limit'] = '60';
    headers['ratelimit-remaining'] = '59';
    headers['ratelimit-reset'] = '1';
    headers['ratelimit-policy'] = '60;w=60';
  }
  const inm = req.headers['if-none-match'];
  if (inm && inm.split(',').map((t) => t.trim().replace(/^W\//, '')).includes(headers.etag)) {
    return { status: 304, headers: { etag: headers.etag, 'cache-control': headers['cache-control'] }, body: Buffer.alloc(0) };
  }
  return { status: 200, headers, body: payload };
};

export function startMock(port = 0) {
  const server = createServer((req, res) => {
    let r;
    try {
      r = req.method === 'GET' || req.method === 'HEAD' ? handle(req) : error(405, 'BAD_REQUEST', 'GET only');
    } catch (e) {
      r = error(500, 'INTERNAL_ERROR', `mock: ${e.message}`);
    }
    res.writeHead(r.status, { ...r.headers, 'x-request-id': 'mock-request' });
    res.end(req.method === 'HEAD' ? undefined : r.body);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--port');
  const server = await startMock(i > 0 ? Number(process.argv[i + 1]) : 0);
  console.log(`listening http://127.0.0.1:${server.address().port}`);
  if (!existsSync(goldenForecast)) console.warn('warning: no golden capnp fixture; format=capnp forecasts will fail');
}

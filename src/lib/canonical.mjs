// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The canonical request URL, as the SDKs build it (ensemble-weather-spec
// BEHAVIOR.md section 3.1 and sections 4-5), for the request builder page.
// String formatting only: no forecast value is computed here. Thresholds are
// taken in the request's own units, so no unit is converted either.
// Unit-tested against the spec's canonical/, prob/, totals/ and request/
// vectors (tests/canonical.test.mjs). Runs in the browser: no Node imports.

export const PROB_VARIABLES = ['temperature', 'wind_speed', 'snow_level', 'precipitation', 'snowfall'];
export const TOTAL_VARIABLES = ['precipitation', 'snowfall'];
const AMOUNTS = new Set(['precipitation', 'snowfall']);
const AGGREGATIONS = ['total', 'any', 'all'];
export const MAX_WINDOW_HOURS = 360;

/** Section 4: a threshold's served precision. */
export const decimals = (variable, units) => (AMOUNTS.has(variable) ? (units === 'imperial' ? 3 : 2) : variable === 'snow_level' ? 0 : 1);

/**
 * Section 4: round half away from zero on v * 10^d in doubles (so 1.005 at
 * d = 2 is 1.00, since 1.005 * 100 is 100.4999...), -0 becomes 0, then
 * exactly d decimals, written from the integer so nothing rounds twice.
 */
export const formatThreshold = (v, d) => {
  const x = v * 10 ** d;
  const n = Math.sign(x) * Math.floor(Math.abs(x) + 0.5);
  const digits = String(Math.abs(n)).padStart(d + 1, '0');
  const body = d ? `${digits.slice(0, -d)}.${digits.slice(-d)}` : digits;
  return n < 0 ? `-${body}` : body;
};

/** `<N>h` from the first served hour, or `<A>-<B>h`; 0-24 is `24h`. */
export const formatWindow = ({ start = 0, end }) => (start === 0 ? `${end}h` : `${start}-${end}h`);

export const defaultAggregation = (variable) => (AMOUNTS.has(variable) ? 'total' : 'any');

/** Throws a readable Error for a term the server (and the SDKs) refuse. */
const checkWindow = ({ start = 0, end }) => {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > MAX_WINDOW_HOURS) {
    throw new Error(`a window runs from 0 to ${MAX_WINDOW_HOURS} h and must end after it starts`);
  }
};

/**
 * One `prob` term: { variable, op: 'ge'|'le', threshold: number (request
 * units), window: { start, end }, aggregation? }.
 */
export const probTerm = (t, units) => {
  if (!PROB_VARIABLES.includes(t.variable)) throw new Error(`unknown variable ${t.variable}`);
  if (t.op !== 'ge' && t.op !== 'le') throw new Error('op is ge (at least) or le (at most)');
  if (!Number.isFinite(t.threshold)) throw new Error('the threshold must be a number');
  checkWindow(t.window);
  const aggregation = t.aggregation ?? defaultAggregation(t.variable);
  if (!AGGREGATIONS.includes(aggregation)) throw new Error(`unknown aggregation ${aggregation}`);
  if (AMOUNTS.has(t.variable) !== (aggregation === 'total')) {
    throw new Error(AMOUNTS.has(t.variable) ? `${t.variable} takes the total aggregation only` : `${t.variable} takes any or all, never total`);
  }
  const threshold = formatThreshold(t.threshold, decimals(t.variable, units));
  const tail = aggregation === defaultAggregation(t.variable) ? '' : `:${aggregation}`;
  return {
    text: `${t.variable}:${t.op}:${threshold}:${formatWindow(t.window)}${tail}`,
    key: [t.variable, t.op, t.window.start ?? 0, t.window.end, AGGREGATIONS.indexOf(aggregation), Number(threshold)],
  };
};

const compareKeys = (a, b) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
};
const dedupSorted = (items) => {
  const seen = new Map();
  for (const it of items) if (!seen.has(it.text)) seen.set(it.text, it);
  return [...seen.values()].sort((a, b) => compareKeys(a.key, b.key)).map((it) => it.text);
};

/** Section 4 canonical list: de-duplicated, sorted (variable, op, window, aggregation, threshold), joined by `,`. */
export const probParam = (terms, units) => dedupSorted(terms.map((t) => probTerm(t, units))).join(',');

/** Section 5: `<variable>:<window>`, de-duplicated, sorted by variable then window. */
export const totalsParam = (totals) =>
  dedupSorted(
    totals.map((t) => {
      if (!TOTAL_VARIABLES.includes(t.variable)) throw new Error(`totals are for ${TOTAL_VARIABLES.join(' and ')}`);
      checkWindow(t.window);
      return { text: `${t.variable}:${formatWindow(t.window)}`, key: [t.variable, t.window.start ?? 0, t.window.end] };
    }),
  ).join(',');

/** RFC 3986: unreserved characters as they are, everything else %XX in uppercase hex, space as %20. */
export const encodeValue = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * Section 3.1: no parameter at its default, each once, in alphabetical
 * order, RFC 3986 values; `prob` and `totals` keep literal `:` and `,`.
 * `values`: { name: string | number | boolean | undefined }; `defaults` from
 * the OpenAPI spec.
 */
export const canonicalQuery = (values, defaults = {}) =>
  Object.entries(values)
    .filter(([name, v]) => v !== undefined && v !== null && v !== '' && String(v) !== String(defaults[name]))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, v]) => `${name}=${name === 'prob' || name === 'totals' ? String(v) : encodeValue(String(v))}`)
    .join('&');

/** A named location's path: the state lowercased when it is a two-letter code, both segments percent-encoded. */
export const locationPath = (state, name) => {
  const s = /^[A-Za-z]{2}$/.test(state) ? state.toLowerCase() : state;
  return `/api/v1/locations/${encodeValue(s)}/${encodeValue(name)}`;
};

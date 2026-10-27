// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The response an example gets, shown under it: the task's first curl call
// is answered by the docs' mock API (scripts/mock-server.mjs, which answers
// from the spec's test vectors), and the body is trimmed and annotated for
// reading. Nothing here computes a value: the printer only keeps or drops
// fields and array entries (a probability is kept when its event, threshold
// and window are the ones the request asked for) and writes comments beside
// them. Every number shown is the vector body's own.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { handle } from '../../scripts/mock-server.mjs';
import { API_HOST, forReader, shellCalls } from './reader.mjs';

/**
 * What to keep of a forecast body, mirroring its shape. `true` keeps a
 * value whole; a list keeps those keys of an object; `$first` keeps that many
 * array entries and `$item` is the view of each; `$requested` keeps the
 * entries that answer the request's own `prob=` (or `totals=`) terms.
 */
const FORECAST_VIEW = {
  location: ['slug', 'state', 'name', 'elevation_m', 'timezone'],
  model_run: true,
  units: true,
  forecast: {
    timeseries: { $first: 1, $item: { valid_time: true, lead_time_hours: true, ensemble: { temperature: true } } },
  },
  probabilities: { $requested: 'prob' },
  window_totals: { $requested: 'totals' },
  attribution: ['credit'],
};

/** Comments beside fields, by path (array indexes written as []). */
const NOTES = {
  'model_run.initialized_at': 'the newest contributing model cycle; lead times count from it',
  'model_run.total_members': 'ensemble members pooled from every model in this blend',
  units: (v) => `every value below is in ${UNIT_WORDS[v] ?? 'these units'}`,
  'forecast.timeseries[].valid_time': 'the hour this row describes (UTC)',
  'forecast.timeseries[].ensemble.temperature.p10': 'a realistic low: 1 member in 10 is at or below it',
  'forecast.timeseries[].ensemble.temperature.p50': 'the median: the headline value',
  'forecast.timeseries[].ensemble.temperature.p90': 'a realistic high: 1 member in 10 is above it',
  'forecast.timeseries[].ensemble.temperature.min': 'the most extreme members: often outliers',
  'probabilities[].variable': "the event's variable",
  'probabilities[].op': 'ge: at least the threshold; le: at most',
  'probabilities[].threshold': "the threshold, in the request's units",
  'probabilities[].window_start_hours': 'the window, in hours from the first served hour',
  'probabilities[].aggregation': 'total: the amount summed over the window, per member',
  'probabilities[].from': 'the same window as UTC times',
  'probabilities[].probability': 'the chance, 0 to 1, computed on the server; null means no answer, never 0',
  'probabilities[].members': 'how many ensemble members the chance is computed from',
  'window_totals[].quantiles': "each member's own window total, as quantiles; never a sum of hourly quantiles",
  'attribution.credit': 'carry this with Ourea output you redistribute',
};

// The unit systems' labels (BEHAVIOR.md section 7).
const UNIT_WORDS = { imperial: '°F, in, mph and ft', metric: '°C, mm, m/s and m', kelvin: 'K, mm, m/s and m' };

const termsOf = (query, name) => (query.get(name) ?? '').split(',').filter(Boolean);
/** Does this result answer one of the request's own terms? (Field comparison only.) */
const answersTerm = (entry, terms) =>
  terms.some((t) => {
    const [variable, a, b, c] = t.split(':');
    if ('op' in entry) {
      const window = c ?? '';
      const [start, end] = window.includes('-') ? window.replace('h', '').split('-').map(Number) : [0, Number(window.replace('h', ''))];
      return entry.variable === variable && entry.op === a && Number(entry.threshold) === Number(b) && entry.window_start_hours === start && entry.window_end_hours === end;
    }
    const [start, end] = a.includes('-') ? a.replace('h', '').split('-').map(Number) : [0, Number(a.replace('h', ''))];
    return entry.variable === variable && entry.window_start_hours === start && entry.window_end_hours === end;
  });

const pad = (n) => '  '.repeat(n);
const more = (n, what) => `… ${n} more ${what}${n === 1 ? '' : 's'}`;

/** Indents a printed value's first line, putting a leading note line above the key. */
const indentFirst = (sub, indent, key) => {
  const [first, ...rest] = sub;
  const parts = first.split('\n');
  const last = parts.pop();
  return [...parts.map((p) => indent + p), `${indent}${key}${last}`, ...rest];
};

/** Pretty-prints `value` through `view`, with NOTES as // comments. */
const print = (value, view, path, depth, query, lines, suffix) => {
  const note = typeof NOTES[path] === 'function' ? NOTES[path](value) : NOTES[path];
  // A note goes on its own line above the field (the caller indents it), so
  // the code stays narrow enough for a phone.
  const comment = (s) => (note ? `// ${note}\n${s}` : s);
  // A whole object or array is still walked, so the notes inside it print.
  if (view === true && value && typeof value === 'object') view = Array.isArray(value) ? { $first: value.length } : Object.keys(value);
  if (value === null || typeof value !== 'object') {
    lines.push(comment(`${JSON.stringify(value, null, 2).replace(/\n/g, `\n${pad(depth)}`)}${suffix}`));
    return;
  }
  if (Array.isArray(value)) {
    let items = value;
    let dropped = 0;
    let itemView = true;
    if (view.$requested) {
      items = value.filter((e) => answersTerm(e, termsOf(query, view.$requested)));
    } else if (view.$first) {
      items = value.slice(0, view.$first);
      dropped = value.length - items.length;
      itemView = view.$item ?? true;
    }
    lines.push(comment('['));
    items.forEach((it, i) => {
      const sub = [];
      print(it, itemView, `${path}[]`, depth + 1, query, sub, i < items.length - 1 || dropped ? ',' : '');
      lines.push(...indentFirst(sub, pad(depth + 1), ''));
    });
    if (dropped) lines.push(`${pad(depth + 1)}// ${more(dropped, path.endsWith('timeseries') ? 'hour' : 'entry')}`);
    lines.push(`${pad(depth)}]${suffix}`);
    return;
  }
  const keys = Array.isArray(view) ? view : Object.keys(view);
  const kept = keys.filter((k) => k in value && value[k] !== undefined);
  const omitted = Object.keys(value).length - kept.length;
  lines.push(comment('{'));
  kept.forEach((k, i) => {
    const sub = [];
    const childView = Array.isArray(view) ? true : view[k];
    print(value[k], childView, path ? `${path}.${k}` : k, depth + 1, query, sub, i < kept.length - 1 ? ',' : '');
    lines.push(...indentFirst(sub, pad(depth + 1), `${JSON.stringify(k)}: `));
  });
  if (omitted) lines.push(`${pad(depth + 1)}// ${more(omitted, 'field')}`);
  lines.push(`${pad(depth)}}${suffix}`);
};

/**
 * The annotated response to a task's first curl call:
 * { request, status, source, code } where `code` is JSONC text.
 */
export const annotatedResponse = (root, task) => {
  const manifest = JSON.parse(readFileSync(join(root, 'examples/manifest.json'), 'utf8'));
  const t = manifest.tasks[task];
  if (!t) throw new Error(`unknown example task: ${task}`);
  const call = shellCalls(forReader(readFileSync(join(root, t.curl), 'utf8')))[0];
  const url = new RegExp(`${API_HOST.replace(/[.]/g, '\\.')}(/api/v1/[^"\\s]*)`).exec(call.code)[1];
  const res = handle({ url, headers: {} });
  if (res.status !== 200) throw new Error(`${task}: the mock answered ${url} with ${res.status}`);
  const body = JSON.parse(res.body.toString('utf8'));
  const query = new URL(url, API_HOST).searchParams;
  const lines = [];
  print(body, FORECAST_VIEW, '', 0, query, lines, '');
  return { request: `GET ${url}`, status: res.status, code: `${lines.join('\n')}\n` };
};

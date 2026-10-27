// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The data tables shown on several pages, as rows of inline Markdown. The
// Astro components render them as HTML and the .md / llms-full.txt outputs
// as Markdown, from these same rows, so the two can never disagree.
import limits from '../data/limits.json';
import { sdkIndexData } from './examples';
import { SDKS } from './languages.mjs';

export type Table = { head: string[]; rows: string[][]; note?: string };

const n = (x: number) => x.toLocaleString('en-US');

export const tierTable = (): Table => {
  const f = { outlook_hours: limits.horizon_hours.free, outlook_days: limits.horizon_hours.free / 24 };
  const p = { outlook_hours: limits.horizon_hours.pro, outlook_days: limits.horizon_hours.pro / 24 };
  const pro = '403 `PRO_REQUIRED`';
  return {
    head: ['', 'Anonymous (no key)', 'Free key', 'Pro key'],
    rows: [
      ['Forecast for a named location', 'Yes', 'Yes', 'Yes'],
      ['Forecast horizon (`max_hours` is clamped to it)', `${f.outlook_hours} h (${f.outlook_days} days)`, `${f.outlook_hours} h (${f.outlook_days} days)`, `${p.outlook_hours} h (${p.outlook_days} days)`],
      ['Probabilities (`prob=`) and window totals (`totals=`)', 'Yes', 'Yes', 'Yes'],
      ['Ensemble members (`members=true`)', 'Plume view: temperature, precipitation, snow level, snowfall', 'Plume view', 'Every member variable'],
      ['Per-model breakdowns (`models=true`)', pro, pro, 'Yes'],
      ['A pinned historical run (`run=`)', pro, pro, 'Yes'],
      ['Forecast, current conditions and alerts at coordinates', pro, pro, 'Yes'],
      ['Current conditions and alerts for a named location', 'Yes', 'Yes', 'Yes'],
      ['Search, catalog, nearby, attribution', 'Yes', 'Yes', 'Yes'],
      ['Rate budget', 'Per client address', 'Per account (its keys share it)', 'Per account, larger'],
      ['Responses the edge cache may share', 'Yes: `public` with an `s-maxage`', 'No: `private, max-age=0`', 'No: `private, max-age=0`'],
    ],
  };
};

export const rateLimitTable = (): Table => ({
  head: ['', 'Anonymous', 'Free key', 'Pro key'],
  rows: [
    ['Sustained request rate', `${n(limits.sustained_per_minute)} requests per minute`, `${n(limits.sustained_per_minute)} requests per minute`, 'A larger budget'],
    ['Largest list page', n(limits.list_page_max.anonymous), n(limits.list_page_max.free), '5,000 (the route maximum)'],
  ],
  note: 'Short bursts, a daily quota and an hourly budget of catalog rows also apply. These limits may change: read the `RateLimit-*` headers on each response rather than hard-coding numbers.',
});

export const languageNotes = (slug: string): Table => {
  const s = SDKS.find((x) => x.slug === slug);
  if (!s) throw new Error(`unknown sdk ${slug}`);
  const idx = sdkIndexData[s.refKey];
  const runtime = idx?.runtime
    ? `${idx.runtime} (from the SDK manifest at ${idx.ref})`
    : `Stated in [the README's supported versions](${s.repo}#supported-versions) with the 0.1 release.`;
  const links = [`[Repository](${s.repo})`, `[${s.registry.name}](${s.registry.url})`];
  if (s.reference) links.push(`[Language reference (${s.reference.name})](${s.reference.url})`);
  links.push('[API reference](/api/)', `[${s.label} quickstart](${s.page})`);
  return {
    head: [s.label, ''],
    rows: [
      ['Install', `\`${s.install}\``],
      ['Package', `${s.package} ([${s.registry.name}](${s.registry.url}))`],
      ['Minimum runtime', runtime],
      ['HTTP stack', s.transport],
      ['Async model', `The language's own idiom, documented in [the SDK README](${s.repo}).`],
      ['Units', 'Metric by default; imperial or kelvin per client or per call. The SDK labels each value with its unit and never converts response values: to get other units it asks the server. It converts only your own threshold input (6 in on a metric request becomes 152.40 mm). [Units](/features/units/).'],
      ['Errors', "One error type with categories: authentication, permission, not found, invalid request, outside coverage, rate limited, unavailable, connection and usage. Each carries the HTTP status, the API's code (kept even when the SDK does not know it), the message, the request id and, on 429, the retry delay. The API key never appears in an error. [Errors](/features/errors/)."],
      ['Retries', 'Up to 2 retries (3 attempts) on connection errors, 429, 502, 503 and 504, honouring `Retry-After` up to 60 s, otherwise full-jitter backoff. Nothing else is retried. [Rate limits](/features/rate-limits/).'],
      ['Caching', 'On by default: an in-memory ETag cache (256 entries, 32 MiB) that revalidates every call with `If-None-Match` and serves the stored body on `304`. Replaceable or off. Requests are always canonical URLs, and open routes are sent without the key, so they share edge-cache entries. [Caching and ETags](/features/caching/).'],
      ['Links', links.join(' · ')],
    ],
  };
};

const cell = (s: string) => s.replace(/\|/g, '\\|');
export const toMarkdown = (t: Table): string =>
  [`| ${t.head.map(cell).join(' | ')} |`, `|${t.head.map(() => '---').join('|')}|`, ...t.rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n') +
  (t.note ? `\n\n${t.note}` : '');

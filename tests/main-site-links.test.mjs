// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Links from the docs to the forecast pages on oureawx.com (KAN-3640), and the
// TypeScript SDK's examples linked at its v0.1.0 release tag. Against the built
// site in dist/ (run after `npm run build`): every page's footer links the main
// site's forecast pages; getting started and every SDK page link them in the
// page itself, and in its .md export; none of those links is nofollow.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = (p) => join(root, 'dist', p);
const read = (p) => readFileSync(dist(p), 'utf8');

// Each one checked live: 200, no noindex, its own canonical.
const MAIN_SITE = [
  'https://oureawx.com/forecasts',
  'https://oureawx.com/map',
  'https://oureawx.com/passes',
  'https://oureawx.com/forecast/or/mt-hood-meadows',
  'https://oureawx.com/forecast/or/timberline-lodge',
  'https://oureawx.com/forecast/wa/crystal-mountain-resort',
  'https://oureawx.com/forecast/ut/alta-ski-area',
  'https://oureawx.com/forecast/ca/palisades-tahoe-squaw-valley',
];
const SDK_PAGES = ['python', 'javascript', 'nodejs', 'go', 'csharp', 'java', 'kotlin', 'swift', 'dart', 'r', 'rust'].map((l) => `weather-api/${l}`);
const IN_PAGE = ['getting-started', ...SDK_PAGES];

const hrefs = (html) => new Set([...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]));
// Footer.astro's block, then Starlight's own <footer>.
const FOOTER = 'class="ourea-feedback';
const footer = (html) => html.slice(html.indexOf(FOOTER));
const content = (html) => html.slice(html.indexOf('sl-markdown-content'), html.indexOf(FOOTER));
const missing = (html) => MAIN_SITE.filter((u) => !hrefs(html).has(u));

test('dist/ is built', () => assert.ok(existsSync(dist('index.html')), 'run npm run build first'));

test('the footer links the forecast pages on oureawx.com', () => {
  for (const p of ['', 'getting-started', 'features/errors', 'weather-api/javascript']) {
    assert.deepEqual(missing(footer(read(`${p}${p ? '/' : ''}index.html`))), [], `/${p} footer`);
  }
});

test('getting started and every SDK page link them in the page', () => {
  for (const p of IN_PAGE) assert.deepEqual(missing(content(read(`${p}/index.html`))), [], `/${p}/ content`);
});

test('the .md exports carry the same links', () => {
  for (const p of IN_PAGE) {
    const md = read(`${p}.md`);
    assert.deepEqual(MAIN_SITE.filter((u) => !md.includes(`](${u})`)), [], `/${p}.md`);
  }
});

test('no link to oureawx.com is nofollow', () => {
  for (const p of ['', ...IN_PAGE]) {
    const html = read(`${p}${p ? '/' : ''}index.html`);
    const bad = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]).filter((a) => /href="https:\/\/oureawx\.com/.test(a) && /nofollow/.test(a));
    assert.deepEqual(bad, [], `/${p}`);
  }
});

test('the TypeScript examples link the SDK at its v0.1.0 tag', () => {
  const html = read('weather-api/javascript/index.html');
  const links = [...hrefs(html)].filter((h) => h.startsWith('https://github.com/Ourea-Technologies/ensemble-weather-typescript/blob/'));
  assert.ok(links.length > 0, 'no TypeScript example links');
  assert.deepEqual(links.filter((h) => !h.startsWith('https://github.com/Ourea-Technologies/ensemble-weather-typescript/blob/v0.1.0/examples/')), []);
});

test('the TypeScript pages show the npm install as live', () => {
  for (const p of ['weather-api/javascript', 'weather-api/nodejs']) {
    const html = read(`${p}/index.html`);
    assert.doesNotMatch(html, /Until it is published to the registry/, `/${p}/`);
    assert.match(html, /ensemble-weather 0\.1\.0 is on npm/, `/${p}/`);
  }
});

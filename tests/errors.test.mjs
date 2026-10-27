// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Every error body the API sends carries doc_url = <errors page>#<code in
// lower case>. Against the built site in dist/ (run after `npm run build`):
// the errors page has one section for every code the server can send, as
// recorded from the server by scripts/sync-error-codes.mjs, and no section
// for a code it does not send.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const codes = JSON.parse(readFileSync(join(root, 'src/data/error-codes.json'), 'utf8'));
const page = join(root, 'dist/features/errors/index.html');
const html = () => readFileSync(page, 'utf8');
const all = [...new Set([...codes.public, ...codes.documented, ...codes.flow])].sort();
const anchor = (code) => code.toLowerCase();
const h3Ids = (text) => [...text.matchAll(/<h3\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);

test('dist/ is built', () => assert.ok(existsSync(page), 'run npm run build first'));

test('doc_url points at this page', () => {
  assert.equal(codes.doc_url_base, 'https://docs.oureawx.com/features/errors/');
  assert.equal(codes.anchor, 'lowercase');
});

test('every public spec code has an anchor on the errors page', () => {
  const ids = new Set(h3Ids(html()));
  const missing = codes.public.filter((c) => !ids.has(anchor(c)));
  assert.deepEqual(missing, [], `no #<code> section for: ${missing.join(', ')}`);
});

test('every code the server can send has an anchor on the errors page', () => {
  const ids = new Set(h3Ids(html()));
  const missing = all.filter((c) => !ids.has(anchor(c)));
  assert.deepEqual(missing, [], `no #<code> section for: ${missing.join(', ')}`);
});

test('the page has no section for a code the server does not send', () => {
  const known = new Set(all.map(anchor));
  const extra = h3Ids(html()).filter((id) => !known.has(id));
  assert.deepEqual(extra, [], `sections for unknown codes: ${extra.join(', ')}`);
});

test('each code section states its status and points at request_id', () => {
  const text = html();
  for (const code of all) {
    const start = text.search(new RegExp(`<h3\\b[^>]*\\bid="${anchor(code)}"`));
    const next = text.slice(start + 1).search(/<h[23]\b/);
    const section = text.slice(start, next < 0 ? undefined : start + 1 + next);
    assert.match(section, /<strong>[1-5]\d\d\.<\/strong>/, `${code}: no HTTP status`);
    assert.match(section, /request_id/, `${code}: does not say to quote request_id`);
  }
});

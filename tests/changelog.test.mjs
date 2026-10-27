// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The changelog data and its Atom feed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { CHANGELOG, KINDS } from '../src/data/changelog.mjs';
import { SPEC_PATH, operationsOf } from '../src/lib/code-samples.mjs';
import { atomFeed } from '../src/lib/feed.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ops = new Set(operationsOf(YAML.parse(readFileSync(join(root, SPEC_PATH), 'utf8'))).map((o) => o.id));

test('every entry is dated, kinded, breaking-labelled and names real operations, newest first', () => {
  const slugs = new Set();
  CHANGELOG.forEach((e, i) => {
    assert.match(e.date, /^\d{4}-\d\d-\d\d$/);
    assert.ok(KINDS.includes(e.kind), `${e.slug}: kind ${e.kind}`);
    assert.ok(e.breaking && e.body && e.title);
    for (const o of e.operations) assert.ok(ops.has(o), `${e.slug}: no operation ${o}`);
    assert.ok(!slugs.has(e.slug));
    slugs.add(e.slug);
    if (i > 0) assert.ok(CHANGELOG[i - 1].date >= e.date, 'newest first');
  });
});

test('the Atom feed carries every entry, with escaped content', () => {
  const feed = atomFeed();
  assert.match(feed, /^<\?xml version="1.0" encoding="utf-8"\?>\n<feed xmlns="http:\/\/www.w3.org\/2005\/Atom">/);
  assert.equal((feed.match(/<entry>/g) ?? []).length, CHANGELOG.length);
  assert.doesNotMatch(feed.replace(/<\/?(feed|entry|title|subtitle|id|link|updated|author|name|uri|category|content)\b[^>]*>/g, '').replace(/<\?xml[^>]*>/, ''), /</, 'only Atom elements are unescaped');
});

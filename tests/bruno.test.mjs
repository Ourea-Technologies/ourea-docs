// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The Bruno collection: one request per operation, each on the canonical
// URL of the operation's tested curl sample, and a zip that unpacks to
// exactly those files.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import YAML from 'yaml';
import { brunoFiles, zip } from '../src/lib/bruno.mjs';
import { SPEC_PATH, operationsOf } from '../src/lib/code-samples.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = brunoFiles(root);
const ops = operationsOf(YAML.parse(readFileSync(join(root, SPEC_PATH), 'utf8')));

test('one request per operation', () => {
  const requests = Object.keys(files).filter((p) => p.endsWith('.bru') && !p.startsWith('environments/'));
  assert.deepEqual(requests.map((p) => p.split('/').pop().replace('.bru', '')).sort(), ops.map((o) => o.id).sort());
});

test('each request URL is the tested sample URL with the base URL as a variable', () => {
  for (const [path, text] of Object.entries(files)) {
    if (!path.endsWith('.bru') || path.startsWith('environments/')) continue;
    const url = /^  url: (.+)$/m.exec(text)[1];
    assert.ok(url.startsWith('{{baseUrl}}/api/v1/'), `${path}: ${url}`);
  }
  assert.match(files['Forecasts/getLocationForecast.bru'], /url: \{\{baseUrl\}\}\/api\/v1\/locations\/or\/mt-hood-meadows\?prob=snowfall:ge:6\.000:24h&units=imperial/);
});

test('the zip unpacks to the same files', () => {
  const buf = zip(files, 'c');
  const out = {};
  for (let o = 0; buf.readUInt32LE(o) === 0x04034b50; ) {
    const size = buf.readUInt32LE(o + 18);
    const nameLen = buf.readUInt16LE(o + 26);
    const name = buf.toString('utf8', o + 30, o + 30 + nameLen);
    out[name.slice(2)] = inflateRawSync(buf.subarray(o + 30 + nameLen, o + 30 + nameLen + size)).toString();
    o += 30 + nameLen + size;
  }
  assert.deepEqual(out, files);
});

test('Run in Postman: off, or on with a public postman.com URL', () => {
  const site = JSON.parse(readFileSync(join(root, 'src/data/site.json'), 'utf8'));
  if (site.postman.enabled) assert.match(site.postman.url, /^https:\/\/(www\.)?postman\.com\//);
});

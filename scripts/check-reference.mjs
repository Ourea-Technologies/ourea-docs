#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Checks the built API reference (dist/), after `npm run build`. Fails when:
//   * the served openapi.yaml differs from the pinned spec copy in anything
//     but the x-codeSamples it adds;
//   * an operation has no x-codeSamples, or its first sample is not curl;
//   * a sample's text is not taken from a tested example file (a curl or
//     Cap'n Proto script in reader form, or a synced SDK program);
//   * two samples on one operation would get the same client id in Scalar
//     (the language picker keys on it), or a sample's label is not a tab.
//
//   node scripts/check-reference.mjs [dist]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import YAML from 'yaml';
import { SPEC_PATH, operationsOf, scalarClientId } from '../src/lib/code-samples.mjs';
import { ALL } from '../src/lib/languages.mjs';
import { forReader } from '../src/lib/reader.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(process.argv[2] ?? join(root, 'dist'));
const errors = [];
const fail = (m) => errors.push(m);

const servedPath = join(dist, 'openapi/v1/openapi.yaml');
if (!existsSync(servedPath)) {
  console.error(`FAIL ${servedPath} does not exist; run npm run build first`);
  process.exit(1);
}
const served = YAML.parse(readFileSync(servedPath, 'utf8'));
const pinned = YAML.parse(readFileSync(join(root, SPEC_PATH), 'utf8'));

// 1. Only x-codeSamples was added.
const strip = (v) =>
  Array.isArray(v) ? v.map(strip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'x-codeSamples').map(([k, x]) => [k, strip(x)])) : v;
if (!isDeepStrictEqual(strip(served), pinned)) fail('the served openapi.yaml differs from spec/openapi/v1/openapi.yaml beyond x-codeSamples');

// 2-4. Samples on every operation, each from a tested file.
const walk = (dir) => readdirSync(join(root, dir), { recursive: true }).map((f) => join(dir, String(f)));
const shellTexts = [...walk('examples/curl'), ...walk('examples/capnp/cli')].filter((f) => f.endsWith('.sh')).map((f) => forReader(readFileSync(join(root, f), 'utf8')));
const sdkIndex = JSON.parse(readFileSync(join(root, 'examples/sdk/index.json'), 'utf8'));
const sdkTexts = new Set(Object.values(sdkIndex).flatMap((e) => Object.values(e.tasks)).map((p) => readFileSync(join(root, p), 'utf8')));
const labels = new Map(ALL.map((l) => [l.label, l.slug]));

const ops = operationsOf(served);
let samples = 0;
for (const o of ops) {
  const list = o.op['x-codeSamples'];
  if (!Array.isArray(list) || list.length === 0) {
    fail(`${o.id}: no x-codeSamples`);
    continue;
  }
  if (list[0].label !== 'curl') fail(`${o.id}: the first sample is ${list[0].label}, not curl`);
  const ids = new Map();
  for (const s of list) {
    samples++;
    const slug = labels.get(s.label);
    if (!slug) fail(`${o.id}: sample label "${s.label}" is not a language tab`);
    // Scalar's id for a custom sample: custom/<lang>, then custom/<lang>/1 ...
    const n = ids.get(s.lang) ?? 0;
    ids.set(s.lang, n + 1);
    const id = n === 0 ? `custom/${s.lang}` : `custom/${s.lang}/${n}`;
    if (slug && scalarClientId(slug) !== id) fail(`${o.id}: ${s.label} gets Scalar id ${id}, the page maps it to ${scalarClientId(slug)}`);
    const fromShell = (slug === 'curl' || slug === 'capnp') && shellTexts.some((t) => t === s.source || t.includes(s.source));
    const fromSdk = sdkTexts.has(s.source);
    if (!fromShell && !fromSdk) fail(`${o.id}: the ${s.label} sample is not text from a tested example file`);
  }
}

console.log(`reference: ${ops.length} operations, ${samples} code samples`);
if (errors.length) {
  for (const e of errors) console.error(`FAIL ${e}`);
  process.exit(1);
}
console.log('reference: ok');

#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Records every error code the API server can send, and the docs URL it links
// each one to, in src/data/error-codes.json. tests/errors.test.mjs fails when
// the built errors page (/features/errors/) has no section for one of them,
// because every error body's `doc_url` points at
// https://docs.oureawx.com/features/errors/#<code, lowercase>.
//
//   node scripts/sync-error-codes.mjs --source <server repo> [--ref <commit>]
//   node scripts/sync-error-codes.mjs --source <server repo> [--ref <commit>] --check
//
// Read from the server repository at <ref> (default HEAD), nothing else:
//   * public: the public OpenAPI file's ErrorResponse.error enum
//     (docs/openapi-public.yaml), the codes the public routes can send;
//   * documented: the full OpenAPI file's enum (docs/openapi.yaml), which the
//     server keeps equal to its ERROR_CODES list -- checked here too;
//   * flow: the account flows' own codes (Education Pro, API key creation,
//     billing), sent through the server's `ApiError::Coded` and not in the
//     enum;
//   * doc_url: the base URL and the anchor rule (`to_ascii_lowercase`) from
//     the server's error-envelope module. A change to either fails the sync
//     until it is reviewed here.
// --check re-derives the record and fails if src/data/error-codes.json
// differs (apart from server_commit).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import YAML from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src/data/error-codes.json');
const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const sourceArg = opt('--source');
if (!sourceArg) {
  console.error('usage: node scripts/sync-error-codes.mjs --source <server repo> [--ref <commit>] [--check]');
  process.exit(2);
}
const source = resolve(sourceArg);
const ref = opt('--ref') ?? 'HEAD';
const git = (...a) => execFileSync('git', ['-C', source, ...a], { maxBuffer: 1 << 28 }).toString();
const show = (path) => git('show', `${ref}:${path}`);

const enumOf = (specText, file) => {
  const codes = YAML.parse(specText)?.components?.schemas?.ErrorResponse?.properties?.error?.enum;
  if (!Array.isArray(codes) || codes.length === 0) fail(`${file}: ErrorResponse.error has no enum; review sync-error-codes.mjs`);
  return [...codes].sort();
};

const publicCodes = enumOf(show('docs/openapi-public.yaml'), 'docs/openapi-public.yaml');
const documented = enumOf(show('docs/openapi.yaml'), 'docs/openapi.yaml');

// The server's own list must be the documented enum.
const errorRs = show('src/api/models/error.rs');
const list = /pub const ERROR_CODES: &\[&str\] = &\[([^\]]*)\]/.exec(errorRs);
if (!list) fail('src/api/models/error.rs: ERROR_CODES not found; review sync-error-codes.mjs');
const serverCodes = [...list[1].matchAll(/"([A-Z][A-Z0-9_]*)"/g)].map((m) => m[1]).sort();
if (!isDeepStrictEqual(serverCodes, documented)) fail(`ERROR_CODES (${serverCodes.join(', ')}) differs from docs/openapi.yaml's enum (${documented.join(', ')})`);
const unknownPublic = publicCodes.filter((c) => !documented.includes(c));
if (unknownPublic.length) fail(`public codes missing from the full enum: ${unknownPublic.join(', ')}`);

// The flow codes: `ApiError::Coded { .., code: "X", .. }` and the education
// handler's `refuse(StatusCode::.., "X", ..)`. error.rs is skipped: its only
// Coded literals are its own tests'.
const rsFiles = git('ls-tree', '-r', '--name-only', ref, 'src/')
  .split('\n')
  .filter((p) => p.endsWith('.rs') && p !== 'src/api/models/error.rs');
const flow = new Set();
for (const f of rsFiles) {
  const text = show(f);
  if (!text.includes('Coded')) continue;
  for (const m of text.matchAll(/ApiError::Coded\s*\{[^}]*?\bcode:\s*"([A-Z][A-Z0-9_]*)"/g)) flow.add(m[1]);
  for (const m of text.matchAll(/\brefuse\(\s*(?:StatusCode::)?\w+,\s*"([A-Z][A-Z0-9_]*)"/g)) flow.add(m[1]);
}
const flowCodes = [...flow].filter((c) => !documented.includes(c)).sort();

// The link every error body carries.
const envelope = show('src/api/error_envelope.rs');
const base = /pub const DOCS_ERRORS_URL: &str = "([^"]+)";/.exec(envelope)?.[1];
if (!base) fail('src/api/error_envelope.rs: DOCS_ERRORS_URL not found; review sync-error-codes.mjs');
if (!envelope.includes('format!("{DOCS_ERRORS_URL}#{}", code.to_ascii_lowercase())'))
  fail('src/api/error_envelope.rs: doc_url is no longer DOCS_ERRORS_URL + "#" + the lowercase code; review the anchors and this script');

const record = {
  $comment:
    'Written by scripts/sync-error-codes.mjs from the API server. Every error body carries doc_url = doc_url_base + "#" + the code in lowercase; tests/errors.test.mjs fails unless the errors page has a section with that id for every code here.',
  server_commit: git('rev-parse', '--short=8', ref).trim(),
  doc_url_base: base,
  anchor: 'lowercase',
  public: publicCodes,
  documented,
  flow: flowCodes,
};

if (args.includes('--check')) {
  const have = JSON.parse(readFileSync(out, 'utf8'));
  const strip = ({ server_commit, ...rest }) => rest;
  if (!isDeepStrictEqual(strip(have), strip(record))) fail(`src/data/error-codes.json differs from the server at ${record.server_commit}; re-run the sync`);
  console.log(`error codes match the server at ${record.server_commit}`);
} else {
  writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`wrote src/data/error-codes.json: ${publicCodes.length} public, ${documented.length} documented, ${flowCodes.length} flow codes from ${record.server_commit}`);
}

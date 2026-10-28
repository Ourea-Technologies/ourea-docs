#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Writes spec/ from its two sources:
//
//   * spec/openapi/v1/openapi.yaml, which the site serves (with the tested code
//     samples added, src/pages/openapi/v1/openapi.yaml.ts), the API reference
//     renders and the mock server answers from: the API SERVER's public spec,
//     docs/openapi-public.yaml, read straight from a clone of the server
//     repository at a commit (like scripts/sync-schema.mjs and
//     scripts/sync-error-codes.mjs), recorded in spec/openapi/v1/SOURCE.json;
//   * spec/vectors/ and spec/LICENSE: the shared SDK test vectors of the
//     ensemble-weather-spec repository at the commit in spec/VERSION.
//
// The served OpenAPI file has its maintainer-only text removed (decision and
// file references in descriptions, the generator's header comment). Only
// `description` and `summary` text may change: the script parses both
// documents and refuses to write unless they are identical with those
// strings set aside.
//
// The vectors are blessed against ensemble-weather-spec's own copy of the
// server spec (openapi/v1/openapi.yaml there, byte for byte the server's).
// Both sync and --check refuse when that copy is not the server spec the
// site serves: the mock server's answers and the reference would disagree.
//
//   node scripts/sync-spec.mjs --server <server repo> [--server-ref <commit>]
//                              [--spec-ref <commit>] [--source <spec repo>]
//   node scripts/sync-spec.mjs --check [--server <server repo>]      (CI)
//
// --check re-derives everything: the vectors from ensemble-weather-spec at
// spec/VERSION; the served file from the server repository at the recorded
// commit when --server (or OUREA_SERVER_REPO) is given, else from
// ensemble-weather-spec's copy, which must be the recorded server file
// (source_sha256). The spec repository is a local clone (default
// ../ensemble-weather-spec) or, when that does not exist, a fresh clone of
// the public GitHub repository.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import YAML from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const check = args.includes('--check');
const versionFile = join(root, 'spec', 'VERSION');
const recordFile = join(root, 'spec', 'openapi', 'v1', 'SOURCE.json');
const specRef = opt('--spec-ref') ?? readFileSync(versionFile, 'utf8').trim();
const REMOTE = 'https://github.com/Ourea-Technologies/ensemble-weather-spec';
const SERVER_SPEC = 'docs/openapi-public.yaml';
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

let source = resolve(root, opt('--source') ?? '../ensemble-weather-spec');
if (!existsSync(join(source, '.git'))) {
  source = join(root, '.scratch', 'ensemble-weather-spec');
  rmSync(source, { recursive: true, force: true });
  execFileSync('git', ['clone', '--quiet', REMOTE, source], { stdio: 'inherit' });
}
const git = (...a) => execFileSync('git', ['-C', source, ...a], { maxBuffer: 1 << 28 });

const serverArg = opt('--server') ?? process.env.OUREA_SERVER_REPO;
const server = serverArg ? resolve(serverArg) : null;
const serverGit = (...a) => execFileSync('git', ['-C', server, ...a], { maxBuffer: 1 << 28 });
if (!check && !server) {
  console.error('usage: node scripts/sync-spec.mjs --server <server repo> [--server-ref <commit>] [--spec-ref <commit>] [--source <spec repo>] | --check');
  process.exit(2);
}

// What we copy from ensemble-weather-spec: the vectors. Nothing else in that
// repo is needed to build or test the docs.
const wanted = (p) => p === 'LICENSE' || p.startsWith('vectors/');
const files = git('ls-tree', '-r', '--name-only', specRef).toString().split('\n').filter(Boolean).filter(wanted);

const targets = new Map();
for (const f of files) targets.set(join('spec', f), git('show', `${specRef}:${f}`));

// The server spec: from the server repository (sync, or --check with it), or
// ensemble-weather-spec's copy (--check without it).
const record = check ? JSON.parse(readFileSync(recordFile, 'utf8')) : null;
let serverCommit;
let original;
if (server) {
  serverCommit = serverGit('rev-parse', '--short=12', `${check ? record.server_commit : (opt('--server-ref') ?? 'HEAD')}^{commit}`).toString().trim();
  original = serverGit('show', `${serverCommit}:${SERVER_SPEC}`);
} else {
  serverCommit = record.server_commit;
  original = git('show', `${specRef}:openapi/v1/openapi.yaml`);
}
const specCopy = git('show', `${specRef}:openapi/v1/openapi.yaml`);
if (!specCopy.equals(original))
  fail(
    `ensemble-weather-spec@${specRef}'s openapi/v1/openapi.yaml is not the server's ${SERVER_SPEC} at ${serverCommit}: ` +
      'the vectors were blessed against another contract. Sync ensemble-weather-spec (scripts/sync_openapi.py) and point spec/VERSION at it.',
  );
if (check && sha256(original) !== record.source_sha256) fail(`the server spec (${serverCommit}) is not the one recorded in spec/openapi/v1/SOURCE.json; re-run the sync`);
original = original.toString();

// ── The served OpenAPI file ─────────────────────────────────────────────
const EDITS = [
  [/^# GENERATED by [^\n]*\n/, ''],
  [/^# Do not edit: change the main spec[^\n]*\n/, ''],
  [/ Full client contract, with a\n\s*worked example and the chart recipe:\n\s*`docs\/[\w.-]+\.md`\./, ''],
  [/for the in-vehicle use case \([A-Z]{2,5}\)/g, 'for in-vehicle use'],
  [/\(D-\d+\) -- (\w)/g, (_, c) => c.toUpperCase()],
  [/ \(D-\d+: ([^)]*)\)/g, ' ($1)'],
  [/\n(\s*)\(D-\d+\) /g, '\n$1'],
  [/ \(D-\d+\)/g, ''],
];
const FORBIDDEN = [/\bKAN-\d+/, /\bD-\d+\b/, /\b(docs|src|tests|scripts|terraform)\/[\w.-]+\.(md|py|rs|yaml|tf)\b/];
let served = original;
for (const [re, to] of EDITS) served = served.replace(re, to);
const left = served.split('\n').flatMap((l, i) => (FORBIDDEN.some((re) => re.test(l)) ? [`line ${i + 1}: ${l.trim()}`] : []));
if (left.length) {
  console.error(`maintainer-only text left in the served OpenAPI file; extend EDITS:\n  ${left.join('\n  ')}`);
  process.exit(1);
}
const withoutProse = (v) =>
  Array.isArray(v)
    ? v.map(withoutProse)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'description' || k === 'summary' ? '' : withoutProse(x)]))
      : v;
if (!isDeepStrictEqual(withoutProse(YAML.parse(original)), withoutProse(YAML.parse(served)))) {
  console.error('scrubbing changed the OpenAPI contract itself (not just descriptions); refusing');
  process.exit(1);
}
targets.set(join('spec', 'openapi', 'v1', 'openapi.yaml'), Buffer.from(served));
targets.set(
  join('spec', 'openapi', 'v1', 'SOURCE.json'),
  Buffer.from(
    `${JSON.stringify(
      {
        $comment: `Written by scripts/sync-spec.mjs. openapi.yaml is the API server's ${SERVER_SPEC} at server_commit with maintainer-only description text removed; the vectors come from ensemble-weather-spec at spec/VERSION, whose own copy of the server spec is the same file.`,
        server_commit: serverCommit,
        source_sha256: sha256(original),
        served_sha256: sha256(served),
      },
      null,
      2,
    )}\n`,
  ),
);

if (check) {
  let bad = 0;
  for (const [rel, bytes] of targets) {
    const p = join(root, rel);
    if (!existsSync(p) || !readFileSync(p).equals(bytes)) {
      console.error(`spec drift: ${rel} differs from the server at ${serverCommit} / ensemble-weather-spec at ${specRef}`);
      bad++;
    }
  }
  if (bad) process.exit(1);
  console.log(`spec/ matches the server's ${SERVER_SPEC} at ${serverCommit}${server ? '' : ' (via ensemble-weather-spec)'} and ensemble-weather-spec at ${specRef} (${targets.size} files)`);
} else {
  rmSync(join(root, 'spec'), { recursive: true, force: true });
  for (const [rel, bytes] of targets) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, bytes);
  }
  const full = git('rev-parse', specRef).toString().trim();
  writeFileSync(versionFile, `${full.slice(0, 7)}\n`);
  console.log(`synced spec/openapi from the server at ${serverCommit} and ${targets.size - 2} files from ensemble-weather-spec@${full.slice(0, 7)}`);
}

#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Publishes the server's Cap'n Proto schema at public/schema/v1/ourea.capnp
// with its maintainer-only comments removed, and beside it go.capnp, which
// ourea.capnp imports for its `$Go.name` annotations (go-capnp's std file,
// vendored unchanged in the server repository and published byte for byte) (ticket and decision references,
// notes about the server's own build, tests and deployment). Declarations are
// never touched: only text after a `#` changes, and the script proves it by
// compiling both files and comparing the schema nodes `capnp compile` emits
// (ids, names, ordinals, types, defaults, annotations), ignoring source info
// (where comments live) and byte positions.
//
//   node scripts/sync-schema.mjs --source <server repo> [--ref <commit>]
//   node scripts/sync-schema.mjs --check            (CI)
//
// --check needs only the published file and its record, public/schema/v1/
// SOURCE.json: it re-scrubs nothing, but verifies that the published file
// compiles, carries no maintainer-only text, and has the node digest the sync
// recorded (so a hand edit to a declaration fails CI), and that go.capnp is
// the bytes the sync copied.
// The source is a clone of the server repository, read at <ref> (default
// HEAD) with git, like scripts/sync-error-codes.mjs: schema/ourea.capnp and
// schema/go.capnp.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/schema/v1/ourea.capnp');
const goOut = join(root, 'public/schema/v1/go.capnp');
const record = join(root, 'public/schema/v1/SOURCE.json');
const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);

// ── What must never be published ────────────────────────────────────────
export const FORBIDDEN = [
  /\bKAN-\d+/,
  /\bD-\d+\b/,
  /(^|[\s(,])#\d+[a-z0-9]*\b/,
  /\b9991\b/,
  /127\.0\.0\.1/,
  /\b(docs|src|tests|terraform|scripts)\/[\w./-]+/,
  /\.rs\b/,
  /\w+\/Sources\/\w+/,
  /\bALLOC-\d+/,
  /round-\d+ audit/i,
  /\binternal only\b/i,
  /\bINTERNAL:/,
  /\b(staff|admin)\b/i,
  /UPDATE_GOLDEN|\.lock\b/,
];

// ── The public header that replaces the maintainers' one ────────────────
const HEADER = `# The Ourea weather API's Cap'n Proto schema (API v1).
#
# Every public read route answers \`?format=capnp\` with one standard
# (unpacked) Cap'n Proto message, \`Content-Type: application/x-capnp\`,
# whose root is the route's response struct (ForecastResponse,
# CurrentObservationsResponse, ListLocationsResponse,
# SearchLocationsResponse, ...). It carries the same values as the JSON body,
# under the same auth, rate limits, entitlements and cache policy. Errors stay
# JSON. Guide: https://docs.oureawx.com/capnp/
#
# Versioning: this schema only ever grows.
#  * Field ordinals (@0, @1, ...) never change, and fields are never deleted.
#  * Renaming a field is allowed: the wire format keys on @N, not the name.
#  * A breaking change would be a new struct; none is planned.
#
# Optional fields use the sibling-bool pattern (\`hasFoo\` + \`foo\`), because
# Cap'n Proto has no native Option type. When \`hasFoo\` is false the inner
# value is zero-initialized and must be ignored.
#
# This file imports go.capnp (https://docs.oureawx.com/schema/v1/go.capnp,
# go-capnp's std/go.capnp, unchanged): download it beside this file. Every
# \`hasFoo\` flag carries \`$Go.name("hasFooFlag")\`, so capnpc-go's
# generated \`HasFoo()\` for the pointer field \`foo\` and the flag's accessor
# (\`HasFooFlag()\`) do not collide. Annotations change generated Go names
# only; the wire format and every other language's names are untouched. A Go
# reader adds its own \`$Go.package(...)\` and \`$Go.import(...)\`.
`;

// ── Comment rewriting ────────────────────────────────────────────────────
// Sentence-level notes that only make sense to the server's maintainers,
// matched EXACTLY (in the joined text of a comment block). A server change to
// one of them fails the sync until it is reviewed here.
const BLOCK_EDITS = [
  // Members: the RPC wire-type history and a client-app note.
  [/ALLOC-\d+ \([^)]*audit[^)]*\):\s*/, ''],
  [/ iOS\/Android clients that parsed[^.]*\./, ''],
  [/; the\s+window and the share rule are in docs\/[\w.-]+\.md\s+section \d+\)\./, ').'],
  // Provenance: keep the reader-facing rule, drop the maintainers' rationale.
  [/ \(REST `provenance` on each\s+timeseries point[\s\S]*?ship the reader with it\./,
    ' (REST `provenance`, asked with\n`?diagnostics=provenance`) is not carried in this format: a Cap\'n Proto reader\nmust treat provenance as not reported, never as "nothing happened".'],
  [/ \(docs\/[\w.-]+\.md\)/, ''],
  // HourProvenance: the REST model's source file.
  [/REST `HourProvenance` \(src\/api\/models\/response\.rs documents each\s+list\)/, 'REST `HourProvenance` (the API reference documents each\nlist)'],
  [/the rest of the REST `\/current` body \(#\d+, #\d+, KAN-\d+,\s*KAN-\d+\)\./, 'the rest of the REST `/current` body.'],
  [/ \(#\d+[a-z]\d*\)/, ''],
  [/— KAN-\d+ re-measures it once/, '— it is re-measured once'],
  [/than KAN-\d+(?= --)/, 'than this field'],
  [/KAN-\d+ x KAN-\d+ \(v1 merge\): /, ''],
  [/before KAN-\d+ gave/, 'before a change gave'],
  [/CHANGED in KAN-\d+:/, 'CHANGED:'],
  [/── KAN-\d+: the /g, '── The '],
  [/KAN-\d+ \(REST ([^,()]+), KAN-\d+\): (\w)/g, (_, r, c) => `REST ${r}: ${c}`],
];

// Ticket, decision and issue references anywhere in a comment. A reference
// that opened a line takes its trailing colon with it, and the sentence
// after it is capitalized.
const REFS = [
  [/^([ \t]*)(?:KAN-\d+(?:\/KAN-\d+)*)(?: \((?:beta|D-\d+|\d{4}-\d\d-\d\d)\))?[:.][ \t]*(\S)?/gm, (_, sp, c = '') => sp + c.toUpperCase()],
  [/^([ \t]*)#\d+[a-z0-9]*:[ \t]*(\S)?/gm, (_, sp, c = '') => sp + c.toUpperCase()],
  [/[ \t]*\((?:REST [^,()]+, )?(?:KAN-\d+(?:[/,] ?(?:KAN-)?\d+)*)\)/g, (m) => (m.includes('REST ') ? ` (${/REST [^,()]+/.exec(m)[0]})` : '')],
  [/^([ \t]*)\((?:KAN-\d+(?:[/,] ?(?:KAN-)?\d+)*)\)/gm, '$1'],
  [/[ \t]*\(#\d+(?:, #\d+)*(?:, KAN-\d+)*,?[ \t]*(?:KAN-\d+)?\)/g, ''],
  [/[ \t]*\(D-\d+(?:: [^)]*)?\)/g, ''],
  [/\bD-\d+:?[ \t]*/g, ''],
  [/,?[ \t]*KAN-\d+/g, ''],
  // A removed reference must not leave a line starting with a comma.
  [/\n([ \t]*),[ \t]*/g, ',\n$1'],
];

/** Split a schema line into its code and its comment (no '#' occurs inside a string in this schema). */
const split = (line) => {
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inStr = !inStr;
    else if (line[i] === '#' && !inStr) return [line.slice(0, i), line.slice(i)];
  }
  return [line, ''];
};

export function scrub(src) {
  const lines = src.split('\n');
  // 1. Replace the header: the comment block between `$Cxx.namespace(...)`
  //    and the first section rule (`# ── `).
  const ns = lines.findIndex((l) => l.startsWith('$Cxx.namespace('));
  const firstRule = lines.findIndex((l, i) => i > ns && l.startsWith('# ── '));
  if (ns < 0 || firstRule < 0) throw new Error('schema layout changed: header markers not found; review sync-schema.mjs');
  // The header may hold `using X = import "...";` declarations (the Go
  // annotations' import); they are kept, after the public header. Any other
  // declaration there is a layout change to review.
  const usings = [];
  for (let i = ns + 1; i < firstRule; i++) {
    if (lines[i].trim() === '' || lines[i].startsWith('#')) continue;
    if (/^using \w+ = import "[\w./-]+";$/.test(lines[i])) usings.push(lines[i]);
    else throw new Error(`schema layout changed: a declaration inside the header (line ${i + 1})`);
  }
  const body = [...lines.slice(0, ns + 1), '', ...HEADER.trimEnd().split('\n'), ...(usings.length ? ['', ...usings] : []), '', ...lines.slice(firstRule)];

  // 2. Rewrite comments block by block. A block is a run of whole-line
  //    comments with the same indent; trailing comments are handled alone.
  const result = [];
  for (let i = 0; i < body.length; ) {
    const [code, comment] = split(body[i]);
    if (!comment) {
      result.push(body[i]);
      i++;
      continue;
    }
    if (code.trim() !== '') {
      // Trailing comment after a declaration: rewrite in place, or drop it.
      let text = comment.slice(1);
      for (const [re, to] of [...BLOCK_EDITS, ...REFS]) text = text.replace(re, to);
      text = text.replace(/\s+$/, '');
      result.push(text.trim() === '' ? code.replace(/\s+$/, '') : `${code}#${text}`);
      i++;
      continue;
    }
    // Whole-line comment block.
    const indent = code;
    const block = [];
    while (i < body.length) {
      const [c2, m2] = split(body[i]);
      if (!m2 || c2 !== indent) break;
      if (/^# ──/.test(m2) && block.length) break; // a section rule starts a new block
      block.push(m2.replace(/^# ?/, ''));
      i++;
    }
    if (block.length === 0) {
      result.push(body[i]);
      i++;
      continue;
    }
    // Keep paragraph breaks (empty lines inside the block) and bullet lines.
    const paras = [];
    let cur = [];
    for (const l of block) {
      if (l.trim() === '' || /^\s*[*-] /.test(l)) {
        if (cur.length) paras.push(cur.join('\n'));
        cur = l.trim() === '' ? [] : [l];
        if (l.trim() === '') paras.push('');
      } else cur.push(l);
    }
    if (cur.length) paras.push(cur.join('\n'));
    const rewritten = [];
    for (const p of paras) {
      if (p === '') {
        rewritten.push('');
        continue;
      }
      let text = p;
      for (const [re, to] of [...BLOCK_EDITS, ...REFS]) text = text.replace(re, to);
      text = text.replace(/[ \t]+$/gm, '');
      if (text.trim() === '' || /^[\s.:,;-]*$/.test(text)) continue;
      rewritten.push(text);
    }
    while (rewritten.length && rewritten.at(-1) === '') rewritten.pop();
    while (rewritten.length && rewritten[0] === '') rewritten.shift();
    for (const p of rewritten) for (const l of p.split('\n')) result.push(l === '' ? `${indent}#` : `${indent}# ${l.replace(/^\s+/, (s) => s)}`.replace(/# {2,}(?=\*)/, '#  ').replace(/\s+$/, ''));
  }
  return result.join('\n');
}

// ── Semantic identity: compare the nodes capnp compile emits ────────────
const schemaCapnp = () => {
  for (const p of ['/opt/homebrew/include/capnp/schema.capnp', '/usr/include/capnp/schema.capnp', '/usr/local/include/capnp/schema.capnp']) if (existsSync(p)) return p;
  throw new Error('capnp/schema.capnp not found (install capnproto and libcapnp-dev)');
};

/** A digest of the CodeGeneratorRequest nodes, with source info (comments) and file names removed. */
export function nodeDigest(text, goCapnp = readFileSync(goOut)) {
  const dir = mkdtempSync(join(tmpdir(), 'ourea-schema-'));
  try {
    writeFileSync(join(dir, 'ourea.capnp'), text);
    // ourea.capnp imports "go.capnp" from its own directory.
    writeFileSync(join(dir, 'go.capnp'), goCapnp);
    const req = execFileSync('capnp', ['compile', '-o-', 'ourea.capnp'], { cwd: dir, maxBuffer: 1 << 28 });
    const decoded = execFileSync('capnp', ['decode', schemaCapnp(), 'CodeGeneratorRequest'], { input: req, maxBuffer: 1 << 28 }).toString();
    // Keep only `nodes = [...]`; drop sourceInfo (doc comments, positions),
    // requestedFiles and the compiler version.
    const start = decoded.indexOf('nodes = [');
    if (start < 0) throw new Error('unexpected capnp decode output');
    let depth = 0;
    let end = start + 'nodes = '.length;
    for (; end < decoded.length; end++) {
      const ch = decoded[end];
      if (ch === '[' || ch === '(') depth++;
      else if (ch === ']' || ch === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    // Source positions (startByte/endByte) move when comments change length.
    const nodes = decoded.slice(start, end + 1).replace(/,?\s*(startByte|endByte) = \d+/g, '');
    return { digest: createHash('sha256').update(nodes).digest('hex'), count: (nodes.match(/\bid = /g) ?? []).length };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const forbiddenIn = (text) => {
  const hits = [];
  text.split('\n').forEach((l, i) => {
    const [, comment] = split(l);
    for (const re of FORBIDDEN) if (re.test(comment)) hits.push(`line ${i + 1}: ${l.trim()}`);
  });
  return hits;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (args.includes('--check')) {
    const published = readFileSync(out, 'utf8');
    const rec = JSON.parse(readFileSync(record, 'utf8'));
    const hits = forbiddenIn(published);
    const goBytes = existsSync(goOut) ? readFileSync(goOut) : null;
    const { digest, count } = nodeDigest(published);
    let bad = 0;
    if (hits.length) {
      console.error(`maintainer-only text in the published schema:\n  ${hits.join('\n  ')}`);
      bad++;
    }
    if (digest !== rec.node_digest) {
      console.error(`published schema nodes (${digest}) differ from the synced source's (${rec.node_digest}): a declaration was edited; re-run the sync`);
      bad++;
    }
    if (createHash('sha256').update(published).digest('hex') !== rec.published_sha256) {
      console.error('public/schema/v1/ourea.capnp differs from what the sync wrote; re-run the sync');
      bad++;
    }
    if (!goBytes || createHash('sha256').update(goBytes).digest('hex') !== rec.go_sha256) {
      console.error('public/schema/v1/go.capnp is missing or differs from the server copy the sync wrote; re-run the sync');
      bad++;
    }
    if (bad) process.exit(1);
    console.log(`schema ok: ${count} nodes, identical to the server's (${rec.server_commit}), go.capnp beside it, no maintainer-only comments`);
  } else {
    const sourcePath = opt('--source');
    if (!sourcePath) {
      console.error('usage: node scripts/sync-schema.mjs --source <server repo> [--ref <commit>] | --check');
      process.exit(2);
    }
    const repo = resolve(sourcePath);
    const ref = opt('--ref') ?? 'HEAD';
    const git = (...a) => execFileSync('git', ['-C', repo, ...a], { maxBuffer: 1 << 28 });
    const commit = git('rev-parse', '--short=12', `${ref}^{commit}`).toString().trim();
    const original = git('show', `${commit}:schema/ourea.capnp`).toString();
    const goCapnp = git('show', `${commit}:schema/go.capnp`);
    const published = scrub(original);
    const a = nodeDigest(original, goCapnp);
    const b = nodeDigest(published, goCapnp);
    if (a.digest !== b.digest) {
      console.error('scrubbing changed the schema nodes; refusing to publish');
      process.exit(1);
    }
    const hits = forbiddenIn(published);
    if (hits.length) {
      console.error(`maintainer-only text survived the scrub; extend BLOCK_EDITS:\n  ${hits.join('\n  ')}`);
      process.exit(1);
    }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, published);
    writeFileSync(goOut, goCapnp);
    writeFileSync(
      record,
      `${JSON.stringify(
        {
          $comment: 'Written by scripts/sync-schema.mjs. The published schema is the Ourea server schema with maintainer-only comments removed; node_digest is the sha256 of its compiled schema nodes, identical for both files.',
          server_commit: commit,
          source_sha256: createHash('sha256').update(original).digest('hex'),
          published_sha256: createHash('sha256').update(published).digest('hex'),
          go_sha256: createHash('sha256').update(goCapnp).digest('hex'),
          node_digest: a.digest,
          nodes: a.count,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`published ${out.replace(`${root}/`, '')} and go.capnp from ${commit}: ${a.count} nodes identical to the source; comments scrubbed`);
  }
}

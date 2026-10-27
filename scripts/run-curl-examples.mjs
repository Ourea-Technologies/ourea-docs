#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Runs every shell example (examples/curl/*.sh and examples/capnp/cli/*.sh).
//
//   node scripts/run-curl-examples.mjs            against the local mock server (CI, PRs)
//   node scripts/run-curl-examples.mjs --live     against https://api.oureawx.com, anonymously
//                                                 (the nightly job; never on PRs)
//   --only curl|capnp                             one family
//
// Mock mode runs each script twice, without a key and with the mock Pro key,
// and both must exit 0; a script's `# expect-output: <regex>` line must match
// its output on the keyed run. Live mode runs anonymously only: Pro examples
// print that they need a key and exit 0.
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const live = args.includes('--live');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;

const families = [
  ['curl', join(root, 'examples/curl')],
  ['capnp', join(root, 'examples/capnp/cli')],
].filter(([name]) => !only || only === name);

let server;
let base = 'https://api.oureawx.com';
if (!live) {
  const { startMock } = await import('./mock-server.mjs');
  server = await startMock(0);
  base = `http://127.0.0.1:${server.address().port}`;
}

const expectOf = (text) => {
  const m = /^# expect-output: (.+)$/m.exec(text);
  if (!m) return null;
  let src = m[1].trim();
  let flags = 'm';
  if (src.startsWith('(?i)')) {
    src = src.slice(4);
    flags += 'i';
  }
  return new RegExp(src, flags);
};

const runs = live ? [['anonymous', {}]] : [['anonymous', {}], ['pro key', { OUREA_API_KEY: 'mock-pro-key' }]];
let failed = 0;
let passed = 0;
for (const [family, dir] of families) {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sh')).sort()) {
    const path = join(dir, file);
    const expect = expectOf(readFileSync(path, 'utf8'));
    for (const [label, extra] of runs) {
      const cwd = mkdtempSync(join(tmpdir(), 'ourea-example-'));
      const env = { ...process.env, OUREA_CAPNP_SCHEMA: join(root, 'public/schema/v1/ourea.capnp') };
      delete env.OUREA_API_KEY;
      Object.assign(env, extra);
      if (!live) env.OUREA_BASE_URL = base;
      else delete env.OUREA_BASE_URL;
      // Async, not spawnSync: a blocking spawn would stall the in-process mock server.
      const r = await new Promise((ok) => {
        const child = spawn('bash', [path], { cwd, env });
        let out = '';
        child.stdout.on('data', (d) => (out += d));
        child.stderr.on('data', (d) => (out += d));
        const timer = setTimeout(() => child.kill('SIGKILL'), 60_000);
        child.on('close', (status) => {
          clearTimeout(timer);
          ok({ status, out });
        });
      });
      rmSync(cwd, { recursive: true, force: true });
      const skipped = /needs a Pro API key/.test(r.out);
      const expectFails = Boolean(expect) && !skipped && !expect.test(r.out);
      const name = `${family}/${file} (${label})`;
      if (r.status !== 0 || expectFails) {
        failed++;
        console.error(`FAIL ${name}: exit ${r.status}${expectFails ? `, output does not match ${expect}` : ''}\n${r.out.slice(0, 2000)}`);
      } else {
        passed++;
        console.log(`ok   ${name}${skipped ? ' (skipped: needs a key)' : ''}`);
      }
    }
  }
}
server?.close();
console.log(`\n${passed} passed, ${failed} failed${live ? ' (live, anonymous)' : ' (mock)'}`);
process.exit(failed ? 1 : 0);

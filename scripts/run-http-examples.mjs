#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Runs the no-SDK quickstarts in examples/http/<lang>/ against the local mock
// server (or, with --live, against https://api.oureawx.com anonymously).
//   --only python,go      a subset
//   --allow-missing       a missing toolchain is SKIP instead of FAIL
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const live = args.includes('--live');
const allowMissing = args.includes('--allow-missing');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const dir = (l) => join(root, 'examples/http', l);
const PROB = /chance of at least .* in of snow/;

const dotnetHome = join(homedir(), '.dotnet');
const extraPath = existsSync(dotnetHome) ? `${dotnetHome}:` : '';

const cases = [
  { lang: 'python', tool: 'python3', cmd: ['python3', 'quickstart.py'], expect: PROB },
  { lang: 'javascript', tool: 'node', cmd: ['node', 'quickstart.mjs'], expect: PROB },
  { lang: 'go', tool: 'go', cmd: ['go', 'run', '.'], expect: PROB },
  { lang: 'csharp', tool: 'dotnet', cmd: ['dotnet', 'run', '--nologo'], expect: PROB, env: { DOTNET_ROOT: dotnetHome, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' } },
  { lang: 'java', tool: 'java', cmd: ['java', 'Quickstart.java'], expect: /"probabilities"/ },
  { lang: 'kotlin', tool: 'gradle', cmd: ['gradle', 'run', '-q', '--no-daemon'], expect: PROB },
  { lang: 'swift', tool: 'swift', cmd: ['swift', 'quickstart.swift'], expect: PROB },
].filter((c) => !only || only.includes(c.lang));

const run = (cmd, opts) =>
  new Promise((ok) => {
    const child = spawn(cmd[0], cmd.slice(1), opts);
    let out = '';
    child.stdout?.on('data', (d) => (out += d));
    child.stderr?.on('data', (d) => (out += d));
    child.on('error', (e) => ok({ status: 127, out: String(e) }));
    const timer = setTimeout(() => child.kill('SIGKILL'), 300_000);
    child.on('close', (status) => {
      clearTimeout(timer);
      ok({ status, out });
    });
  });

let server;
let base;
if (!live) {
  const { startMock } = await import('./mock-server.mjs');
  server = await startMock(0);
  base = `http://127.0.0.1:${server.address().port}`;
}

let failed = 0;
for (const c of cases) {
  const env = { ...process.env, PATH: `${extraPath}${process.env.PATH}`, ...(c.env ?? {}) };
  if (base) env.OUREA_BASE_URL = base;
  const which = await run(['sh', '-c', `command -v ${c.tool}`], { env });
  if (which.status !== 0) {
    if (allowMissing) console.log(`SKIP http/${c.lang}: ${c.tool} not installed`);
    else {
      failed++;
      console.error(`FAIL http/${c.lang}: ${c.tool} not installed`);
    }
    continue;
  }
  const r = await run(c.cmd, { cwd: dir(c.lang), env });
  if (r.status !== 0 || !c.expect.test(r.out)) {
    failed++;
    console.error(`FAIL http/${c.lang}: exit ${r.status}\n${r.out.slice(0, 3000)}`);
  } else console.log(`ok   http/${c.lang}`);
}
server?.close();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);

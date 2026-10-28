#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Build and run every Cap'n Proto decoder in examples/capnp/<lang>/ against
// the golden ForecastResponse fixture, and diff each one's output (from a
// file argument and from stdin) against examples/capnp/expected/.
//
//   node scripts/run-capnp-examples.mjs                  # all decoders
//   node scripts/run-capnp-examples.mjs --only rust,go   # a subset (rust, python, cpp, go, kotlin)
//   node scripts/run-capnp-examples.mjs --allow-missing  # SKIP absent toolchains
//
// A decoder whose toolchain is missing FAILS unless --allow-missing is given.
// Exit status is non-zero on any failure. No dependencies beyond Node 22+.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const capnpDir = join(root, 'examples', 'capnp');
const fixture = join(capnpDir, 'fixtures', 'forecast_response.v12.bin');
const expected = readFileSync(join(capnpDir, 'expected', 'forecast_response.v12.txt'), 'utf8');
const BUILD_TIMEOUT_MS = 15 * 60 * 1000;
const RUN_TIMEOUT_MS = 60 * 1000;

const args = process.argv.slice(2);
const allowMissing = args.includes('--allow-missing');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? new Set((args[onlyIdx + 1] ?? '').split(',').filter(Boolean)) : null;

function has(cmd, cmdArgs = ['--version']) {
  const r = spawnSync(cmd, cmdArgs, { stdio: 'ignore' });
  return r.status === 0;
}

function sh(cmd, cmdArgs, opts = {}) {
  return spawnSync(cmd, cmdArgs, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: opts.timeout ?? RUN_TIMEOUT_MS,
    ...opts,
  });
}

const cargoTarget = process.env.CARGO_TARGET_DIR ?? join(root, '.scratch', 'cargo-target');

function pythonCommand() {
  const dir = join(capnpDir, 'python');
  if (has('uv')) {
    return [
      'uv',
      ['run', '-q', '--no-project', '--python', process.env.OUREA_CAPNP_PYTHON ?? '3.13',
        '--with-requirements', join(dir, 'requirements.txt'), 'python', '-I', join(dir, 'decode_forecast.py')],
    ];
  }
  const py = process.env.PYTHON ?? 'python3';
  if (has(py, ['-c', 'import capnp'])) return [py, ['-I', join(dir, 'decode_forecast.py')]];
  return null;
}

const decoders = {
  rust: {
    dir: 'rust',
    missing: () => ['cargo', 'capnp'].filter((c) => !has(c)),
    build: () =>
      sh('cargo', ['build', '-q', '--release', '--locked'], {
        cwd: join(capnpDir, 'rust'),
        env: { ...process.env, CARGO_TARGET_DIR: cargoTarget },
        timeout: BUILD_TIMEOUT_MS,
      }),
    run: () => [join(cargoTarget, 'release', 'ourea-capnp-decode'), []],
  },
  python: {
    dir: 'python',
    missing: () => (pythonCommand() ? [] : ['uv (or a python3 with pycapnp installed)']),
    build: null,
    run: () => pythonCommand(),
  },
  cpp: {
    dir: 'cpp',
    missing: () => {
      const m = ['c++', 'capnp', 'pkg-config'].filter((c) => !has(c));
      if (!m.includes('pkg-config') && !has('pkg-config', ['--exists', 'capnp-rpc'])) m.push('libcapnp-dev (pkg-config capnp-rpc)');
      return m;
    },
    build: () => sh('bash', [join(capnpDir, 'cpp', 'build.sh')], { timeout: BUILD_TIMEOUT_MS }),
    run: () => [join(capnpDir, 'cpp', 'build', 'decode_forecast'), []],
  },
  go: {
    dir: 'go',
    missing: () => ['go', 'capnp'].filter((c) => !has(c, c === 'go' ? ['version'] : ['--version'])),
    build: () => {
      const dir = join(capnpDir, 'go');
      const gen = sh('bash', [join(dir, 'gen.sh')], { cwd: dir, timeout: BUILD_TIMEOUT_MS });
      if (gen.status !== 0) return gen;
      return sh('go', ['build', '-o', join(dir, 'build', 'decode_forecast'), '.'], { cwd: dir, timeout: BUILD_TIMEOUT_MS });
    },
    run: () => [join(capnpDir, 'go', 'build', 'decode_forecast'), []],
  },
  kotlin: {
    dir: 'kotlin',
    missing: () => {
      const m = ['gradle', 'java', 'c++', 'capnp', 'git'].filter((c) => !has(c, c === 'java' ? ['-version'] : ['--version']));
      if (!has('pkg-config', ['--exists', 'capnp'])) m.push('libcapnp-dev (pkg-config capnp)');
      return m;
    },
    build: () => {
      const dir = join(capnpDir, 'kotlin');
      // gen.sh builds capnpc-java from its pinned release tag (or uses $CAPNPC_JAVA).
      const gen = sh('bash', [join(dir, 'gen.sh')], { cwd: dir, timeout: BUILD_TIMEOUT_MS });
      if (gen.status !== 0) return gen;
      return sh('gradle', ['-q', '--no-daemon', 'installDist'], { cwd: dir, timeout: BUILD_TIMEOUT_MS });
    },
    run: () => [join(capnpDir, 'kotlin', 'build', 'install', 'ourea-capnp-decode', 'bin', 'ourea-capnp-decode'), []],
  },
};

let failures = 0;
const results = [];
for (const [name, d] of Object.entries(decoders)) {
  if (only && !only.has(name)) continue;
  if (!existsSync(join(capnpDir, d.dir))) continue;
  const missing = d.missing();
  if (missing.length > 0) {
    if (allowMissing) {
      results.push(`SKIP ${name}: missing ${missing.join(', ')}`);
    } else {
      failures++;
      results.push(`FAIL ${name}: missing toolchain ${missing.join(', ')} (pass --allow-missing to skip)`);
    }
    continue;
  }
  if (d.build) {
    const b = d.build();
    if (b.status !== 0) {
      failures++;
      results.push(`FAIL ${name}: build failed\n${(b.stderr || b.stdout || String(b.error ?? '')).trim()}`);
      continue;
    }
  }
  const [cmd, cmdArgs] = d.run();
  const errors = [];
  const fromFile = sh(cmd, [...cmdArgs, fixture]);
  if (fromFile.status !== 0) errors.push(`file arg: exit ${fromFile.status}\n${fromFile.stderr}`);
  else if (fromFile.stdout !== expected) errors.push(`file arg: output differs\n--- got\n${fromFile.stdout}--- want\n${expected}`);
  const fromStdin = sh(cmd, cmdArgs, { input: readFileSync(fixture) });
  if (fromStdin.status !== 0) errors.push(`stdin: exit ${fromStdin.status}\n${fromStdin.stderr}`);
  else if (fromStdin.stdout !== expected) errors.push(`stdin: output differs\n--- got\n${fromStdin.stdout}--- want\n${expected}`);
  if (errors.length > 0) {
    failures++;
    results.push(`FAIL ${name}:\n${errors.join('\n')}`);
  } else {
    results.push(`PASS ${name}`);
  }
}

console.log(results.join('\n'));
console.log(failures === 0 ? 'capnp decoders: all passed' : `capnp decoders: ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);

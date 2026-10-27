#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Copies each official SDK's examples directory (examples/, or the `examples`
// directory named in sdk-refs.json, such as Dart's example/) into examples/sdk/<lang>/,
// at the ref pinned for that SDK in examples/sdk-refs.json, and writes
// examples/sdk/index.json: which file shows which docs task, plus the minimum
// runtime read from the SDK's own manifest at that ref. The docs pages include
// those files; nothing is pasted by hand.
//
//   node scripts/sync-examples.mjs                 every SDK, from its local clone (or GitHub)
//   node scripts/sync-examples.mjs --only python
//   node scripts/sync-examples.mjs --remote        always clone from GitHub at the ref
//   node scripts/sync-examples.mjs --refs <file>   another refs file (tests)
//
// A ref of null means "nothing released to pin yet": that SDK gets no tab and
// is listed as coming under the examples. Bump a ref by editing sdk-refs.json and
// re-running this script; review the diff of examples/sdk/ like any change.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const remote = args.includes('--remote');

const refsPath = args.includes('--refs') ? resolve(args[args.indexOf('--refs') + 1]) : join(root, 'examples/sdk-refs.json');
const refs = JSON.parse(readFileSync(refsPath, 'utf8'));
const manifest = JSON.parse(readFileSync(join(root, 'examples/manifest.json'), 'utf8'));
const indexPath = join(root, 'examples/sdk/index.json');
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
// Files that are build plumbing, never the program a reader wants to see.
const plumbing = /(^|\/)(go\.(mod|sum)|package(-lock)?\.json|tsconfig[^/]*\.json|Package\.(swift|resolved)|[^/]*\.(csproj|sln|props|lock|toml|gradle|kts)|pom\.xml|README[^/]*|\.gitignore)$/i;

const minimumRuntime = (lang, show, list) => {
  const read = (p) => {
    try {
      return show(p);
    } catch {
      return '';
    }
  };
  const find = (re) => list.filter((p) => re.test(p));
  let m;
  switch (lang) {
    case 'python':
      m = /requires-python\s*=\s*"([^"]+)"/.exec(read('pyproject.toml'));
      return m ? `Python ${m[1]}` : null;
    case 'typescript': {
      const pkg = read('package.json');
      const node = pkg ? JSON.parse(pkg).engines?.node : undefined;
      return node ? `Node.js ${node}` : null;
    }
    case 'go':
      m = /^go\s+(\S+)/m.exec(read('go.mod'));
      return m ? `Go ${m[1]}+` : null;
    case 'dotnet': {
      const tfms = new Set();
      for (const p of find(/^src\/.*\.csproj$/)) {
        for (const t of read(p).matchAll(/<TargetFrameworks?>([^<]+)</g)) t[1].split(';').forEach((x) => tfms.add(x.trim()));
      }
      return tfms.size ? [...tfms].sort().join(', ') : null;
    }
    case 'java':
    case 'kotlin': {
      for (const p of ['build.gradle.kts', 'build.gradle', 'pom.xml', ...find(/build\.gradle(\.kts)?$/)]) {
        const t = read(p);
        m = /jvmToolchain\((\d+)\)/.exec(t) ?? /options\.release(?:\.set\(|\s*=\s*)(\d+)/.exec(t) ?? /<maven\.compiler\.release>(\d+)</.exec(t) ?? /<release>(\d+)</.exec(t) ?? /JavaVersion\.VERSION_(\d+)/.exec(t);
        if (m) return `Java ${m[1]}+`;
      }
      return null;
    }
    case 'dart':
      m = /^\s*sdk:\s*['"]?\^?>?=?\s*(\d+\.\d+)/m.exec(read('pubspec.yaml'));
      return m ? `Dart ${m[1]}+` : null;
    case 'r':
      m = /R \(>= ([\d.]+)\)/.exec(read('DESCRIPTION'));
      return m ? `R ${m[1]}+` : null;
    case 'rust':
      m = /^rust-version\s*=\s*"([^"]+)"/m.exec(read('Cargo.toml'));
      return m ? `Rust ${m[1]}+` : null;
    case 'swift': {
      const t = read('Package.swift');
      m = /swift-tools-version:\s*([\d.]+)/.exec(t);
      if (!m) return null;
      const platforms = [...t.matchAll(/\.(iOS|macOS|tvOS|watchOS|visionOS)\(\.v([\d_]+)\)/g)].map((x) => `${x[1]} ${x[2].replace(/_/g, '.')}`);
      return `Swift ${m[1]}${platforms.length ? ` (${platforms.join(', ')})` : ''}`;
    }
    default:
      return null;
  }
};

for (const [lang, sdk] of Object.entries(refs.sdks)) {
  if (only && !only.includes(lang)) continue;
  const outDir = join(root, 'examples/sdk', lang);
  rmSync(outDir, { recursive: true, force: true });
  if (!sdk.ref) {
    index[lang] = { ref: null, runtime: null, tasks: {} };
    console.log(`${lang}: no ref pinned yet; ${sdk.name} has no tab and is listed as coming`);
    continue;
  }
  let source = resolve(root, sdk.local); // relative to the docs repo, or absolute
  if (remote || !existsSync(join(source, '.git'))) {
    source = join(root, '.scratch', `sdk-${lang}`);
    rmSync(source, { recursive: true, force: true });
    execFileSync('git', ['clone', '--quiet', sdk.repo, source], { stdio: 'inherit' });
  }
  const git = (...a) => execFileSync('git', ['-C', source, ...a], { maxBuffer: 1 << 26 });
  const commit = git('rev-parse', `${sdk.ref}^{commit}`).toString().trim();
  const all = git('ls-tree', '-r', '--name-only', commit).toString().split('\n').filter(Boolean);
  const dir = `${sdk.examples ?? 'examples'}/`;
  const examples = all.filter((p) => p.startsWith(dir));
  for (const p of examples) {
    const dest = join(outDir, p.slice(dir.length));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, git('show', `${commit}:${p}`));
  }

  // One program per example: a file named after it, or the main source file
  // of a directory named after it. Match on the normalized name.
  const programs = new Map();
  for (const p of examples) {
    if (plumbing.test(p) || !p.endsWith(sdk.ext)) continue;
    const rel = p.slice(dir.length);
    const parts = rel.split('/');
    const base = posix.basename(rel, sdk.ext);
    const keys = parts.length === 1 ? [base] : [parts[0], ...(parts.length > 2 ? [parts.at(-2)] : []), base];
    for (const k of keys) {
      const key = norm(k);
      const current = programs.get(key);
      const isMain = /^(main|program|index|app)$/i.test(base) || norm(base) === key;
      if (!current || (isMain && !current.isMain)) programs.set(key, { path: `examples/sdk/${lang}/${rel}`, isMain });
    }
  }
  const tasks = {};
  for (const [task, t] of Object.entries(manifest.tasks)) {
    for (const alias of t.sdk) {
      const hit = programs.get(norm(alias));
      if (hit) {
        tasks[task] = hit.path;
        break;
      }
    }
  }
  index[lang] = {
    ref: sdk.ref,
    commit,
    runtime: minimumRuntime(lang, (p) => git('show', `${commit}:${p}`).toString(), all),
    tasks,
  };
  const missing = Object.keys(manifest.tasks).filter((t) => !tasks[t]);
  console.log(`${lang}@${commit.slice(0, 7)}: ${examples.length} files, ${Object.keys(tasks).length} tasks covered; missing: ${missing.join(', ') || 'none'}`);
}

const sorted = Object.fromEntries(Object.keys(refs.sdks).filter((l) => index[l]).map((l) => [l, index[l]]));
mkdirSync(dirname(indexPath), { recursive: true });
writeFileSync(indexPath, `${JSON.stringify(sorted, null, 2)}\n`);

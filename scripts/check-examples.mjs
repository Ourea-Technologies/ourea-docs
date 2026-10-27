#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The examples gate (CI). Fails when:
//   * a page references an example task, SDK or language that does not exist;
//   * a file named by examples/manifest.json, examples/sdk/index.json or
//     src/lib/examples.ts does not exist;
//   * a manifest task lacks its curl file, or its Cap'n Proto file while a
//     route it calls serves format=capnp;
//   * src/data/limits.json disagrees with what the public OpenAPI spec states;
//   * any example fails when run (curl and Cap'n Proto CLI scripts against
//     the mock server, the no-SDK quickstarts, the Cap'n Proto decoders).
//
//   node scripts/check-examples.mjs                 everything
//   node scripts/check-examples.mjs --static        references only, run nothing
//   node scripts/check-examples.mjs --run curl,http,capnp   which runners (default all)
//   --allow-missing                                 passed to the runners: a missing toolchain is SKIP
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { SPEC_PATH, operationsOf } from '../src/lib/code-samples.mjs';
import { forReader, shellCalls } from '../src/lib/reader.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const staticOnly = args.includes('--static');
const runners = (args.includes('--run') ? args[args.indexOf('--run') + 1] : 'curl,http,capnp').split(',');
const passthrough = args.includes('--allow-missing') ? ['--allow-missing'] : [];

const errors = [];
const fail = (m) => errors.push(m);
const read = (p) => readFileSync(join(root, p), 'utf8');
const exists = (p) => existsSync(join(root, p));

const manifest = JSON.parse(read('examples/manifest.json'));
const sdkIndex = JSON.parse(read('examples/sdk/index.json'));
const refs = JSON.parse(read('examples/sdk-refs.json'));
const tasks = manifest.tasks;

// 1. Manifest files. A task may go without a Cap'n Proto example only when
// every route its curl example calls serves no Cap'n Proto body, and without
// SDK example names only when every route is outside the SDKs' scope
// (BEHAVIOR.md section 3: getMapsToken).
const OUT_OF_SDK_SCOPE = new Set(['getMapsToken']);
const specDoc = YAML.parse(read(SPEC_PATH));
const specOps = operationsOf(specDoc);
const opsCalled = (file) => shellCalls(forReader(read(file))).map((c) => specOps.find((o) => o.regex.test(c.path)));
for (const [name, t] of Object.entries(tasks)) {
  if (!t.curl) fail(`manifest task ${name}: no curl example`);
  else if (!exists(t.curl)) fail(`manifest task ${name}: ${t.curl} does not exist`);
  const called = t.curl && exists(t.curl) ? opsCalled(t.curl) : [];
  if (called.some((o) => !o)) fail(`manifest task ${name}: ${t.curl} calls a path no operation in the spec matches`);
  if (t.jq && !exists(t.jq)) fail(`manifest task ${name}: ${t.jq} does not exist`);
  if (t.capnp) {
    if (!exists(t.capnp)) fail(`manifest task ${name}: ${t.capnp} does not exist`);
  } else if (called.some((o) => o?.op.responses?.['200']?.content?.['application/x-capnp'])) {
    fail(`manifest task ${name}: no Cap'n Proto example, but a route it calls serves format=capnp`);
  }
  if (!Array.isArray(t.sdk)) fail(`manifest task ${name}: sdk must be a list of example names`);
  else if (t.sdk.length === 0 && !called.every((o) => o && OUT_OF_SDK_SCOPE.has(o.id))) fail(`manifest task ${name}: no SDK example names`);
}
// Every shell example is in the manifest (no orphans that CI runs but no page shows).
for (const dir of ['examples/curl', 'examples/capnp/cli']) {
  for (const f of readdirSync(join(root, dir)).filter((x) => x.endsWith('.sh'))) {
    const rel = `${dir}/${f}`;
    if (!Object.values(tasks).some((t) => t.curl === rel || t.jq === rel || t.capnp === rel)) fail(`${rel} is not in examples/manifest.json`);
  }
}

// 2. Synced SDK examples.
for (const [lang, entry] of Object.entries(sdkIndex)) {
  if (!refs.sdks[lang]) fail(`examples/sdk/index.json: ${lang} is not in sdk-refs.json`);
  if (entry.ref !== (refs.sdks[lang]?.ref ?? null)) fail(`examples/sdk/index.json: ${lang} synced at ${entry.ref}, sdk-refs.json pins ${refs.sdks[lang]?.ref}; run scripts/sync-examples.mjs`);
  for (const [task, path] of Object.entries(entry.tasks)) {
    if (!tasks[task]) fail(`examples/sdk/index.json: ${lang} maps unknown task ${task}`);
    if (!exists(path)) fail(`examples/sdk/index.json: ${lang}/${task}: ${path} does not exist`);
  }
}
for (const lang of Object.keys(refs.sdks)) if (!sdkIndex[lang]) fail(`examples/sdk/index.json has no entry for ${lang}; run scripts/sync-examples.mjs`);

// 3. Paths named in src/lib/examples.ts (no-SDK quickstarts, decoders).
const libSrc = read('src/lib/examples.ts');
for (const m of libSrc.matchAll(/'(examples\/[^']+)'/g)) if (!exists(m[1])) fail(`src/lib/examples.ts names ${m[1]}, which does not exist`);
const httpLangs = new Set([...libSrc.matchAll(/^ {2}(\w+): \{ path: 'examples\/http\//gm)].map((m) => m[1]));

// 4. Page references.
const sdkSlugs = new Set(['python', 'typescript', 'go', 'csharp', 'java', 'kotlin', 'swift']);
const pages = readdirSync(join(root, 'src/content/docs'), { recursive: true }).filter((f) => /\.mdx?$/.test(f));
let refsSeen = 0;
for (const f of pages) {
  const rel = relative(root, join(root, 'src/content/docs', f));
  const text = readFileSync(join(root, 'src/content/docs', f), 'utf8');
  for (const m of text.matchAll(/<(Example|ExampleResponse|SdkExample|HttpExample|LanguageNotes)\b([^>]*)\/>/g)) {
    refsSeen++;
    const a = Object.fromEntries([...m[2].matchAll(/(\w+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
    if (['Example', 'ExampleResponse', 'SdkExample'].includes(m[1]) && !tasks[a.task]) fail(`${rel}: <${m[1]} task="${a.task}"> is not in examples/manifest.json`);
    if ((m[1] === 'SdkExample' || m[1] === 'LanguageNotes') && !sdkSlugs.has(a.sdk)) fail(`${rel}: <${m[1]} sdk="${a.sdk}"> is not an SDK`);
    if (m[1] === 'HttpExample' && !httpLangs.has(a.lang)) fail(`${rel}: <HttpExample lang="${a.lang}"> has no file`);
  }
  // A code fence that looks like a pasted example (a curl call) must be a short
  // illustration, not a copy of an example file: the files are the source.
  for (const m of text.matchAll(/```bash\n([\s\S]*?)```/g)) {
    if ((m[1].match(/\bcurl\b/g) ?? []).length > 1) fail(`${rel}: a fenced block with several curl calls; use <Example task=...> instead`);
  }
}

// 5. Published limits: each one the spec states must still be stated there.
try {
  const limits = JSON.parse(read('src/data/limits.json'));
  const spec = read('spec/openapi/v1/openapi.yaml');
  const { free, pro } = limits.horizon_hours;
  if (!spec.includes(`Free ${free}, Pro ${pro}`)) fail(`src/data/limits.json: the OpenAPI spec no longer says the horizon is "Free ${free}, Pro ${pro}"`);
  const { anonymous, free: freePage } = limits.list_page_max;
  if (!spec.includes(`at most ${anonymous}\n        for anonymous and ${freePage} for Free`) && !spec.includes(`Capped at ${anonymous} for anonymous and ${freePage}`)) {
    fail(`src/data/limits.json: the OpenAPI spec no longer states list pages of ${anonymous} (anonymous) and ${freePage} (Free)`);
  }
  if (limits.sustained_per_minute !== 60) fail('src/data/limits.json: the documented sustained limit is 60 requests per minute');
} catch (e) {
  fail(`src/data/limits.json: ${e.message}`);
}

console.log(`static: ${Object.keys(tasks).length} tasks, ${pages.length} pages, ${refsSeen} example references`);
if (errors.length) {
  for (const e of errors) console.error(`FAIL ${e}`);
  process.exit(1);
}
console.log('static: ok');
if (staticOnly) process.exit(0);

// 6. Run them.
const scripts = { curl: 'run-curl-examples.mjs', http: 'run-http-examples.mjs', capnp: 'run-capnp-examples.mjs' };
let bad = 0;
for (const r of runners) {
  const script = scripts[r];
  if (!script) {
    console.error(`unknown runner ${r}`);
    bad++;
    continue;
  }
  const extra = r === 'curl' ? [] : passthrough;
  console.log(`\n== ${script} ${extra.join(' ')}`);
  const res = spawnSync(process.execPath, [join(root, 'scripts', script), ...extra], { stdio: 'inherit', timeout: 1_800_000 });
  if (res.status !== 0) bad++;
}
process.exit(bad ? 1 : 0);

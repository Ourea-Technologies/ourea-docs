// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Resolves a docs task (examples/manifest.json) to the code each tab shows.
// Every snippet is a file in examples/: the curl and Cap'n Proto scripts in
// this repo, and the SDK programs synced from each SDK repo at a pinned ref
// (scripts/sync-examples.mjs -> examples/sdk/index.json). Nothing is pasted.
import manifest from '../../examples/manifest.json';
import sdkIndex from '../../examples/sdk/index.json';
import refs from '../../examples/sdk-refs.json';
import { SDKS, TRANSPORTS } from './languages.mjs';
import { forReader } from './reader.mjs';

const files = import.meta.glob(['/examples/**/*.{sh,py,ts,js,mjs,go,cs,java,kt,kts,swift,rs,c++,toml,in,txt}', '!**/build/**', '!**/bin/**', '!**/obj/**', '!**/.gradle/**', '!**/.kotlin/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export type Task = keyof typeof manifest.tasks;
export interface TabCode {
  slug: string;
  label: string;
  hl: string;
  path?: string;
  code?: string;
  placeholder?: string;
  repo?: string;
  sourceUrl?: string;
}

export const raw = (path: string): string => {
  const text = files[`/${path}`];
  if (text === undefined) throw new Error(`example file not found: ${path}`);
  return text;
};

export { forReader };

const sdkTab = (task: Task, sdk: (typeof SDKS)[number]): TabCode => {
  const entry = (sdkIndex as Record<string, { ref: string | null; commit?: string; tasks: Record<string, string> }>)[sdk.refKey];
  const base = { slug: sdk.slug, label: sdk.label, hl: sdk.hl, repo: sdk.repo };
  const path = entry?.tasks?.[task];
  if (manifest.tasks[task].sdk.length === 0) {
    return { ...base, placeholder: 'This route is outside the SDKs\' scope. The curl tab shows the request; send it with any HTTP client.' };
  }
  if (!path) {
    return { ...base, placeholder: `Coming in ${sdk.repoName} 0.1. Until then, the curl tab shows the exact request; the SDK sends the same canonical URL.` };
  }
  const inRepo = path.replace(/^examples\/sdk\/[^/]+\//, 'examples/');
  return { ...base, path, code: raw(path), sourceUrl: `${sdk.repo}/blob/${entry.commit ?? entry.ref}/${inRepo}` };
};

export const tabsFor = (task: Task): TabCode[] => {
  const t = manifest.tasks[task];
  if (!t) throw new Error(`unknown example task: ${task}`);
  const [curl, capnp] = TRANSPORTS;
  return [
    { slug: curl.slug, label: curl.label, hl: curl.hl, path: t.curl, code: forReader(raw(t.curl)) },
    t.capnp
      ? { slug: capnp.slug, label: capnp.label, hl: capnp.hl, path: t.capnp, code: forReader(raw(t.capnp)) }
      : { slug: capnp.slug, label: capnp.label, hl: capnp.hl, placeholder: "This route serves JSON only; there is no Cap'n Proto body." },
    ...SDKS.map((s) => sdkTab(task, s)),
  ];
};

export const taskInfo = (task: Task) => manifest.tasks[task];
export const sdkRefs = refs;
export const sdkIndexData = sdkIndex as Record<string, { ref: string | null; commit?: string; runtime: string | null; tasks: Record<string, string> }>;

/** The no-SDK quickstart for a language page (examples/http/<lang>/). */
export const HTTP_EXAMPLES: Record<string, { path: string; hl: string; run: string }> = {
  python: { path: 'examples/http/python/quickstart.py', hl: 'python', run: 'python3 quickstart.py' },
  javascript: { path: 'examples/http/javascript/quickstart.mjs', hl: 'js', run: 'node quickstart.mjs' },
  go: { path: 'examples/http/go/quickstart.go', hl: 'go', run: 'go run .' },
  csharp: { path: 'examples/http/csharp/Program.cs', hl: 'csharp', run: 'dotnet run' },
  java: { path: 'examples/http/java/Quickstart.java', hl: 'java', run: 'java Quickstart.java' },
  kotlin: { path: 'examples/http/kotlin/src/main/kotlin/Quickstart.kt', hl: 'kotlin', run: 'gradle run' },
  swift: { path: 'examples/http/swift/quickstart.swift', hl: 'swift', run: 'swift quickstart.swift' },
};

/** The Cap'n Proto decoders (examples/capnp/<lang>/), all run against the golden message in CI. */
export const CAPNP_DECODERS = [
  { label: 'Rust', hl: 'rust', path: 'examples/capnp/rust/src/main.rs', build: 'examples/capnp/rust/Cargo.toml' },
  { label: 'Python', hl: 'python', path: 'examples/capnp/python/decode_forecast.py', build: 'examples/capnp/python/requirements.in' },
  { label: 'C++', hl: 'cpp', path: 'examples/capnp/cpp/decode_forecast.c++', build: 'examples/capnp/cpp/build.sh' },
  { label: 'Go', hl: 'go', path: 'examples/capnp/go/main.go', build: 'examples/capnp/go/gen.sh' },
  { label: 'Kotlin', hl: 'kotlin', path: 'examples/capnp/kotlin/src/main/kotlin/DecodeForecast.kt', build: 'examples/capnp/kotlin/gen.sh' },
];

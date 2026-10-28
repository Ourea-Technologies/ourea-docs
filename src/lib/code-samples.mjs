// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The API reference's code samples: the served OpenAPI file is the pinned
// spec copy (spec/openapi/v1/openapi.yaml) with an `x-codeSamples` list on
// every operation, built from the same tested example files the guide pages
// include. Nothing here is typed by hand:
//
//   * curl and Cap'n Proto: the call to this operation, cut from the task's
//     shell example (its comment lines and the command), in reader form;
//   * each SDK: that SDK's whole program for the same task, from
//     examples/sdk/<lang>/ at the ref pinned in examples/sdk-refs.json.
//
// Which task shows an operation: of the tasks whose curl example calls it,
// the one with SDK programs in the most languages (the first in
// examples/manifest.json on a tie). Used by the Astro route that serves
// /openapi/v1/openapi.yaml and by scripts/check-reference.mjs.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { SDKS, TRANSPORTS } from './languages.mjs';
import { forReader, shellCalls } from './reader.mjs';

export const SPEC_PATH = 'spec/openapi/v1/openapi.yaml';

const json = (root, p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

/** Every operation in the spec, with a matcher for its URL path. */
export const operationsOf = (spec) => {
  const ops = [];
  for (const [template, item] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(item)) {
      if (!op?.operationId) continue;
      const regex = new RegExp(`^${template.replace(/\{\w+\}/g, '[^/]+')}$`);
      ops.push({ id: op.operationId, method, template, regex, op });
    }
  }
  // A literal segment beats a parameter (/locations/or/x/current vs /locations/{state}/{slug}):
  // anchored regexes already keep those apart, so declaration order is enough.
  return ops;
};

const matchOp = (ops, path) => ops.find((o) => o.regex.test(path));

/**
 * Scalar keys a custom sample by its `lang`: the first sample with a lang is
 * `custom/<lang>`, the next `custom/<lang>/1`. The reference page maps the
 * site's ?lang= slug onto that id, so the ids must be stable: every sample's
 * lang is unique except curl and Cap'n Proto (both shell), and curl is always
 * first.
 */
export const scalarClientId = (slug) => {
  const all = [...TRANSPORTS, ...SDKS];
  const tab = all.find((t) => t.slug === slug);
  if (!tab) return undefined;
  if (slug === 'capnp') return `custom/${tab.hl}/1`;
  return `custom/${tab.hl}`;
};

/** { operationId: { task, samples: [{ slug, lang, label, source, from }] } } */
export const codeSamples = (root, spec) => {
  const manifest = json(root, 'examples/manifest.json');
  const sdkIndex = json(root, 'examples/sdk/index.json');
  const ops = operationsOf(spec);
  const read = (p) => readFileSync(join(root, p), 'utf8');

  // Per task: which operations its curl and capnp scripts call. A call that
  // needs a value an earlier line set ($cursor, $slug, $id), or that only
  // captures its output for a later line (x=$(curl ...)), is shown as the
  // whole script, so the sample still runs and prints as copied.
  const calls = (file) => {
    const text = forReader(read(file));
    return shellCalls(text).map((c) => ({
      ...c,
      code: /\$\(|\$(?!OUREA_API_KEY\b)\w+/.test(c.code.replace(/^#.*$/gm, '')) ? text : c.code,
      op: matchOp(ops, c.path)?.id,
    }));
  };
  const tasks = Object.entries(manifest.tasks).map(([name, t]) => ({ name, t, curl: calls(t.curl), capnp: t.capnp ? calls(t.capnp) : [] }));

  const out = {};
  for (const o of ops) {
    // The task that shows it in the most languages; the first in the manifest on a tie.
    const candidates = tasks.filter((x) => x.curl.some((c) => c.op === o.id));
    if (!candidates.length) continue;
    const langs = (x) => SDKS.filter((s) => sdkIndex[s.refKey]?.tasks?.[x.name]).length;
    const task = candidates.reduce((best, x) => (langs(x) > langs(best) ? x : best));
    const samples = [];
    const curl = task.curl.find((c) => c.op === o.id);
    samples.push({ slug: 'curl', lang: TRANSPORTS[0].hl, label: TRANSPORTS[0].label, source: curl.code, from: task.t.curl });
    const capnp = task.capnp.find((c) => c.op === o.id);
    if (capnp) samples.push({ slug: 'capnp', lang: TRANSPORTS[1].hl, label: TRANSPORTS[1].label, source: capnp.code, from: task.t.capnp });
    for (const s of SDKS) {
      const path = sdkIndex[s.refKey]?.tasks?.[task.name];
      if (!path) continue;
      samples.push({ slug: s.slug, lang: s.hl, label: s.label, source: read(path), from: path });
    }
    out[o.id] = { task: task.name, samples };
  }
  return out;
};

/**
 * The served OpenAPI text: the pinned copy, byte for byte, with an
 * `x-codeSamples` block inserted under each operation's `operationId` line.
 */
export const servedOpenApi = (root) => {
  const text = readFileSync(join(root, SPEC_PATH), 'utf8');
  const spec = YAML.parse(text);
  const samples = codeSamples(root, spec);
  return text.replace(/^( +)operationId: (\w+)\n/gm, (line, indent, id) => {
    const s = samples[id];
    if (!s) return line;
    const block = YAML.stringify({ 'x-codeSamples': s.samples.map(({ lang, label, source }) => ({ lang, label, source })) }, { lineWidth: 0, indentSeq: false });
    return line + block.replace(/^(?=.)/gm, indent);
  });
};

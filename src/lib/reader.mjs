// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// What a reader copies from a shell example: the runnable script minus the
// test plumbing. Shared by the pages (src/lib/examples.ts), the API
// reference's code samples (src/lib/code-samples.mjs) and the checks, so all
// three show the same text.

export const API_HOST = 'https://api.oureawx.com';

/**
 * Drops the shebang, licence and "Docs:/Runs against/expect" header lines,
 * `set -euo pipefail`, the API= base-URL line and any
 * `docs:hide-start..end` block, and writes the real host and schema name in
 * place of $API and $SCHEMA.
 */
export const forReader = (script) => {
  const out = [];
  let hiding = false;
  let inHeader = true;
  for (const line of script.split('\n')) {
    if (line.startsWith('# docs:hide-start')) {
      hiding = true;
      continue;
    }
    if (line.startsWith('# docs:hide-end')) {
      hiding = false;
      continue;
    }
    if (hiding) continue;
    if (inHeader) {
      if (line.startsWith('API=')) {
        inHeader = false;
        continue;
      }
      if (/^#!|^# SPDX|^# Copyright|^#$|^# Docs:|^# Runs against|^# it at the local mock|^# expect-output:|^set -euo/.test(line)) continue;
    }
    out.push(line);
  }
  return out
    .join('\n')
    .replaceAll('"$API', `"${API_HOST}`)
    .replaceAll('$API', API_HOST)
    .replaceAll('"$SCHEMA"', 'ourea.capnp')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '\n');
};

/**
 * The calls in a reader-form shell example, one block per API call: the
 * comment lines right above it, the command, and its continuation lines
 * (a trailing `\`, or a following `  | ...` pipe). `path` is the URL path
 * the call requests.
 */
export const shellCalls = (text) => {
  const lines = text.split('\n');
  const calls = [];
  let comments = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*#/.test(line)) {
      comments.push(line.trim());
      continue;
    }
    const url = new RegExp(`${API_HOST.replace(/[.]/g, '\\.')}(/api/v1/[^"?\\s]*)`).exec(line);
    if (!url) {
      comments = [];
      continue;
    }
    const indent = /^\s*/.exec(line)[0].length;
    const cmd = [line.slice(indent)];
    while (i + 1 < lines.length && (lines[i].trimEnd().endsWith('\\') || /^\s+\|/.test(lines[i + 1]))) {
      i++;
      const next = lines[i];
      cmd.push(next.slice(Math.min(indent, /^\s*/.exec(next)[0].length)));
    }
    calls.push({ path: url[1], code: `${[...comments, ...cmd].join('\n')}\n` });
    comments = [];
  }
  return calls;
};

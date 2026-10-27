// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// A Bruno collection (https://www.usebruno.com, a free, offline API client)
// built from the served OpenAPI file: one request per operation, foldered by
// tag, using the same canonical URL as that operation's tested curl sample.
// A value the sample reads from an earlier call ($slug, $id, $cursor) is a
// Bruno variable to fill in. Served as a zip at /downloads/ by an Astro route.
import { deflateRawSync } from 'node:zlib';
import YAML from 'yaml';
import { codeSamples, operationsOf, servedOpenApi } from './code-samples.mjs';
import { API_HOST } from './reader.mjs';

const NAME = 'Ourea Weather API';

const auth = (security) => (security.length === 0 ? 'open' : security.some((s) => Object.keys(s).length === 0) ? 'optional' : 'required');

/** { path: text } for every file of the collection. */
export const brunoFiles = (root) => {
  const spec = YAML.parse(servedOpenApi(root));
  const samples = codeSamples(root, spec);
  const files = {
    'bruno.json': `${JSON.stringify({ version: '1', name: NAME, type: 'collection', ignore: ['node_modules', '.git'] }, null, 2)}\n`,
  };
  const vars = new Set();
  const seq = new Map();
  for (const { id, method, op } of operationsOf(spec)) {
    const curl = samples[id]?.samples.find((s) => s.slug === 'curl')?.source ?? '';
    const lines = curl.split('\n').filter((l) => l.includes(API_HOST));
    // The call to this operation in the sample: the line whose path matches.
    const line = lines.find((l) => operationsOf(spec).find((o) => o.id === id).regex.test(new URL(/"(https:[^"]+)"/.exec(l)[1].replace(/\$\{?(\w+)\}?/g, 'x')).pathname)) ?? lines[0];
    if (!line) continue;
    let url = /"(https:[^"]+)"/.exec(line)[1].replace(/\$\{?(\w+)\}?/g, (_, v) => {
      vars.add(v);
      return `{{${v}}}`;
    });
    url = url.replace(API_HOST, '{{baseUrl}}');
    const [base, query = ''] = url.split('?');
    const params = query ? query.split('&').map((kv) => kv.split('=')) : [];
    const tag = op.tags?.[0] ?? 'Other';
    const n = (seq.get(tag) ?? 0) + 1;
    seq.set(tag, n);
    const kind = auth(op.security ?? spec.security ?? []);
    const out = [`meta {\n  name: ${op.summary ?? id}\n  type: http\n  seq: ${n}\n}`, `${method} {\n  url: ${url}\n  body: none\n  auth: none\n}`];
    if (params.length) out.push(`params:query {\n${params.map(([k, v]) => `  ${k}: ${decodeURIComponent(v ?? '')}`).join('\n')}\n}`);
    // Pro routes send the key; optional ones carry it disabled (anonymous is the Free tier).
    if (kind !== 'open') out.push(`headers {\n  ${kind === 'optional' ? '~' : ''}X-API-Key: {{apiKey}}\n}`);
    out.push(`docs {\n  operationId: ${id}. Credentials: ${kind === 'open' ? 'none (an open route)' : kind === 'optional' ? 'optional (enable X-API-Key for your own budget)' : 'a Pro API key in apiKey'}.\n  Reference: https://docs.oureawx.com/api/${id}.md\n}`);
    files[`${tag}/${id}.bru`] = `${out.join('\n\n')}\n`;
  }
  const envVars = [['baseUrl', API_HOST], ...[...vars].sort().map((v) => [v, ''])];
  files['environments/Ourea.bru'] = `vars {\n${envVars.map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n}\nvars:secret [\n  apiKey\n]\n`;
  files['README.md'] = `# ${NAME}: Bruno collection\n\nOne request per operation, built from https://docs.oureawx.com/openapi/v1/openapi.yaml with the canonical URLs of the docs' tested examples. Open this folder in Bruno (Open Collection), pick the Ourea environment, and send. Named-location routes need no key; put a Pro key in apiKey for the Pro routes. Variables such as slug or id come from an earlier response.\n`;
  return files;
};

// ── A minimal zip writer (stored names, deflated data, CRC-32). ─────────
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

/** The files as one zip under `dir/`, with a fixed timestamp so builds are reproducible. */
export const zip = (files, dir) => {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [path, text] of Object.entries(files)) {
    const name = Buffer.from(`${dir}/${path}`);
    const data = Buffer.from(text);
    const packed = deflateRawSync(data);
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x0800, 6); // UTF-8 names
    head.writeUInt16LE(8, 8); // deflate
    head.writeUInt16LE(0, 10);
    head.writeUInt16LE(0x5b21, 12); // 2025-09-01
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(name.length, 26);
    head.writeUInt16LE(0, 28);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x5b21, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(packed.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(offset, 42);
    local.push(head, name, packed);
    central.push(cd, name);
    offset += head.length + name.length + packed.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cdBuf, end]);
};

// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The docs MCP server (workers/docs/mcp.mjs) against the built site in
// dist/ (run after `npm run build`): the JSON-RPC handshake, both tools, and
// that read_page only ever returns this site's own Markdown.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { handleMcp } from '../workers/docs/mcp.mjs';

const dist = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'dist');
const fetchAsset = async (path) => {
  const file = join(dist, decodeURIComponent(path));
  return existsSync(file) ? new Response(readFileSync(file)) : new Response('not found', { status: 404 });
};
const rpc = async (body) => {
  const res = await handleMcp(new Request('https://docs.oureawx.com/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), fetchAsset);
  return { status: res.status, json: res.status === 202 ? null : await res.json() };
};

test('dist/ is built', () => assert.ok(existsSync(join(dist, 'mcp/index.json')), 'run npm run build first'));

test('initialize negotiates the protocol and names the server', async () => {
  const { json } = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } });
  assert.equal(json.result.protocolVersion, '2025-06-18');
  assert.equal(json.result.serverInfo.name, 'ourea-docs');
  assert.ok(json.result.capabilities.tools);
  const old = await rpc({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
  assert.equal(old.json.result.protocolVersion, '2025-06-18');
});

test('a notification gets 202 and no body', async () => {
  assert.equal((await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);
});

test('tools/list: search_docs and read_page, both read-only', async () => {
  const { json } = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
  assert.deepEqual(json.result.tools.map((t) => t.name), ['search_docs', 'read_page']);
  for (const t of json.result.tools) assert.equal(t.annotations.readOnlyHint, true);
});

test('search_docs finds the page on adding quantiles', async () => {
  const { json } = await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'search_docs', arguments: { query: 'add hourly quantiles storm total', limit: 5 } } });
  const paths = json.result.structuredContent.results.map((r) => r.path);
  assert.ok(paths.includes('/concepts/adding-quantiles/') || paths.includes('/faq/'), paths.join(', '));
});

test('read_page returns the Markdown alternate verbatim, by path, URL or operationId', async () => {
  for (const path of ['/features/probabilities/', 'https://docs.oureawx.com/features/probabilities/', '/features/probabilities.md']) {
    const { json } = await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'read_page', arguments: { path } } });
    assert.equal(json.result.content[0].text, readFileSync(join(dist, 'features/probabilities.md'), 'utf8'), path);
  }
  const op = await rpc({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'read_page', arguments: { path: 'getLocationForecast' } } });
  assert.equal(op.json.result.content[0].text, readFileSync(join(dist, 'api/getLocationForecast.md'), 'utf8'));
});

test('read_page refuses anything that is not a page of this site', async () => {
  for (const path of ['https://example.com/', '/../../etc/passwd', '/_astro/x.js', '/nope/']) {
    const { json } = await rpc({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'read_page', arguments: { path } } });
    assert.equal(json.result.isError, true, path);
  }
});

test('unknown methods and tools are JSON-RPC errors', async () => {
  assert.equal((await rpc({ jsonrpc: '2.0', id: 8, method: 'resources/write' })).json.error.code, -32601);
  assert.equal((await rpc({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'write_page' } })).json.error.code, -32602);
});

test('GET is 405 (no server-sent stream); OPTIONS allows any origin', async () => {
  assert.equal((await handleMcp(new Request('https://docs.oureawx.com/mcp'), fetchAsset)).status, 405);
  const pre = await handleMcp(new Request('https://docs.oureawx.com/mcp', { method: 'OPTIONS' }), fetchAsset);
  assert.equal(pre.headers.get('access-control-allow-origin'), '*');
});

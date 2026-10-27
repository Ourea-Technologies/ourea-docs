// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The docs MCP server: Streamable HTTP (JSON responses, no server-sent
// stream), read-only and keyless. Two tools:
//   * search_docs: the build-time index (/mcp/index.json) scored by term
//     frequency, with each hit's page, section and a snippet;
//   * read_page: a page's own Markdown alternate, verbatim.
// It returns this site's text only: no model, no generated answer.
// No dependencies; `fetchAsset(path)` reads a file of the built site.

export const SERVER_INFO = { name: 'ourea-docs', title: 'Ourea Docs', version: '1.0.0' };
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SITE = 'https://docs.oureawx.com';

const INSTRUCTIONS =
  'Search and read the Ourea weather API docs (docs.oureawx.com). Use search_docs to find the page for a question, then read_page for its full Markdown. ' +
  'Facts to keep: send canonical URLs (parameters in alphabetical order, none at its default, literal : and , in prob and totals); never add quantiles across hours, ask the server for window totals (totals=); a null probability means no answer, never 0.';

export const TOOLS = [
  {
    name: 'search_docs',
    title: 'Search the Ourea docs',
    description: 'Full-text search over every docs page and API operation. Returns the best-matching sections with their page path, heading and a short snippet. Pass a page path to read_page for the full text.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to look for, e.g. "snow probability window" or "rate limit 429".' },
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 8, description: 'How many results (default 8).' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'read_page',
    title: 'Read an Ourea docs page',
    description: 'The full Markdown of one docs page or API operation, exactly as published. Takes a path from search_docs (e.g. "/features/probabilities/" or "/api/getLocationForecast.md"), a full docs.oureawx.com URL, or an operationId.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'A page path, docs URL or operationId.' } },
      required: ['path'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

const tokens = (s) => s.toLowerCase().match(/[a-z0-9_]+/g) ?? [];

let indexCache;
const loadIndex = async (fetchAsset) => {
  if (!indexCache) {
    const res = await fetchAsset('/mcp/index.json');
    if (!res.ok) throw new Error(`search index unavailable (${res.status})`);
    const idx = await res.json();
    // Precompute per-section term counts and document frequencies once per isolate.
    const sections = [];
    for (const page of idx.pages) {
      for (const s of page.sections) {
        const counts = new Map();
        for (const t of tokens(`${s.heading} ${s.text}`)) counts.set(t, (counts.get(t) ?? 0) + 1);
        const boost = new Set(tokens(`${page.title} ${s.heading}`));
        sections.push({ page, section: s, counts, boost, length: [...counts.values()].reduce((a, b) => a + b, 0) || 1 });
      }
    }
    const df = new Map();
    for (const s of sections) for (const t of s.counts.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    indexCache = { pages: idx.pages, sections, df };
  }
  return indexCache;
};

const snippet = (text, terms) => {
  const flat = text.replace(/\s+/g, ' ');
  const lower = flat.toLowerCase();
  const at = Math.max(0, Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0), flat.length));
  const start = Math.max(0, at - 80);
  return `${start > 0 ? '…' : ''}${flat.slice(start, start + 280).trim()}${start + 280 < flat.length ? '…' : ''}`;
};

export const searchDocs = async (fetchAsset, query, limit = 8) => {
  const { sections, df } = await loadIndex(fetchAsset);
  const terms = [...new Set(tokens(query))];
  if (!terms.length) return [];
  const n = sections.length;
  const scored = [];
  for (const s of sections) {
    let score = 0;
    for (const t of terms) {
      const tf = s.counts.get(t);
      if (!tf) continue;
      const idf = Math.log(1 + n / (df.get(t) ?? 1));
      score += ((tf * 2.2) / (tf + 1.2 * (0.25 + (0.75 * s.length) / 300))) * idf * (s.boost.has(t) ? 2 : 1);
    }
    if (score > 0) scored.push({ s, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set();
  const out = [];
  for (const { s } of scored) {
    const key = `${s.page.path}#${s.section.heading}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: s.page.title, section: s.section.heading || null, path: s.page.path, url: `${SITE}${s.page.path}`, snippet: snippet(s.section.text, terms) });
    if (out.length >= limit) break;
  }
  return out;
};

/** A path, URL or operationId to the page's Markdown alternate, if it is a page in the index. */
export const resolvePage = async (fetchAsset, input) => {
  const { pages } = await loadIndex(fetchAsset);
  let p = String(input ?? '').trim();
  if (!p) return null;
  if (/^https?:\/\//.test(p)) {
    const u = new URL(p);
    if (u.host !== new URL(SITE).host) return null;
    p = u.pathname;
  }
  p = p.split('#')[0].split('?')[0];
  if (!p.startsWith('/')) p = /^[a-z][A-Za-z]+$/.test(p) ? `/api/${p}.md` : `/${p}`;
  const bare = p.replace(/\.md$/, '').replace(/\/$/, '') || '/index';
  return pages.find((x) => x.md === p || x.path === p || x.md.replace(/\.md$/, '') === bare || x.path.replace(/\/$/, '') === bare) ?? null;
};

const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const toolText = (text, isError = false) => ({ content: [{ type: 'text', text }], isError });

const callTool = async (fetchAsset, name, args = {}) => {
  if (name === 'search_docs') {
    if (typeof args.query !== 'string' || !args.query.trim()) return toolText('query must be a non-empty string', true);
    const limit = Math.min(20, Math.max(1, Number.isInteger(args.limit) ? args.limit : 8));
    const hits = await searchDocs(fetchAsset, args.query, limit);
    if (!hits.length) return toolText(`No docs section matches "${args.query}". Try other words, or read_page("/llms.txt") for the page list.`);
    const text = hits.map((h, i) => `${i + 1}. ${h.title}${h.section ? ` › ${h.section}` : ''}\n   path: ${h.path}\n   ${h.snippet}`).join('\n\n');
    return { ...toolText(text), structuredContent: { results: hits } };
  }
  if (name === 'read_page') {
    if (typeof args.path === 'string' && /^\/?llms(-full)?\.txt$/.test(args.path.trim())) {
      const res = await fetchAsset(`/${args.path.trim().replace(/^\//, '')}`);
      return toolText(await res.text());
    }
    const page = await resolvePage(fetchAsset, args.path);
    if (!page) return toolText(`No docs page at "${args.path}". Use search_docs to find one.`, true);
    const res = await fetchAsset(page.md);
    if (!res.ok) return toolText(`Could not read ${page.md} (${res.status}).`, true);
    return toolText(await res.text());
  }
  return null;
};

/** One JSON-RPC message in, one response out (or null for a notification). */
export const handleMessage = async (fetchAsset, msg) => {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return rpcError(msg?.id, -32600, 'Invalid Request');
  const isNotification = msg.id === undefined;
  const reply = (result) => (isNotification ? null : { jsonrpc: '2.0', id: msg.id, result });
  switch (msg.method) {
    case 'initialize': {
      const asked = msg.params?.protocolVersion;
      return reply({
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
    case 'tools/call': {
      const result = await callTool(fetchAsset, msg.params?.name, msg.params?.arguments);
      if (!result) return rpcError(msg.id, -32602, `Unknown tool: ${msg.params?.name}`);
      return reply(result);
    }
    default:
      if (msg.method.startsWith('notifications/')) return null;
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

/** The /mcp endpoint. Stateless: no session id is issued, so any instance can answer. */
export const handleMcp = async (request, fetchAsset) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method === 'GET') {
    // No server-initiated stream (Streamable HTTP lets a server decline it).
    return new Response('This MCP server answers POST requests (Streamable HTTP, JSON responses). See https://docs.oureawx.com/ai-agents/', {
      status: 405,
      headers: { ...CORS, Allow: 'POST, OPTIONS', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(rpcError(null, -32700, 'Parse error'), { status: 400, headers: CORS });
  }
  const batch = Array.isArray(body);
  const replies = [];
  for (const msg of batch ? body : [body]) {
    try {
      const r = await handleMessage(fetchAsset, msg);
      if (r) replies.push(r);
    } catch (e) {
      replies.push(rpcError(msg?.id, -32603, `Internal error: ${e.message}`));
    }
  }
  if (!replies.length) return new Response(null, { status: 202, headers: CORS });
  return Response.json(batch ? replies : replies[0], { headers: { ...CORS, 'Cache-Control': 'no-store' } });
};

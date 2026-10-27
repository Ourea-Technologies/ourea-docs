// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// ourea-docs-status: the cron that probes the API (workers/status/status.mjs)
// and the two read routes the docs Worker forwards to it. It has no public
// hostname of its own (workers_dev off, no routes): only the docs Worker
// reaches it, through a service binding.
import { KEY, badge, probe, record, summary } from './status.mjs';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const run = await probe(fetch);
        const state = await env.STATUS.get(KEY, 'json');
        await env.STATUS.put(KEY, JSON.stringify(record(state, run)));
      })(),
    );
  },
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    const state = await env.STATUS.get(KEY, 'json');
    if (pathname === '/status/data.json') return json(summary(state));
    if (pathname === '/status/badge.svg') return new Response(badge(state), { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' } });
    return new Response('Not found', { status: 404 });
  },
};

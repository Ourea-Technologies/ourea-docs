// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The docs.oureawx.com Worker. Every route is a static file from dist/
// (Workers static assets) except /mcp, the docs MCP server
// (workers/docs/mcp.mjs), and /status/data.json and /status/badge.svg, which
// it forwards to the status Worker (workers/status/) through a service
// binding. wrangler.jsonc routes only those paths here first.
import { handleMcp } from './mcp.mjs';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
      return handleMcp(request, (path) => env.ASSETS.fetch(new URL(path, url.origin)));
    }
    if (url.pathname === '/status/data.json' || url.pathname === '/status/badge.svg') {
      if (!env.STATUS_WORKER) return Response.json({ error: 'status is not configured' }, { status: 503 });
      return env.STATUS_WORKER.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

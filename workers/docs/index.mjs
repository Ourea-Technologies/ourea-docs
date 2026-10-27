// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The docs.oureawx.com Worker. Every route is a static file from dist/
// (Workers static assets) except /mcp, the docs MCP server
// (workers/docs/mcp.mjs), which wrangler.jsonc routes here first.
import { handleMcp } from './mcp.mjs';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
      return handleMcp(request, (path) => env.ASSETS.fetch(new URL(path, url.origin)));
    }
    return env.ASSETS.fetch(request);
  },
};

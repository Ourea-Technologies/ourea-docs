// SPDX-License-Identifier: BSD-2-Clause
// The docs MCP server's search index (src/lib/search-index.ts), a static file
// the Worker reads (workers/docs/mcp.mjs).
import type { APIRoute } from 'astro';
import { searchIndex } from '../../lib/search-index';

export const GET: APIRoute = async () => new Response(JSON.stringify(await searchIndex()), { headers: { 'Content-Type': 'application/json' } });

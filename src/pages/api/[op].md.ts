// SPDX-License-Identifier: BSD-2-Clause
// One Markdown page per API operation, at /api/<operationId>.md
// (src/lib/operation-md.mjs), for agents and the docs MCP server.
import type { APIRoute, GetStaticPaths } from 'astro';
import { operationPages } from '../../lib/operation-md.mjs';

export const getStaticPaths = (() => operationPages(process.cwd()).map((p) => ({ params: { op: p.id }, props: { markdown: p.markdown } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response((props as { markdown: string }).markdown, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });

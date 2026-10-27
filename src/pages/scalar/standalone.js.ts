// SPDX-License-Identifier: BSD-2-Clause
// Serves the Scalar API reference bundle from this site (pinned through
// package-lock.json), so the reference page loads nothing from a CDN.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  // The package exports no ./package.json, so resolve from the project root
  // (astro build runs there).
  const js = readFileSync(join(process.cwd(), 'node_modules/@scalar/api-reference/dist/browser/standalone.js'));
  return new Response(new Uint8Array(js), { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } });
};

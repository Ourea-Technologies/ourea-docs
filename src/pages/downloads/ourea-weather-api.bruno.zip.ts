// SPDX-License-Identifier: BSD-2-Clause
// The Bruno collection (src/lib/bruno.mjs), built from the served OpenAPI
// file, as a zip of the collection folder.
import type { APIRoute } from 'astro';
import { brunoFiles, zip } from '../../lib/bruno.mjs';

export const GET: APIRoute = () =>
  new Response(new Uint8Array(zip(brunoFiles(process.cwd()), 'ourea-weather-api')), { headers: { 'Content-Type': 'application/zip' } });

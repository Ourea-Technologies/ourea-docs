// SPDX-License-Identifier: BSD-2-Clause
// The changelog's Atom feed (src/lib/feed.mjs).
import type { APIRoute } from 'astro';
import { atomFeed } from '../../lib/feed.mjs';

export const GET: APIRoute = () => new Response(atomFeed(), { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });

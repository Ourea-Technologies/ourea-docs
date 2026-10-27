// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The served OpenAPI file: the pinned spec copy (spec/openapi/v1/openapi.yaml,
// from scripts/sync-spec.mjs) with every operation's tested code samples as
// `x-codeSamples` (src/lib/code-samples.mjs). scripts/check-reference.mjs
// checks that nothing else differs.
import type { APIRoute } from 'astro';
import { servedOpenApi } from '../../../lib/code-samples.mjs';

export const GET: APIRoute = () =>
  new Response(servedOpenApi(process.cwd()), { headers: { 'Content-Type': 'application/yaml; charset=utf-8' } });

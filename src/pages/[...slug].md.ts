// SPDX-License-Identifier: BSD-2-Clause
// A clean Markdown alternate of every docs page, at /<page>.md.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { toCleanMarkdown } from '../lib/markdown';

export const getStaticPaths = (async () => {
  const docs = await getCollection('docs');
  return docs.map((d) => ({ params: { slug: d.id || 'index' }, props: { title: d.data.title, description: d.data.description, body: d.body ?? '' } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const { title, description, body } = props as { title: string; description?: string; body: string };
  return new Response(toCleanMarkdown(title, description, body), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};

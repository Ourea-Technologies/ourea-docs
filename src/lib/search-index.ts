// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The docs MCP server's search index (/mcp/index.json): every page and API
// operation as its Markdown, split into sections at `## ` headings, with code
// blocks left out of the searchable text. read_page returns the full
// Markdown alternate; this file only has to find it.
import { getCollection } from 'astro:content';
import { SITE, mdPath, toCleanMarkdown } from './markdown';
import { operationPages } from './operation-md.mjs';

export interface IndexedPage {
  /** The page's URL path (/features/probabilities/ or /api/#getLocationForecast). */
  path: string;
  /** Its Markdown alternate, which read_page returns. */
  md: string;
  title: string;
  description: string;
  sections: { heading: string; text: string }[];
}

const sectionsOf = (markdown: string) => {
  // Code blocks, and the language labels and notes around them, are not prose to match.
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\*\*[^*\n]+\*\*$/gm, '')
    .replace(/^`[^`\n]+`$/gm, '')
    .replace(/^(Coming|SDK examples coming|Readable in a terminal)[^\n]*$/gm, '');
  const parts = text.split(/^## /m);
  return parts.map((p, i) => {
    const [first, ...rest] = p.split('\n');
    return i === 0 ? { heading: '', text: p.replace(/^# .*\n/, '').trim() } : { heading: first.trim(), text: rest.join('\n').trim() };
  });
};

export const searchIndex = async () => {
  const docs = await getCollection('docs');
  const pages: IndexedPage[] = docs
    .filter((d) => d.id !== '404')
    .map((d) => ({
      path: `/${d.id ? `${d.id}/` : ''}`,
      md: mdPath(d.id),
      title: d.data.title,
      description: d.data.description ?? '',
      sections: sectionsOf(toCleanMarkdown(d.data.title, d.data.description, d.body ?? '')),
    }));
  for (const op of operationPages(process.cwd())) {
    pages.push({ path: `/api/${op.id}.md`, md: `/api/${op.id}.md`, title: `${op.title} (${op.id})`, description: `API reference: ${op.id}`, sections: sectionsOf(op.markdown) });
  }
  return { site: SITE, pages };
};

// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// One 1200x630 Open Graph image per docs page, rendered at build time from an
// SVG with sharp (already Astro's image dependency). Static output only.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import sharp from 'sharp';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Greedy word wrap by character count (the font is close to monospace-width on average). */
const wrap = (text: string, width: number, maxLines: number) => {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > width) {
      lines.push(line.trim());
      line = word;
    } else line += ` ${word}`;
  }
  if (line.trim()) lines.push(line.trim());
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, '')}…`;
  }
  return lines;
};

export const getStaticPaths = (async () => {
  const docs = await getCollection('docs');
  return [
    ...docs.map((d) => ({
      params: { slug: d.id === 'index' || d.id === '' ? 'index' : d.id },
      props: { title: d.data.seoTitle ?? d.data.title, description: d.data.description ?? '' },
    })),
    // The Scalar page is not a docs entry (src/pages/api/index.astro).
    {
      params: { slug: 'api-reference' },
      props: { title: 'API reference', description: 'Every route, parameter, response schema and error code of the Ourea Weather API v1.' },
    },
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { title, description } = props as { title: string; description: string };
  const titleLines = wrap(title, 30, 3);
  const descLines = wrap(description, 62, 3);
  const titleSvg = titleLines.map((l, i) => `<tspan x="80" dy="${i === 0 ? 0 : 76}">${esc(l)}</tspan>`).join('');
  const descY = 250 + titleLines.length * 76 + 20;
  const descSvg = descLines.map((l, i) => `<tspan x="80" dy="${i === 0 ? 0 : 40}">${esc(l)}</tspan>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0b1f2c"/>
  <path d="M0 630 L300 330 L430 460 L560 300 L820 560 L940 450 L1200 630 Z" fill="#12324a"/>
  <path d="M80 92 L110 40 L125 64 L137 48 L162 92 Z" fill="#1f7fb8"/>
  <text x="180" y="86" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="#bfe3f7">Ourea Docs</text>
  <text x="80" y="250" font-family="Helvetica, Arial, sans-serif" font-size="66" font-weight="700" fill="#ffffff">${titleSvg}</text>
  <text x="80" y="${descY}" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#cfe3ef">${descSvg}</text>
  <text x="80" y="585" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#8fb7cf">docs.oureawx.com · probabilistic weather API</text>
</svg>`;
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};

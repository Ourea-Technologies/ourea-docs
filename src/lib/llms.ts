// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// llms.txt (an index) and llms-full.txt (every page as Markdown), built from
// the same entries and sidebar order as the site (llmstxt.org format).
import { getCollection } from 'astro:content';
import { SDKS } from './languages.mjs';
import { SITE, mdPath, toCleanMarkdown } from './markdown';
import { operationPages } from './operation-md.mjs';

// The language pages, by id (weather-api/python, weather-api/nodejs, ...).
const LANGUAGE_PAGES = new Set([...SDKS.map((s) => s.page.replace(/^\/|\/$/g, '')), 'weather-api/nodejs']);

const SECTIONS: [string, (id: string) => boolean][] = [
  ['Start here', (id) => ['index', '', 'getting-started', 'request-builder', 'ai-agents', 'faq'].includes(id)],
  ['Weather API', (id) => id.startsWith('weather-api') && !LANGUAGE_PAGES.has(id)],
  ['By language', (id) => LANGUAGE_PAGES.has(id)],
  ['Features', (id) => id.startsWith('features/')],
  ['Concepts', (id) => id.startsWith('concepts/')],
  ['Formats', (id) => ['json-or-capnp', 'capnp'].includes(id)],
  ['Reference', (id) => id === 'changelog' || id === 'status'],
];

const sorted = async () => {
  const docs = await getCollection('docs');
  const order = (d: (typeof docs)[number]) => d.data.sidebar?.order ?? 50;
  return docs.sort((a, b) => order(a) - order(b) || a.id.localeCompare(b.id));
};

export const llmsTxt = async (): Promise<string> => {
  const docs = await sorted();
  const out = [
    '# Ourea weather API',
    '',
    '> Ourea is a probabilistic weather API for the contiguous United States: forecasts blended from up to five ensembles (ECMWF AIFS-ENS and IFS-ENS, NOAA AIGEFS, GEFS and RRFS), served as quantiles, server-computed probabilities (`prob=`) and window totals (`totals=`). Named-location forecasts need no API key (Free tier, 240 h); coordinates, 360 h, per-model data and pinned runs need Pro.',
    '',
    `Base URL: https://api.oureawx.com. Send canonical URLs (parameters in alphabetical order, none at its default, literal \`:\` and \`,\` in \`prob\` and \`totals\`). Never add quantiles across hours; ask the server for window totals. Official SDKs: ${SDKS.map((s) => `${s.repoName} (${s.label})`).join(', ')}, at https://github.com/Ourea-Technologies.`,
    '',
  ];
  for (const [name, test] of SECTIONS) {
    const items = docs.filter((d) => test(d.id));
    if (!items.length) continue;
    out.push(`## ${name}`, '');
    for (const d of items) out.push(`- [${d.data.title}](${SITE}${mdPath(d.id)}): ${d.data.description ?? ''}`);
    out.push('');
  }
  out.push('## API reference', '', `One page per operation, with its parameters, responses and tested examples (the interactive reference is ${SITE}/api/):`, '');
  for (const op of operationPages(process.cwd())) out.push(`- [${op.title}](${SITE}/api/${op.id}.md): \`${op.id}\``);
  out.push('');
  out.push(
    '## Optional',
    '',
    `- [OpenAPI 3.1 spec](${SITE}/openapi/v1/openapi.yaml): the v1 contract`,
    `- [Cap'n Proto schema](${SITE}/schema/v1/ourea.capnp): the binary format's schema`,
    `- [All pages as one file](${SITE}/llms-full.txt)`,
    '',
  );
  return out.join('\n');
};

export const llmsFullTxt = async (): Promise<string> => {
  const docs = await sorted();
  const pages = docs.map((d) => `${toCleanMarkdown(d.data.title, d.data.description, d.body ?? '')}\nSource: ${SITE}/${d.id ? `${d.id}/` : ''}\n`);
  // The API reference, one section per operation, after the guides.
  const reference = operationPages(process.cwd()).map((op) => op.markdown);
  return [...pages, ...reference].join('\n---\n\n');
};

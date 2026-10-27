// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// llms.txt (an index) and llms-full.txt (every page as Markdown), built from
// the same entries and sidebar order as the site (llmstxt.org format).
import { getCollection } from 'astro:content';
import { SITE, mdPath, toCleanMarkdown } from './markdown';

const SECTIONS: [string, (id: string) => boolean][] = [
  ['Start here', (id) => ['index', '', 'getting-started', 'faq'].includes(id)],
  ['Weather API', (id) => id.startsWith('weather-api') && !/\/(python|javascript|nodejs|go|csharp|java|kotlin|swift)$/.test(id)],
  ['By language', (id) => /^weather-api\/(python|javascript|nodejs|go|csharp|java|kotlin|swift)$/.test(id)],
  ['Features', (id) => id.startsWith('features/')],
  ['Concepts', (id) => id.startsWith('concepts/')],
  ['Formats', (id) => ['json-or-capnp', 'capnp'].includes(id)],
  ['Reference', (id) => id === 'changelog'],
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
    'Base URL: https://api.oureawx.com. Send canonical URLs (parameters in alphabetical order, none at its default, literal `:` and `,` in `prob` and `totals`). Never add quantiles across hours; ask the server for window totals. Official SDKs: ensemble-weather-{python,typescript,go,dotnet,java,kotlin,swift} at https://github.com/Ourea-Technologies.',
    '',
  ];
  for (const [name, test] of SECTIONS) {
    const items = docs.filter((d) => test(d.id));
    if (!items.length) continue;
    out.push(`## ${name}`, '');
    for (const d of items) out.push(`- [${d.data.title}](${SITE}${mdPath(d.id)}): ${d.data.description ?? ''}`);
    out.push('');
  }
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
  return docs.map((d) => `${toCleanMarkdown(d.data.title, d.data.description, d.body ?? '')}\nSource: ${SITE}/${d.id ? `${d.id}/` : ''}\n`).join('\n---\n\n');
};

// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The forecast pages on oureawx.com that the docs link to: in every page's
// footer (Footer.astro), and in getting started and the SDK pages
// (<MainSiteLinks />, and its Markdown in src/lib/markdown.ts). Each one
// answers 200 with no noindex and its own canonical; check a new one the same
// way before adding it. /pricing is not here: it is noindex.
export const MAIN_SITE_PAGES = [
  { text: 'Find a forecast', href: 'https://oureawx.com/forecasts' },
  { text: 'Forecast map', href: 'https://oureawx.com/map' },
  { text: 'Mountain passes', href: 'https://oureawx.com/passes' },
];

export const SKI_AREAS = [
  { text: 'Mt Hood Meadows', href: 'https://oureawx.com/forecast/or/mt-hood-meadows' },
  { text: 'Timberline Lodge', href: 'https://oureawx.com/forecast/or/timberline-lodge' },
  { text: 'Crystal Mountain', href: 'https://oureawx.com/forecast/wa/crystal-mountain-resort' },
  { text: 'Alta', href: 'https://oureawx.com/forecast/ut/alta-ski-area' },
  { text: 'Palisades Tahoe', href: 'https://oureawx.com/forecast/ca/palisades-tahoe-squaw-valley' },
];

const md = (l) => `[${l.text}](${l.href})`;
const and = (xs) => `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;

/** The in-page sentence, as Markdown (the .md exports and llms-full.txt). */
export const mainSiteMarkdown = () =>
  `Ourea's forecast pages are on oureawx.com: ${MAIN_SITE_PAGES.map(md).join(' · ')}, and snow forecasts for ski areas such as ${and(SKI_AREAS.map(md))}.`;

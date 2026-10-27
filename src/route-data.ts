// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Per-page SEO on top of Starlight's own head (title, description,
// canonical, og:title/og:description/og:url, sitemap):
//   * a short <title> override (`seoTitle`) where the H1 is long;
//   * the generated Open Graph / Twitter image for this page (/og/<slug>.png);
//   * JSON-LD: BreadcrumbList everywhere, plus the page's schemaType
//     (TechArticle on guides, WebAPI on the API overview, SoftwareSourceCode
//     on each SDK page, FAQPage on the FAQ).
// scripts/check-seo.mjs validates the result in dist/.
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { FAQ } from './data/faq';
import { SDKS } from './lib/languages.mjs';
import { mdPath } from './lib/markdown';
import { ogPath } from './lib/og';

const SITE = 'https://docs.oureawx.com';
const ORG = { '@type': 'Organization', name: 'Ourea Technologies', url: 'https://oureawx.com' };
const SECTION_NAMES: Record<string, string> = {
  'weather-api': 'Weather API',
  features: 'Features',
  concepts: 'Concepts',
};

const breadcrumbs = (id: string, title: string) => {
  const parts = id.split('/').filter(Boolean);
  const items = [{ name: 'Ourea Docs', url: `${SITE}/` }];
  let path = '';
  parts.forEach((p, i) => {
    path += `${p}/`;
    if (i === parts.length - 1) items.push({ name: title, url: `${SITE}/${path}` });
    else if (SECTION_NAMES[p]) items.push({ name: SECTION_NAMES[p], url: `${SITE}/${path}` });
  });
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  };
};

const stripMd = (s: string) => s.replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const { data } = route.entry;
  const id = route.id;
  const url = `${SITE}/${id ? `${id}/` : ''}`;
  const head = route.head;

  if (data.seoTitle) {
    const title = head.find((h) => h.tag === 'title');
    if (title) title.content = data.seoTitle;
    const ogTitle = head.find((h) => h.tag === 'meta' && h.attrs?.property === 'og:title');
    if (ogTitle?.attrs) ogTitle.attrs.content = data.seoTitle;
  }

  const image = `${SITE}${ogPath(id)}`;
  head.push(
    ...(id === '404' ? [] : [{ tag: 'link' as const, attrs: { rel: 'alternate', type: 'text/markdown', href: mdPath(id) } }]),
    { tag: 'meta', attrs: { property: 'og:image', content: image } },
    { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
    { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
    { tag: 'meta', attrs: { property: 'og:image:alt', content: data.title } },
    { tag: 'meta', attrs: { name: 'twitter:image', content: image } },
    { tag: 'meta', attrs: { name: 'twitter:title', content: data.seoTitle ?? data.title } },
    ...(data.description ? [{ tag: 'meta' as const, attrs: { name: 'twitter:description', content: data.description } }] : []),
  );

  const graph: object[] = [breadcrumbs(id, data.title)];
  const base = { '@context': 'https://schema.org', name: data.title, description: data.description, url, inLanguage: 'en' };
  switch (data.schemaType) {
    case 'WebAPI':
      graph.push({
        ...base,
        '@type': 'WebAPI',
        name: 'Ourea Weather API',
        provider: ORG,
        documentation: `${SITE}/`,
        termsOfService: 'https://oureawx.com/terms',
        offers: {
          '@type': 'Offer',
          name: 'Free tier',
          price: '0',
          priceCurrency: 'USD',
          description:
            'Anonymous requests and Free keys are served at the Free tier: named-location forecasts to a 10-day (240 h) horizon from the latest run, current conditions and alerts for named locations, search and the catalog. Forecasts at arbitrary coordinates, per-model data, pinned runs and the 15-day horizon need Pro.',
        },
      });
      break;
    case 'SoftwareSourceCode': {
      const sdk = SDKS.find((s) => s.slug === data.sdk);
      if (sdk) {
        graph.push({
          ...base,
          '@type': 'SoftwareSourceCode',
          name: sdk.repoName,
          codeRepository: sdk.repo,
          programmingLanguage: sdk.label === 'C#' ? 'C#' : sdk.label,
          license: 'https://opensource.org/licenses/BSD-2-Clause',
          author: ORG,
          about: { '@type': 'WebAPI', name: 'Ourea Weather API', url: `${SITE}/weather-api/` },
        });
      }
      break;
    }
    case 'FAQPage':
      graph.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        url,
        mainEntity: FAQ.map((q) => ({ '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: stripMd(q.a) } })),
      });
      break;
    case 'TechArticle':
      graph.push({ ...base, '@type': 'TechArticle', headline: data.title, author: ORG, publisher: ORG, image });
      break;
    default:
      graph.push({ ...base, '@type': 'WebPage', publisher: ORG });
  }
  for (const g of graph) head.push({ tag: 'script', attrs: { type: 'application/ld+json' }, content: JSON.stringify(g) });
});

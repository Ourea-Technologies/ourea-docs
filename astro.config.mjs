// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLinksValidator from 'starlight-links-validator';
import { langSwitcherScript } from './src/lib/lang-switcher.mjs';

// The SDK READMEs link https://docs.oureawx.com/<lang>; the canonical
// language pages live under /weather-api/<lang>/.
const languageRedirects = {
  '/python': '/weather-api/python/',
  '/typescript': '/weather-api/javascript/',
  '/javascript': '/weather-api/javascript/',
  '/node': '/weather-api/nodejs/',
  '/go': '/weather-api/go/',
  '/dotnet': '/weather-api/csharp/',
  '/csharp': '/weather-api/csharp/',
  '/java': '/weather-api/java/',
  '/kotlin': '/weather-api/kotlin/',
  '/swift': '/weather-api/swift/',
};

export default defineConfig({
  site: 'https://docs.oureawx.com',
  trailingSlash: 'always',
  redirects: languageRedirects,
  integrations: [
    starlight({
      title: 'Ourea Docs',
      description:
        'Developer docs for the Ourea probabilistic weather API: ensemble forecasts, probabilities and window totals for the contiguous US.',
      logo: { src: './src/assets/ourea-mark.svg', replacesTitle: false },
      favicon: '/favicon.svg',
      titleDelimiter: '·',
      lastUpdated: false,
      pagefind: true,
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Ourea-Technologies' }],
      customCss: ['./src/styles/custom.css'],
      routeMiddleware: './src/route-data.ts',
      editLink: { baseUrl: 'https://github.com/Ourea-Technologies/ourea-docs/edit/main/' },
      components: { Footer: './src/components/Footer.astro' },
      head: [
        { tag: 'script', content: langSwitcherScript },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
      ],
      plugins: [starlightLinksValidator({ errorOnLocalLinks: true, errorOnFallbackPages: false, exclude: ['/api/', '/api/**', '/schema/**', '/openapi/**', '/llms.txt', '/llms-full.txt'] })],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Overview', link: '/' },
            { label: 'Getting started', link: '/getting-started/' },
            { label: 'FAQ', link: '/faq/' },
            { label: 'Contribute and get help', link: '/community/' },
          ],
        },
        {
          label: 'Weather API',
          items: [
            { label: 'Overview', link: '/weather-api/' },
            { label: 'Free weather API', link: '/weather-api/free/' },
            { label: 'No signup, no API key', link: '/weather-api/no-api-key/' },
            { label: 'Probabilistic forecasts', link: '/weather-api/probabilistic/' },
            { label: 'Ensemble forecasts', link: '/weather-api/ensemble/' },
            { label: 'Snow forecasts', link: '/weather-api/snow/' },
            { label: 'Mountain weather', link: '/weather-api/mountain/' },
            { label: 'Precipitation probability', link: '/weather-api/precipitation-probability/' },
          ],
        },
        {
          label: 'By language',
          items: [
            { label: 'Python', link: '/weather-api/python/' },
            { label: 'JavaScript / TypeScript', link: '/weather-api/javascript/' },
            { label: 'Node.js', link: '/weather-api/nodejs/' },
            { label: 'Go', link: '/weather-api/go/' },
            { label: 'C# / .NET', link: '/weather-api/csharp/' },
            { label: 'Java', link: '/weather-api/java/' },
            { label: 'Kotlin', link: '/weather-api/kotlin/' },
            { label: 'Swift / iOS', link: '/weather-api/swift/' },
          ],
        },
        { label: 'Features', items: [{ autogenerate: { directory: 'features' } }] },
        { label: 'Concepts', items: [{ autogenerate: { directory: 'concepts' } }] },
        {
          label: 'Formats',
          items: [
            { label: "JSON or Cap'n Proto?", link: '/json-or-capnp/' },
            { label: "Cap'n Proto guide", link: '/capnp/' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'API reference', link: '/api/', attrs: { 'data-astro-reload': true } },
            { label: 'OpenAPI spec (YAML)', link: 'https://docs.oureawx.com/openapi/v1/openapi.yaml' },
            { label: "Cap'n Proto schema", link: 'https://docs.oureawx.com/schema/v1/ourea.capnp' },
            { label: 'Changelog and versioning', link: '/changelog/' },
          ],
        },
      ],
    }),
  ],
});

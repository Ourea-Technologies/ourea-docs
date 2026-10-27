// SPDX-License-Identifier: BSD-2-Clause
import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        // SEO: which schema.org type this page is (src/route-data.ts).
        schemaType: z.enum(['TechArticle', 'WebAPI', 'SoftwareSourceCode', 'FAQPage', 'WebPage']).default('TechArticle'),
        // Language pages: the SDK slug in src/lib/languages.mjs.
        sdk: z.string().optional(),
        // Short title for the <title> tag when the H1 is long.
        seoTitle: z.string().optional(),
      }),
    }),
  }),
};

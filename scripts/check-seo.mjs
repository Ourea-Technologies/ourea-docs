#!/usr/bin/env node
// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// SEO and link checks over the built site (dist/), with no external service:
//   * every indexable page has a <title> (under 60 characters), a meta
//     description (under 155), an absolute canonical URL on docs.oureawx.com,
//     Open Graph and Twitter tags with an image that exists, and a
//     BreadcrumbList;
//   * no two pages share a title;
//   * the sitemap lists every indexable page, and nothing else;
//   * robots.txt points at the sitemap;
//   * every JSON-LD block parses and is a schema.org type with the properties
//     that type needs (a structural check of the schema.org vocabulary we use);
//   * every internal link and asset (href/src) resolves to a built file, and
//     every #fragment to an id on the target page;
//   * every <img> has width and height (no layout shift).
//
//   node scripts/check-seo.mjs [dist]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SITE = 'https://docs.oureawx.com';
const dist = resolve(process.argv[2] ?? 'dist');
const errors = [];
const fail = (page, m) => errors.push(`${page}: ${m}`);

const htmlFiles = readdirSync(dist, { recursive: true }).filter((f) => f.endsWith('.html'));
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
const meta = (html, attr, name) => {
  const re = new RegExp(`<meta[^>]*\\b${attr}="${name}"[^>]*>`, 'i');
  const tag = re.exec(html)?.[0];
  return tag ? decode(/content="([^"]*)"/.exec(tag)?.[1] ?? '') : undefined;
};
const urlOf = (f) => `${SITE}/${f.replace(/index\.html$/, '').replace(/\\/g, '/')}`;

// Resolve a site path to a file in dist.
const fileFor = (path) => {
  const p = decodeURIComponent(path.split('#')[0].split('?')[0]);
  const candidates = p.endsWith('/') ? [join(dist, p, 'index.html')] : [join(dist, p), join(dist, p, 'index.html'), join(dist, `${p}.html`)];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile());
};
const idCache = new Map();
const idsOf = (file) => {
  if (!idCache.has(file)) idCache.set(file, new Set([...readFileSync(file, 'utf8').matchAll(/\bid="([^"]+)"/g)].map((m) => decode(m[1]))));
  return idCache.get(file);
};

// ── JSON-LD vocabulary: the types and properties we use ─────────────────
const absUrl = (v) => typeof v === 'string' && /^https:\/\//.test(v);
const LD = {
  BreadcrumbList: (o) => Array.isArray(o.itemListElement) && o.itemListElement.length > 0 && o.itemListElement.every((it, i) => it['@type'] === 'ListItem' && it.position === i + 1 && typeof it.name === 'string' && absUrl(it.item)),
  TechArticle: (o) => typeof o.headline === 'string' && o.headline.length <= 110 && absUrl(o.url) && o.author?.['@type'] === 'Organization',
  WebPage: (o) => typeof o.name === 'string' && absUrl(o.url),
  WebAPI: (o) => typeof o.name === 'string' && o.provider?.['@type'] === 'Organization' && absUrl(o.documentation) && (!o.offers || (o.offers['@type'] === 'Offer' && typeof o.offers.price === 'string' && /^[A-Z]{3}$/.test(o.offers.priceCurrency))),
  SoftwareSourceCode: (o) => absUrl(o.codeRepository) && typeof o.programmingLanguage === 'string' && o.license === 'https://opensource.org/licenses/BSD-2-Clause' && typeof o.name === 'string',
  FAQPage: (o) => Array.isArray(o.mainEntity) && o.mainEntity.length > 0 && o.mainEntity.every((q) => q['@type'] === 'Question' && typeof q.name === 'string' && q.acceptedAnswer?.['@type'] === 'Answer' && typeof q.acceptedAnswer.text === 'string' && !/[<>]/.test(q.acceptedAnswer.text)),
};

const titles = new Map();
const indexable = [];
for (const f of htmlFiles) {
  const html = readFileSync(join(dist, f), 'utf8');
  const page = `/${f}`;
  const isRedirect = /http-equiv="refresh"/i.test(html);
  const noindex = /<meta[^>]*name="robots"[^>]*noindex/i.test(html);
  const is404 = f === '404.html';

  // Links resolve (every page, redirects included).
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const raw = decode(m[1]);
    if (/^(https?:|mailto:|data:|javascript:|#$)/.test(raw)) continue;
    if (raw.startsWith('#')) {
      if (!idsOf(join(dist, f)).has(raw.slice(1))) fail(page, `fragment ${raw} has no target on the page`);
      continue;
    }
    if (!raw.startsWith('/')) continue; // relative asset paths inside third-party markup
    const target = fileFor(raw);
    if (!target) {
      fail(page, `link ${raw} resolves to no file`);
      continue;
    }
    const frag = raw.split('#')[1];
    if (frag && target.endsWith('.html') && !idsOf(target).has(decodeURIComponent(frag))) fail(page, `link ${raw}: no #${frag} on the target page`);
  }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\swidth=/.test(m[0]) || !/\sheight=/.test(m[0])) fail(page, `<img> without width and height: ${m[0].slice(0, 80)}`);
  }

  if (isRedirect || noindex || is404) continue;
  indexable.push(urlOf(f));

  const title = decode(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '');
  if (!title) fail(page, 'no <title>');
  else if (title.length >= 60) fail(page, `title is ${title.length} characters (under 60): "${title}"`);
  if (titles.has(title)) fail(page, `duplicate title "${title}" (also ${titles.get(title)})`);
  titles.set(title, page);

  const desc = meta(html, 'name', 'description');
  if (!desc) fail(page, 'no meta description');
  else if (desc.length >= 155) fail(page, `description is ${desc.length} characters (under 155)`);

  const canonical = /<link[^>]*rel="canonical"[^>]*href="([^"]+)"/.exec(html)?.[1];
  if (!canonical) fail(page, 'no canonical');
  else if (!canonical.startsWith(`${SITE}/`)) fail(page, `canonical ${canonical} is not on ${SITE}`);

  for (const [attr, name] of [['property', 'og:title'], ['property', 'og:description'], ['property', 'og:image'], ['property', 'og:url'], ['name', 'twitter:card'], ['name', 'twitter:image']]) {
    if (!meta(html, attr, name)) fail(page, `no ${name}`);
  }
  const og = meta(html, 'property', 'og:image');
  if (og && !(og.startsWith(`${SITE}/`) && fileFor(og.slice(SITE.length)))) fail(page, `og:image ${og} is not a built file`);

  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const types = [];
  for (const b of blocks) {
    let o;
    try {
      o = JSON.parse(b[1]);
    } catch (e) {
      fail(page, `JSON-LD does not parse: ${e.message}`);
      continue;
    }
    if (o['@context'] !== 'https://schema.org') fail(page, `JSON-LD @context is ${o['@context']}`);
    const check = LD[o['@type']];
    if (!check) fail(page, `JSON-LD @type ${o['@type']} is not one we validate`);
    else if (!check(o)) fail(page, `JSON-LD ${o['@type']} is missing required properties or has invalid values`);
    types.push(o['@type']);
  }
  if (!types.includes('BreadcrumbList')) fail(page, 'no BreadcrumbList JSON-LD');
  if (types.length < 2) fail(page, 'no page-type JSON-LD beside the BreadcrumbList');
}

// Sitemap.
const sitemapUrls = new Set();
for (const f of readdirSync(dist).filter((x) => /^sitemap-\d+\.xml$/.test(x))) {
  for (const m of readFileSync(join(dist, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapUrls.add(m[1]);
}
if (!existsSync(join(dist, 'sitemap-index.xml'))) errors.push('no sitemap-index.xml');
for (const u of indexable) if (!sitemapUrls.has(u)) errors.push(`sitemap: ${u} is missing`);
for (const u of sitemapUrls) if (!indexable.includes(u)) errors.push(`sitemap: ${u} is not an indexable page`);
const robots = existsSync(join(dist, 'robots.txt')) ? readFileSync(join(dist, 'robots.txt'), 'utf8') : '';
if (!robots.includes(`Sitemap: ${SITE}/sitemap-index.xml`)) errors.push('robots.txt does not point at the sitemap');

console.log(`${htmlFiles.length} HTML files, ${indexable.length} indexable pages, ${sitemapUrls.size} sitemap URLs, ${titles.size} titles`);
if (errors.length) {
  for (const e of errors) console.error(`FAIL ${e}`);
  console.error(`\n${errors.length} problems`);
  process.exit(1);
}
console.log('seo: ok');

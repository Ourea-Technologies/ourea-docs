// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The changelog as an Atom feed (RFC 4287), from src/data/changelog.mjs.
import { CHANGELOG } from '../data/changelog.mjs';

const SITE = 'https://docs.oureawx.com';
const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// The changelog's inline Markdown (`code`, **bold**, [links](url)) as HTML.
const html = (s) =>
  x(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u.startsWith('/') ? SITE + u : u}">${t}</a>`);

export const atomFeed = () => {
  const updated = `${CHANGELOG.map((e) => e.date).sort().at(-1)}T00:00:00Z`;
  const entries = CHANGELOG.map((e) => {
    const ops = e.operations.length ? e.operations.map((o) => `<code>${x(o)}</code>`).join(', ') : 'all';
    const content = `<p>${html(e.body)}</p><p><strong>Kind:</strong> ${x(e.kind)}. <strong>Breaking?</strong> ${html(e.breaking)}. <strong>Operations:</strong> ${ops}.</p>`;
    return [
      '  <entry>',
      `    <id>${SITE}/changelog/#${e.slug}</id>`,
      `    <title>${x(`${e.date}: ${e.title}`)}</title>`,
      `    <link rel="alternate" type="text/html" href="${SITE}/changelog/#${e.slug}"/>`,
      `    <updated>${e.date}T00:00:00Z</updated>`,
      `    <category term="${x(e.kind)}"/>`,
      `    <content type="html">${x(content)}</content>`,
      '  </entry>',
    ].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '  <title>Ourea weather API changelog</title>',
    '  <subtitle>Changes to the Ourea weather API v1 contract: additions, behaviour changes and deprecations.</subtitle>',
    `  <id>${SITE}/changelog/</id>`,
    `  <link rel="self" type="application/atom+xml" href="${SITE}/changelog/feed.xml"/>`,
    `  <link rel="alternate" type="text/html" href="${SITE}/changelog/"/>`,
    `  <updated>${updated}</updated>`,
    '  <author><name>Ourea Technologies</name><uri>https://oureawx.com</uri></author>',
    ...entries,
    '</feed>',
    '',
  ].join('\n');
};

// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Clean Markdown for every docs page (/<page>.md, llms-full.txt): the MDX
// source with each component replaced by the Markdown of what it renders.
// Only the components the pages use are handled; an unknown component fails
// the build rather than leaking into the output.
import { FAQ } from '../data/faq';
import { CAPNP_DECODERS, HTTP_EXAMPLES, comingSdks, raw, sdkTabFor, tabsFor, type Task } from './examples';
import { SDKS } from './languages.mjs';
import { annotatedResponse } from './responses.mjs';
import { RESPONSE_NOTE } from './responses-text';
import { languageNotes, rateLimitTable, tierTable, toMarkdown } from './tables';

export const SITE = 'https://docs.oureawx.com';

const attrs = (s: string): Record<string, string> => Object.fromEntries([...s.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const fence = (code: string, lang: string, title?: string) => `${title ? `\`${title}\`\n\n` : ''}\`\`\`${lang}\n${code.replace(/\n+$/, '')}\n\`\`\``;

const exampleMd = (task: Task) => {
  const tabs = tabsFor(task);
  const pending = tabs.filter((t) => !t.code).map((t) => t.label);
  return [
    ...tabs.filter((t) => t.code).map((t) => `**${t.label}**\n\n${fence(t.code ?? '', t.hl)}${t.jq ? `\n\nReadable in a terminal, with jq:\n\n${fence(t.jq, 'bash')}` : ''}`),
    ...(pending.length ? [`SDK examples coming in each SDK's 0.1 release: ${pending.join(', ')}. The SDKs send the same canonical URL as the curl example.`] : []),
    ...(comingSdks().length ? [`Coming: ${comingSdks().map((s) => `${s.label} ([${s.repoName}](${s.repo}))`).join(', ')}.`] : []),
  ].join('\n\n');
};

const sdkMd = (sdk: string, task: Task) => {
  const t = sdkTabFor(task, sdk);
  return t.code ? fence(t.code, t.hl) : t.placeholder ?? '';
};

const replacers: [RegExp, (a: Record<string, string>) => string][] = [
  [/<Example ([^>]*?)\/>/g, (a) => exampleMd(a.task as Task)],
  [/<ExampleResponse ([^>]*?)\/>/g, (a) => {
    const r = annotatedResponse(process.cwd(), a.task);
    return `The response (${r.status} for \`${r.request}\`). ${RESPONSE_NOTE}\n\n${fence(r.code, 'jsonc')}`;
  }],
  [/<HttpExample ([^>]*?)\/>/g, (a) => fence(raw(HTTP_EXAMPLES[a.lang].path), HTTP_EXAMPLES[a.lang].hl, HTTP_EXAMPLES[a.lang].path.split('/').pop())],
  [/<SdkExample ([^>]*?)\/>/g, (a) => sdkMd(a.sdk, a.task as Task)],
  [/<LanguageNotes ([^>]*?)\/>/g, (a) => toMarkdown(languageNotes(a.sdk))],
  [/<LanguageNotesTabs\s*\/>/g, () => SDKS.map((s) => `### ${s.label}\n\n${toMarkdown(languageNotes(s.slug))}`).join('\n\n')],
  [/<TierTable\s*\/>/g, () => toMarkdown(tierTable())],
  [/<RateLimitTable\s*\/>/g, () => toMarkdown(rateLimitTable())],
  [/<FaqList\s*\/>/g, () => FAQ.map((f) => `## ${f.q}\n\n${f.a}${f.link ? `\n\n[${f.link.text}](${f.link.href})` : ''}`).join('\n\n')],
  [/<CapnpDecoders\s*\/>/g, () => CAPNP_DECODERS.map((d) => `**${d.label}**\n\n${fence(raw(d.path), d.hl, d.path)}`).join('\n\n')],
  [/<RequestBuilder\s*\/>/g, () => '_The interactive builder is on the web page: https://docs.oureawx.com/request-builder/. The rules it follows are below._'],
  [/<LinkCard ([^>]*?)\/>/g, (a) => `- [${a.title}](${a.href})${a.description ? `: ${a.description}` : ''}`],
];

const asides = (s: string) =>
  s.replace(/<Aside([^>]*)>([\s\S]*?)<\/Aside>/g, (_, at: string, inner: string) => {
    const a = attrs(at);
    const label = a.title ?? ({ caution: 'Caution', tip: 'Tip', danger: 'Danger' } as Record<string, string>)[a.type] ?? 'Note';
    return inner
      .trim()
      .split('\n')
      .map((l, i) => `> ${i === 0 ? `**${label}:** ` : ''}${l}`)
      .join('\n');
  });

export const toCleanMarkdown = (title: string, description: string | undefined, body: string): string => {
  let s = body.replace(/^import .*;?\n/gm, '');
  s = asides(s);
  // Without a capture group the second callback argument is the match offset.
  for (const [re, fn] of replacers) s = s.replace(re, (...m: unknown[]) => fn(attrs(typeof m[1] === 'string' ? m[1] : '')));
  s = s.replace(/<\/?(Steps|CardGrid)>\n?/g, '');
  const left = /<[A-Z][A-Za-z]*[\s/>]/.exec(s.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, ''));
  if (left) throw new Error(`markdown export: unhandled component ${left[0]} in "${title}"`);
  // Absolute links, so the text stands on its own.
  s = s.replace(/\]\(\//g, `](${SITE}/`);
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return `# ${title}\n\n${description ? `> ${description}\n\n` : ''}${s}\n`;
};

/** The .md URL of a docs entry. */
export const mdPath = (id: string) => `/${id || 'index'}.md`;

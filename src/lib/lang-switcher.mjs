// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The ?lang= half of the language/transport switcher. Starlight's synced
// tabs (syncKey "lang") already switch every tab group on the page together
// and remember the choice in localStorage; this inline script, run in <head>
// before any tab group renders, makes the URL win:
//   * on load, ?lang=python selects the Python tab in every group;
//   * on a tab click, the URL is rewritten (replaceState) to ?lang=<slug>, so
//     the address bar is always a deep link to what the reader sees.
import { ALIASES, ALL } from './languages.mjs';

const bySlug = Object.fromEntries(ALL.map((l) => [l.slug, l.label]));
const byLabel = Object.fromEntries(ALL.map((l) => [l.label, l.slug]));

export const langSwitcherScript = `(() => {
  const bySlug = ${JSON.stringify(bySlug)};
  const byLabel = ${JSON.stringify(byLabel)};
  const aliases = ${JSON.stringify(ALIASES)};
  const KEY = 'starlight-synced-tabs__lang';
  try {
    const params = new URLSearchParams(location.search);
    const raw = (params.get('lang') || '').toLowerCase();
    const slug = aliases[raw] || raw;
    if (bySlug[slug]) localStorage.setItem(KEY, bySlug[slug]);
  } catch (e) { /* storage blocked: tabs fall back to the first one */ }
  document.addEventListener('click', (event) => {
    const tab = event.target instanceof Element && event.target.closest('starlight-tabs[data-sync-key="lang"] [role="tab"]');
    if (!tab) return;
    const slug = byLabel[(tab.textContent || '').trim()];
    if (!slug) return;
    const url = new URL(location.href);
    url.searchParams.set('lang', slug);
    history.replaceState(history.state, '', url);
  });
})();`;

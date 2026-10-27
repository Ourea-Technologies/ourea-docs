// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The links behind each page's actions: its Markdown alternate, and a
// prefilled prompt for Claude and ChatGPT that points the assistant at that
// Markdown. Static URLs, built per page; no script involved.
import { SITE, mdPath } from './markdown';

export const pageActions = (id: string, title: string) => {
  const md = `${SITE}${mdPath(id)}`;
  const prompt = `Read ${md} (the Ourea weather API docs page "${title}") so I can ask you questions about it.`;
  return {
    md: mdPath(id),
    claude: `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
    chatgpt: `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
  };
};

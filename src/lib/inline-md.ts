// SPDX-License-Identifier: BSD-2-Clause
// The inline Markdown the data tables use: `code`, **bold** and [links](url).
// Escapes HTML first, so table text can never inject markup.
export const marked = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

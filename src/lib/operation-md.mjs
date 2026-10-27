// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The API reference as Markdown, one section per operation, for agents
// (/api/<operationId>.md and llms-full.txt). Built from the served OpenAPI
// file (the pinned spec plus the tested code samples), so it says exactly
// what the interactive reference says.
import YAML from 'yaml';
import { operationsOf, servedOpenApi } from './code-samples.mjs';

export const SITE = 'https://docs.oureawx.com';

const cell = (s) => String(s ?? '').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim();
const fence = (code, lang) => `\`\`\`${lang}\n${code.replace(/\n+$/, '')}\n\`\`\``;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const auth = (security) => {
  if (security.length === 0) return 'none: an open route, sent without credentials';
  if (security.some((s) => Object.keys(s).length === 0)) return 'optional: anonymous requests are served at the Free tier; an `X-API-Key` header uses your own budget';
  return 'required: an `X-API-Key` header (Pro)';
};

const typeOf = (schema) => {
  if (!schema) return '';
  if (schema.$ref) return schema.$ref.split('/').pop();
  const t = Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type ?? '';
  return schema.enum ? `${t} (${schema.enum.map((e) => `\`${e}\``).join(', ')})` : t;
};

/** { id, title, markdown } for every operation, in spec order. */
export const operationPages = (root) => {
  const spec = YAML.parse(servedOpenApi(root));
  const resolveRef = (o) => (o?.$ref ? o.$ref.replace(/^#\//, '').split('/').reduce((a, k) => a[k], spec) : o);
  return operationsOf(spec).map(({ id, method, template, op }) => {
    const security = op.security ?? spec.security ?? [];
    const tag = op.tags?.[0] ?? 'default';
    const anchor = `${SITE}/api/#tag/${slug(tag)}/${method.toUpperCase()}${template}`;
    const out = [
      `# ${op.summary ?? id}`,
      '',
      `operationId: \`${id}\` · \`${method.toUpperCase()} ${template}\` · base URL \`https://api.oureawx.com\``,
      '',
      `Credentials: ${auth(security)}.`,
      '',
      (op.description ?? '').trim(),
    ];
    const params = (op.parameters ?? []).map(resolveRef);
    if (params.length) {
      out.push('', '## Parameters', '', '| Name | In | Type | Required | Default | Description |', '|---|---|---|---|---|---|');
      for (const p of params) {
        const schema = resolveRef(p.schema ?? {});
        const def = schema?.default === undefined ? '' : `\`${schema.default}\``;
        out.push(`| \`${p.name}\` | ${p.in} | ${cell(typeOf(schema))} | ${p.required ? 'yes' : 'no'} | ${def} | ${cell(p.description)} |`);
      }
    }
    const responses = Object.entries(op.responses ?? {});
    if (responses.length) {
      out.push('', '## Responses', '', '| Status | Body | Description |', '|---|---|---|');
      for (const [status, r0] of responses) {
        const r = resolveRef(r0);
        const body = Object.entries(r.content ?? {})
          .map(([type, c]) => `${type}${c.schema ? `: ${typeOf(c.schema)}` : ''}`)
          .join('; ');
        out.push(`| ${status} | ${cell(body)} | ${cell(r.description)} |`);
      }
    }
    const samples = op['x-codeSamples'] ?? [];
    if (samples.length) {
      out.push('', '## Examples', '', 'Each is a tested example file from the docs repository.');
      for (const s of samples) out.push('', `**${s.label}**`, '', fence(s.source, s.lang));
    }
    out.push('', `Interactive reference: ${anchor}`, '');
    return { id, title: op.summary ?? id, markdown: out.join('\n') };
  });
};

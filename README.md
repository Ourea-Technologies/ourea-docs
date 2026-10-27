# docs.oureawx.com

The developer docs for the [Ourea](https://oureawx.com) probabilistic weather
API: Astro + Starlight, built to static files and served by Cloudflare
Workers static assets.

```sh
npm ci
npm run dev          # http://localhost:4321
npm run gate         # build, SEO and link checks, every example
```

## Where things come from

| What | Source | Refresh |
|---|---|---|
| `spec/vectors/`, `spec/openapi/v1/openapi.yaml` | [ensemble-weather-spec](https://github.com/Ourea-Technologies/ensemble-weather-spec) at `spec/VERSION` | `npm run sync:spec` |
| `public/schema/v1/ourea.capnp` | the Ourea server's schema, with maintainers' comments removed and every declaration checked identical (`public/schema/v1/SOURCE.json`) | `npm run sync:schema -- --source <file>` |
| `examples/capnp/fixtures/` | the server's golden test message (`fixtures/source.json`) | by hand |
| `src/data/limits.json` | the limits the docs publish, checked against the OpenAPI spec | by hand |
| `src/data/recorded/` | responses recorded from the live API for the charts: the request, date, API version and shape in each file, only the fields the charts draw | `node scripts/record-fixtures.mjs` (by hand) |
| `src/data/geo/conus-states.json` | US Census Bureau cartographic boundaries (states, 1:20,000,000, public domain), simplified | `node scripts/build-basemap.mjs <shapefile>` |
| `examples/sdk/<lang>/` | each SDK repo's `examples/`, at the ref in `examples/sdk-refs.json` | `npm run sync:examples` |
| `examples/curl/`, `examples/capnp/`, `examples/http/` | this repo | edit, then `npm run gate` |

Pages never paste code: `<Example task="...">` renders the files listed in
`examples/manifest.json`, one tab per transport and SDK. The tabs share one
switcher (`?lang=python` in the URL, remembered across pages).

The API reference uses the same files: the served
`/openapi/v1/openapi.yaml` is the pinned spec copy with each operation's
examples added as `x-codeSamples` at build time
(`src/lib/code-samples.mjs`), and its language picker follows the same
switcher.

Under the quickstarts, `<ExampleResponse task="...">` shows the response the
example gets: the mock API (`scripts/mock-server.mjs`) answers the example's
own request from the spec's test vectors at build time, and
`src/lib/responses.mjs` trims and annotates the body without changing a
value.

Every page has actions under its title: copy or view its Markdown
alternate (`/<page>.md`), or open it in Claude or ChatGPT with a prompt
pointing at that Markdown. The API reference has one Markdown page per
operation (`/api/<operationId>.md`, `src/lib/operation-md.mjs`), listed in
`llms.txt` and appended to `llms-full.txt`.

## Changelog

Changelog entries live in `src/data/changelog.mjs` (date, kind, a
"Breaking?" note, the operations touched, and the text). The changelog
page's table and entries and the Atom feed at `/changelog/feed.xml` are
built from that list; `tests/changelog.test.mjs` checks both.

## API clients

`/downloads/ourea-weather-api.bruno.zip` is a Bruno collection built from
the served OpenAPI file (`src/lib/bruno.mjs`): one request per operation on
the canonical URL of its tested curl sample. The Run in Postman button is
behind `postman.enabled` in `src/data/site.json`, off until a public Postman
workspace exists; set `postman.url` to the public collection URL and turn it
on.

## Charts

`<Chart kind="fan|plume|blend|coverage">` draws an SVG at build time
(`src/lib/charts.mjs`, no client script) from a recorded response or, for
the coverage map, the spec's coverage window over the Census outline. Only
served values are vertices; straight lines join served hours, and nothing is
smoothed, summed or interpolated (`tests/charts.test.mjs` counts them).

The current recordings come from the pre-v1 API (0.1603.0, 2026-10-27);
`src/lib/recorded.mjs` reads both shapes. Once v1 is deployed, re-record
(`node scripts/record-fixtures.mjs`) and check the charts on
`/concepts/quantiles/`, `/concepts/adding-quantiles/`, `/features/plumes/`
and `/features/models/`.

## The docs MCP server

`workers/docs/` is the site's one Worker script: every path is a static file
except `/mcp`, a read-only, keyless MCP server (Streamable HTTP) with
`search_docs` over a build-time index (`/mcp/index.json`) and `read_page`,
which returns a page's own Markdown. Try it locally:

```sh
npm run build && npx wrangler dev     # then POST JSON-RPC to http://localhost:8787/mcp
```

## Status

`workers/status/` (its own `wrangler.jsonc`) is a cron Worker: every 5
minutes it probes four anonymous API routes and keeps 24 hours of results,
plus the latest blend run from the forecast's `model_run`, in one KV key.
The docs Worker forwards `/status/data.json` and `/status/badge.svg` to it
through a service binding; `/status/` reads the JSON. Locally:

```sh
npx wrangler dev -c workers/status/wrangler.jsonc --test-scheduled --port 8800
curl "http://localhost:8800/__scheduled?cron=*/5+*+*+*+*"     # one probe
npx wrangler dev -c wrangler.jsonc -c workers/status/wrangler.jsonc --persist-to workers/status/.wrangler/state
```

## Page feedback

Every page shows its last-updated date (from git: build from a full clone)
and "Was this page helpful? Yes · No": each opens the page-feedback issue
form (`.github/ISSUE_TEMPLATE/page_feedback.yml`) with the page and the
answer filled in. There is no backend.

## Checks

- `scripts/check-examples.mjs`: every referenced example exists, then runs
  the curl and Cap'n Proto CLI scripts against `scripts/mock-server.mjs`
  (answers from the spec's test vectors), the no-SDK quickstarts, and the
  Cap'n Proto decoders against the golden message.
- `tests/*.test.mjs` (`npm run test:unit`): the request builder's
  canonical URLs against the spec's `canonical/`, `prob/`, `totals/` and
  `request/` vectors, and against the mock API; the docs MCP server
  against the built site.
- `scripts/check-reference.mjs`: the served OpenAPI file differs from the
  pinned spec only by `x-codeSamples`; every operation has at least a curl
  sample; every sample is text from a tested example file.
- `scripts/check-seo.mjs`: titles, descriptions, canonicals, Open Graph,
  JSON-LD, sitemap coverage and every internal link in `dist/`.
- The build itself fails on a broken internal link or anchor
  (starlight-links-validator).

## Deploy

`wrangler.jsonc` describes the docs Worker (static assets plus `/mcp` and the status routes) and `workers/status/wrangler.jsonc` the status Worker, which deploys first; the `docs.oureawx.com` custom domain
comes from Terraform in the Ourea repository. Deploys are manual.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), and [SECURITY.md](SECURITY.md) for vulnerability reports.

## Licence

[BSD-2-Clause](LICENSE).

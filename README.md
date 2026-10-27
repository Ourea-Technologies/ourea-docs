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

## Checks

- `scripts/check-examples.mjs`: every referenced example exists, then runs
  the curl and Cap'n Proto CLI scripts against `scripts/mock-server.mjs`
  (answers from the spec's test vectors), the no-SDK quickstarts, and the
  Cap'n Proto decoders against the golden message.
- `scripts/check-reference.mjs`: the served OpenAPI file differs from the
  pinned spec only by `x-codeSamples`; every operation has at least a curl
  sample; every sample is text from a tested example file.
- `scripts/check-seo.mjs`: titles, descriptions, canonicals, Open Graph,
  JSON-LD, sitemap coverage and every internal link in `dist/`.
- The build itself fails on a broken internal link or anchor
  (starlight-links-validator).

## Deploy

`wrangler.jsonc` describes the Worker; the `docs.oureawx.com` custom domain
comes from Terraform in the Ourea repository. Deploys are manual.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), and [SECURITY.md](SECURITY.md) for vulnerability reports.

## Licence

[BSD-2-Clause](LICENSE).

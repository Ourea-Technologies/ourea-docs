# Contributing to the Ourea docs

Thanks for helping make Ourea better. Fixes to a sentence, a broken example
or a whole new guide are all welcome, and every issue and pull request gets
read.

## Asking, reporting, requesting

- **Questions** go to [Discussions](https://github.com/Ourea-Technologies/ourea-docs/discussions) (Q&A), not issues.
- **A wrong or unclear page:** the [docs problem](https://github.com/Ourea-Technologies/ourea-docs/issues/new?template=docs.yml) form, or the "Open an issue" link at the bottom of any page.
- **A failing example:** the [broken example](https://github.com/Ourea-Technologies/ourea-docs/issues/new?template=broken_example.yml) form. Include the error, the HTTP status and the `request_id` if there is one. Never paste an API key.
- **A guide you wish existed:** [request a guide](https://github.com/Ourea-Technologies/ourea-docs/issues/new?template=guide_request.yml).
- **SDK bugs and features** belong to that SDK's repository; **API features**
  to [ensemble-weather-spec](https://github.com/Ourea-Technologies/ensemble-weather-spec),
  where the API's behaviour lives. We'll move an issue that landed in the
  wrong place.
- **Security problems:** see [SECURITY.md](SECURITY.md). Never a public issue.

We aim for a first response on new issues and pull requests within a few
business days.

## Running the site locally

Node.js 22 or later:

```sh
npm ci
npm run dev                         # http://localhost:4321
npm run build                       # static site in dist/, fails on a broken internal link
node scripts/check-seo.mjs dist     # titles, descriptions, canonicals, JSON-LD, sitemap, links
node scripts/check-reference.mjs    # the API reference's code samples (after a build)
node scripts/check-examples.mjs     # every example exists and runs
```

`check-examples` runs the curl and Cap'n Proto CLI examples against a local
mock of the API (`scripts/mock-server.mjs`, answering from the spec's test
vectors), so it needs `curl`, `jq` and the `capnp` tool. The no-SDK
quickstarts need each language's toolchain and the Cap'n Proto decoders
`cargo`, `uv`, `go`, a C++ compiler with libcapnp, `gradle` and a JDK. Pass
`--run curl` to run only the shell examples, or `--allow-missing` to skip
toolchains you don't have. The real API is never called by the checks.

## How pages and examples fit together

- Pages are MDX in `src/content/docs/`.
- **Pages never paste code.** `<Example task="...">` renders files listed in
  `examples/manifest.json`: one tab per transport and SDK, all switched
  together (`?lang=python` in the URL).
- `examples/curl/` and `examples/capnp/` are this repository's own runnable
  examples; edit them and run the checks.
- `examples/sdk/<lang>/` is **copied** from each SDK repository's `examples/`
  (Dart's `example/`) at the ref pinned in `examples/sdk-refs.json`, by
  `node scripts/sync-examples.mjs` (add `--remote` to clone from GitHub). To
  fix an SDK example, change it in the SDK repository, then bump the ref here
  and re-run the sync. A task an SDK has no example for shows a "coming in
  0.1" placeholder; an SDK with no ref pinned yet has no tab and is listed
  as coming.
- `spec/openapi/v1/openapi.yaml` is the API server's public spec, read from
  the server repository (`node scripts/sync-spec.mjs --server <repo>`); the
  vectors in `spec/vectors/` come from
  [ensemble-weather-spec](https://github.com/Ourea-Technologies/ensemble-weather-spec)
  at `spec/VERSION`, which must carry the same server spec.
  `public/schema/v1/` is the published Cap'n Proto schema and the `go.capnp`
  it imports (`node scripts/sync-schema.mjs --source <repo>`; `--check`
  verifies it). Never edit these by hand.

## Writing style

Number first, then the event, threshold, place and window for any
probability ("70 % chance of at least 6 in of snow at the summit, 6 pm Friday
to 6 am Saturday"). Ranges read "most likely p50, at least p10, could reach
p90". Every fact comes from the API spec; if you can't source it, open an
issue instead.

## Pull requests

Keep them focused, run the checks above, and fill in the template.
Contributors are credited by GitHub handle in the changelog. By contributing
you agree that your work is licensed under the repository's
[BSD-2-Clause licence](LICENSE).

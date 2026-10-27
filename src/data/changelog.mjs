// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The API changelog, newest first. The changelog page's table and entries
// and the Atom feed (/changelog/feed.xml) are both built from this list.
// `kind` is one of KINDS; `breaking` says, in words, whether an existing
// client must change anything; `operations` are operationIds in the spec.
// Every entry restates the public spec: cite it, never add to it.

export const KINDS = ['Release', 'Additive', 'Behaviour change', 'Deprecation', 'Breaking'];

export const CHANGELOG = [
  {
    date: '2026-10-26',
    slug: 'contract-1-0-0',
    title: 'Contract 1.0.0',
    kind: 'Release',
    breaking: 'No: the v1 baseline',
    operations: [],
    body: 'The v1 contract lock: the public spec in [ensemble-weather-spec](https://github.com/Ourea-Technologies/ensemble-weather-spec) at `openapi/v1/openapi.yaml`. From here v1 changes only additively.',
  },
  {
    date: '2026-10-19',
    slug: 'hourly-series-starts-now',
    title: 'The hourly series starts now',
    kind: 'Behaviour change',
    breaking: 'Changed a default: `include_past=true` restores the old window',
    operations: ['getLocationForecast', 'getPointForecast'],
    body: "The hourly `timeseries` starts at the current hour instead of the model run's init, and `max_hours` counts from it. `include_past=true` restores the old window. Locations carry their IANA `timezone`.",
  },
];

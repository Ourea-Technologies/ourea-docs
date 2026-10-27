// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The FAQ, rendered on /faq/ and emitted as FAQPage JSON-LD from the same
// list. Every answer is sourced from ensemble-weather-spec (openapi/v1,
// BEHAVIOR.md) or the Ourea server; keep it that way.
export interface Faq {
  q: string;
  a: string;
  link?: { href: string; text: string };
}

export const FAQ: Faq[] = [
  {
    q: 'Is the Ourea weather API free?',
    a: 'Yes, at the Free tier. Requests without credentials, and requests with a Free API key, are served at the Free tier: forecasts for named locations to a 10-day (240 h) horizon from the latest model run, current conditions and active alerts for named locations, and location search and the catalog. Forecasts at arbitrary coordinates, per-model breakdowns, pinned historical runs and the full 15-day (360 h) horizon need Pro.',
    link: { href: '/weather-api/free/', text: 'What the free tier includes' },
  },
  {
    q: 'Do I need an API key or a signup?',
    a: 'No, not for named locations. Forecast, current-conditions and alert routes for a named location answer without credentials, and the search and catalog routes need none. Send an `X-API-Key` only when you want your own Free or Pro budget, or a Pro feature such as forecasts by coordinates.',
    link: { href: '/weather-api/no-api-key/', text: 'Make a call with no key' },
  },
  {
    q: 'What area does the API cover?',
    a: 'The contiguous United States. Named locations are served CONUS-wide; a coordinate forecast must fall inside the forecast coverage window and over land in a US state, otherwise the API answers `404 OUTSIDE_COVERAGE`.',
    link: { href: '/features/places/', text: 'Ways to ask for a place' },
  },
  {
    q: 'What are the rate limits?',
    a: 'The documented sustained limit is 60 requests per minute, with short bursts allowed; a daily quota and an hourly budget of catalog rows also apply, and Pro keys get a larger budget. Credentialed responses carry `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` and `RateLimit-Policy`; over a budget is `429` with `Retry-After`. Read the headers rather than hard-coding numbers.',
    link: { href: '/features/rate-limits/', text: 'Rate limits' },
  },
  {
    q: 'How do the probabilities work?',
    a: 'The server computes every probability from the full ensemble: each member votes, pooled across models. Ask with `prob=` (a variable, `ge` or `le`, a threshold and a window), for example `prob=snowfall:ge:6.000:24h&units=imperial` for the chance of at least 6 in of snow in the next 24 h. Each answer names its variable, threshold, window and the number of members that voted.',
    link: { href: '/concepts/probabilities/', text: 'What a probability refers to' },
  },
  {
    q: 'Can I add up the hourly p90 values to get a storm total?',
    a: 'No. Quantiles are not additive: the sum of hourly 90th percentiles is not the 90th percentile of the total. Ask the server for the window total with `totals=snowfall:72h`; it computes each member’s own total over the window and returns that distribution.',
    link: { href: '/concepts/adding-quantiles/', text: "Why you can't add quantiles" },
  },
  {
    q: "Should I use JSON or Cap'n Proto?",
    a: "Start with JSON. Every route also answers `format=capnp`, one Cap'n Proto message with the same values, auth, rate limits and caching. Choose it when decode cost matters: mobile, embedded and in-vehicle devices, high-volume backends and large plume bodies.",
    link: { href: '/json-or-capnp/', text: "JSON or Cap'n Proto?" },
  },
  {
    q: 'Which weather models are in the forecast?',
    a: 'Up to five ensembles per forecast hour: ECMWF AIFS-ENS and IFS-ENS, and NOAA AIGEFS, GEFS and RRFS. Each response’s `model_run.models` lists the models that contributed and each one’s own cycle.',
    link: { href: '/features/models/', text: 'Models' },
  },
  {
    q: 'Which units does the API use?',
    a: 'Metric by default (°C, mm, m/s, m). `units=imperial` gives °F, inches, mph and feet, and `units=kelvin` is metric with temperatures in kelvin. Every forecast body says which system it is in, in `units`.',
    link: { href: '/features/units/', text: 'Units' },
  },
];

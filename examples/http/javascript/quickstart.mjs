// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Ourea quickstart with plain fetch (no SDK, no key). Runs in Node.js 18+,
// Deno, Bun, and in a browser module (drop the process.env line there).
// The next 24 h at Mt. Hood Meadows: each hour's temperature as a p10-p90
// range, and the chance of at least 6 in of snow, computed by the server.
// Docs: https://docs.oureawx.com/weather-api/javascript/

const API = process.env.OUREA_BASE_URL ?? 'https://api.oureawx.com';
// Canonical URL: parameters in alphabetical order, ':' and ',' literal.
const url = `${API}/api/v1/locations/or/mt-hood-meadows?prob=snowfall:ge:6.000:24h&units=imperial`;

const res = await fetch(url);
if (!res.ok) {
  const err = await res.json();
  throw new Error(`${res.status} ${err.error}: ${err.message}`);
}
const forecast = await res.json();

const place = forecast.location.name;
for (const hour of forecast.forecast.timeseries) {
  const t = hour.ensemble.temperature;
  console.log(`${hour.valid_time}  ${t.p10.toFixed(0)} to ${t.p90.toFixed(0)} °F (median ${t.p50.toFixed(0)})`);
}
// One term asked, one answer: results come back in the order the terms were sent.
const p = forecast.probabilities[0];
const window = `${p.window_start_hours}-${p.window_end_hours} h`;
if (p.probability === null) {
  // The served series does not reach the window's end.
  console.log(`Chance of at least ${p.threshold} in of snow, ${window}: not available`);
} else {
  console.log(`${Math.round(p.probability * 100)}% chance of at least ${p.threshold} in of snow at ${place}, hours ${window} (${p.members} ensemble members)`);
}

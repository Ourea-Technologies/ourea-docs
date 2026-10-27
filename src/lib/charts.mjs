// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Build-time SVG charts for the docs: no client script. They draw only what
// the server returned: each served quantile or member value is a vertex, and
// straight lines join the served hours. Nothing is smoothed, interpolated
// between quantiles, summed or averaged. The only arithmetic is placing
// values on the page (scales, ticks, a map projection).
import { MODEL_NAMES, membersAt, modelsOf } from './recorded.mjs';

const W = 720;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f1 = (n) => Math.round(n * 10) / 10;

/** Round tick values covering [lo, hi]. */
export const niceTicks = (lo, hi, count = 5) => {
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const start = Math.floor(lo / step) * step;
  const ticks = [];
  for (let v = start; v <= hi + step * 1e-9; v += step) ticks.push(Math.round(v / step) * step);
  if (ticks.at(-1) < hi) ticks.push(ticks.at(-1) + step);
  return ticks;
};

const frame = ({ height, title, desc, body }) =>
  `<svg class="ourea-chart" viewBox="0 0 ${W} ${height}" role="img" aria-labelledby="t d" xmlns="http://www.w3.org/2000/svg"><title id="t">${esc(title)}</title><desc id="d">${esc(desc)}</desc>${body}</svg>`;

const axes = ({ x0, x1, y0, y1, yTicks, yScale, yLabel, xTicks }) => {
  const parts = [];
  for (const v of yTicks) {
    const y = f1(yScale(v));
    parts.push(`<line class="grid" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/><text class="tick" x="${x0 - 6}" y="${y + 4}" text-anchor="end">${esc(v)}</text>`);
  }
  for (const t of xTicks) parts.push(`<line class="grid" x1="${f1(t.x)}" x2="${f1(t.x)}" y1="${y0}" y2="${y1}"/><text class="tick" x="${f1(t.x)}" y="${y1 + 16}" text-anchor="middle">${esc(t.label)}</text>`);
  parts.push(`<text class="axis-label" x="${x0 - 44}" y="${y0 - 10}">${esc(yLabel)}</text>`);
  return parts.join('');
};

const localTicks = (hours, xOf, timeZone, every) => {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: 'numeric' });
  return hours.flatMap((h, i) => {
    const local = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(new Date(h.valid_time)));
    return local % every === 0 ? [{ x: xOf(i), label: fmt.format(new Date(h.valid_time)) }] : [];
  });
};

const UNIT = { temperature: { imperial: '°F', metric: '°C', kelvin: 'K' }, snowfall: { imperial: 'in', metric: 'mm', kelvin: 'mm' } };

/**
 * A fan chart of one variable's served quantiles, hour by hour: the p10-p90
 * and p25-p75 bands and the p50 line. `rec` is a recording of a forecast.
 */
export const fanChart = (rec, variable, { every = 12 } = {}) => {
  const r = rec.response;
  const hours = r.timeseries.filter((h) => h.ensemble?.[variable]);
  const q = (h, k) => h.ensemble[variable][k];
  const H = 300;
  const [x0, x1, y0, y1] = [56, W - 32, 24, H - 34];
  const values = hours.flatMap((h) => ['p10', 'p90'].map((k) => q(h, k)).filter((v) => v !== undefined && v !== null));
  const ticks = niceTicks(Math.min(...values), Math.max(...values), 5);
  const [lo, hi] = [ticks[0], ticks.at(-1)];
  const xOf = (i) => x0 + ((x1 - x0) * i) / Math.max(1, hours.length - 1);
  const yOf = (v) => y1 - ((y1 - y0) * (v - lo)) / (hi - lo);
  const band = (a, b) => {
    const idx = hours.map((h, i) => i).filter((i) => q(hours[i], a) != null && q(hours[i], b) != null);
    if (!idx.length) return '';
    const top = idx.map((i) => `${f1(xOf(i))},${f1(yOf(q(hours[i], b)))}`);
    const bottom = idx.reverse().map((i) => `${f1(xOf(i))},${f1(yOf(q(hours[i], a)))}`);
    return `M${top.join('L')}L${bottom.join('L')}Z`;
  };
  const median = hours.map((h, i) => (q(h, 'p50') == null ? null : `${f1(xOf(i))},${f1(yOf(q(h, 'p50')))}`)).filter(Boolean);
  const unit = UNIT[variable]?.[r.units] ?? '';
  const name = variable === 'temperature' ? 'Temperature' : 'Snowfall per hour';
  const body = [
    axes({ x0, x1, y0, y1, yTicks: ticks, yScale: yOf, yLabel: `${name} (${unit})`, xTicks: localTicks(hours, xOf, r.location.timezone, every) }),
    `<path class="band-outer" d="${band('p10', 'p90')}"/>`,
    `<path class="band-inner" d="${band('p25', 'p75')}"/>`,
    `<path class="median" d="M${median.join('L')}"/>`,
    `<g class="legend" transform="translate(${x0 + 8},${y0 + 4})"><rect class="band-outer" width="14" height="10"/><text x="20" y="9">p10 to p90</text><rect class="band-inner" x="106" width="14" height="10"/><text x="126" y="9">p25 to p75</text><line class="median" x1="212" x2="228" y1="5" y2="5"/><text x="234" y="9">p50 (median)</text></g>`,
  ].join('');
  return frame({
    height: H,
    title: `${name} at ${r.location.name}, ${hours.length} hours: served quantiles`,
    desc: `Hourly ${variable} quantiles from the Ourea API in ${unit}: the shaded bands are p10 to p90 and p25 to p75, the line is p50. Times are local (${r.location.timezone}).`,
    body,
  });
};

/** The rows of a fan chart's table view: the served values, unrounded. */
export const fanRows = (rec, variable) =>
  rec.response.timeseries
    .filter((h) => h.ensemble?.[variable])
    .map((h) => ({ valid_time: h.valid_time, ...Object.fromEntries(['p10', 'p25', 'p50', 'p75', 'p90'].map((k) => [k, h.ensemble[variable][k]])) }));

const SERIES = (i) => `series-${(i % 5) + 1}`;

/** Every member's running snowfall total (`cumulative_snowfall`), one line per member, coloured by model. */
export const plumeChart = (rec) => {
  const r = rec.response;
  const hours = r.timeseries;
  const models = modelsOf(r.model_run);
  const H = 340;
  const [x0, x1, y0, y1] = [56, W - 12, 24, H - 34];
  const leads = hours.map((h) => h.lead_time_hours);
  const [l0, l1] = [Math.min(...leads), Math.max(...leads)];
  const xOf = (lead) => x0 + ((x1 - x0) * (lead - l0)) / Math.max(1, l1 - l0);
  let max = 0;
  for (const h of hours) for (const list of membersAt(h).values()) for (const m of list) if (m.cumulative_snowfall != null) max = Math.max(max, m.cumulative_snowfall);
  const ticks = niceTicks(0, max, 5);
  const yOf = (v) => y1 - ((y1 - y0) * v) / ticks.at(-1);
  const paths = models.map((model, mi) => {
    const lines = new Map();
    for (const h of hours) {
      for (const m of membersAt(h).get(model.id) ?? []) {
        const key = m.member_id;
        if (!lines.has(key)) lines.set(key, []);
        lines.get(key).push(m.cumulative_snowfall == null ? null : [xOf(h.lead_time_hours), yOf(m.cumulative_snowfall)]);
      }
    }
    let d = '';
    for (const pts of lines.values()) {
      let pen = 'M';
      for (const p of pts) {
        if (!p) {
          pen = 'M';
          continue;
        }
        d += `${pen}${f1(p[0])},${f1(p[1])}`;
        pen = 'L';
      }
    }
    return `<path class="member ${SERIES(mi)}" d="${d}"/>`;
  });
  const xTicks = niceTicks(0, l1, 8)
    .filter((t) => t >= l0 && t <= l1)
    .map((t) => ({ x: xOf(t), label: `${t} h` }));
  const legend = models
    .map((m, i) => `<g transform="translate(${x0 + 8 + (i % 3) * 210},${y0 + 4 + Math.floor(i / 3) * 16})"><line class="${SERIES(i)}" x1="0" x2="16" y1="5" y2="5" stroke-width="3"/><text x="22" y="9">${esc(MODEL_NAMES[m.id] ?? m.id)}${m.members ? ` (${m.members})` : ''}</text></g>`)
    .join('');
  const unit = UNIT.snowfall[r.units];
  return frame({
    height: H,
    title: `Every ensemble member's running snowfall total at ${r.location.name}`,
    desc: `One line per ensemble member, coloured by model: cumulative_snowfall in ${unit} over the served window, as the API serves it, by lead time.`,
    body: axes({ x0, x1, y0, y1, yTicks: ticks, yScale: yOf, yLabel: `Snowfall so far (${unit})`, xTicks }) + paths.join('') + `<g class="legend">${legend}</g>`,
  });
};

/** Which models' members the response serves at each lead hour: one row per model. */
export const blendDiagram = (rec) => {
  const r = rec.response;
  const hours = r.timeseries;
  const models = modelsOf(r.model_run);
  const rowH = 30;
  const [x0, x1, y0] = [210, W - 12, 28];
  const H = y0 + models.length * rowH + 40;
  const leads = hours.map((h) => h.lead_time_hours);
  const [l0, l1] = [Math.min(...leads), Math.max(...leads)];
  const xOf = (lead) => x0 + ((x1 - x0) * (lead - l0)) / Math.max(1, l1 - l0 + 1);
  const cell = Math.max(1.5, (x1 - x0) / (l1 - l0 + 1));
  const cycle = (c) => (c ? new Date(c).toISOString().replace(/^\d{4}-(\d\d)-(\d\d)T(\d\d):.*$/, '$3Z $1-$2') : '');
  const rows = models.map((m, i) => {
    const y = y0 + i * rowH;
    const marks = hours
      .filter((h) => (membersAt(h).get(m.id) ?? []).length > 0)
      .map((h) => `<rect class="${SERIES(i)}" x="${f1(xOf(h.lead_time_hours))}" y="${y + 6}" width="${f1(cell)}" height="${rowH - 14}" rx="1"/>`)
      .join('');
    return `<text class="row-label" x="0" y="${y + 14}">${esc(MODEL_NAMES[m.id] ?? m.id)}</text><text class="tick" x="0" y="${y + 26}">${m.members ? `${m.members} member${m.members === 1 ? '' : 's'}` : ''}${m.cycle ? `, cycle ${cycle(m.cycle)}` : ''}</text>${marks}`;
  });
  const axisY = y0 + models.length * rowH + 4;
  const xt = niceTicks(0, l1, 8)
    .filter((t) => t >= l0 && t <= l1)
    .map((t) => `<line class="grid" x1="${f1(xOf(t))}" x2="${f1(xOf(t))}" y1="${y0}" y2="${axisY}"/><text class="tick" x="${f1(xOf(t))}" y="${axisY + 14}" text-anchor="middle">${t} h</text>`)
    .join('');
  return frame({
    height: H,
    title: `Which models' members are served at each lead hour, ${r.location.name}`,
    desc: `One row per contributing model; a mark at every lead hour (counted from ${r.model_run.initialized_at}) where the response carries that model's members.`,
    body: `${xt}${rows.join('')}<text class="axis-label" x="${x0}" y="${axisY + 32}">Lead time from ${esc(cycle(r.model_run.initialized_at))}</text>`,
  });
};

// Albers equal-area conic for the contiguous US (standard parallels 29.5°
// and 45.5°, origin 23°N 96°W).
const RAD = Math.PI / 180;
const albers = (() => {
  const [p1, p2, p0, l0] = [29.5 * RAD, 45.5 * RAD, 23 * RAD, -96 * RAD];
  const n = (Math.sin(p1) + Math.sin(p2)) / 2;
  const C = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1);
  const rho0 = Math.sqrt(C - 2 * n * Math.sin(p0)) / n;
  return (lon, lat) => {
    const rho = Math.sqrt(C - 2 * n * Math.sin(lat * RAD)) / n;
    const th = n * (lon * RAD - l0);
    return [rho * Math.sin(th), rho0 - rho * Math.cos(th)];
  };
})();

/**
 * The coverage window (a lat/lon box) over the contiguous states.
 * `geo` is src/data/geo/conus-states.json; `box` is { lat: [s, n], lon: [w, e] }.
 */
export const coverageMap = (geo, box) => {
  const H = 400;
  const edge = [];
  const [s, n] = box.lat;
  const [w, e] = box.lon;
  for (let lon = w; lon <= e; lon += 1) edge.push([lon, n]);
  for (let lon = e; lon >= w; lon -= 1) edge.push([lon, s]);
  const all = [...geo.rings.flatMap((r) => r.ring), ...edge].map(([lon, lat]) => albers(lon, lat));
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 16;
  const k = Math.min((W - 2 * pad) / (maxX - minX), (H - 2 * pad) / (maxY - minY));
  const P = (lon, lat) => {
    const [x, y] = albers(lon, lat);
    return `${f1(pad + (x - minX) * k)},${f1(pad + (maxY - y) * k)}`;
  };
  const states = geo.rings.map((r) => `M${r.ring.map(([lon, lat]) => P(lon, lat)).join('L')}Z`).join('');
  const boxPath = `M${edge.map(([lon, lat]) => P(lon, lat)).join('L')}Z`;
  const [lx, ly] = P(w, n).split(',').map(Number);
  return frame({
    height: H,
    title: 'Ourea forecast coverage: the contiguous United States',
    desc: `The coverage window, latitude ${s} to ${n} and longitude ${w} to ${e}, drawn over the 48 contiguous states and DC.`,
    body: `<path class="land" d="${states}"/><path class="coverage" d="${boxPath}"/><text class="row-label" x="${f1(lx + 6)}" y="${f1(ly + 18)}">Coverage window: ${s}°N to ${n}°N, ${-w}°W to ${-e}°W</text>`,
  });
};

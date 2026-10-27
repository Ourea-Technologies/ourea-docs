// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Reads the responses recorded from the live API (src/data/recorded/, by
// scripts/record-fixtures.mjs) for the charts, in either response shape:
// v1 (model_run.models[], timeseries[].members as [{id, members}]) or the
// pre-v1 one (per-model model_run keys, members keyed by model). It only
// re-arranges fields; every number is as recorded.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const loadRecording = (root, name) => JSON.parse(readFileSync(join(root, 'src/data/recorded', `${name}.json`), 'utf8'));

/** The contributing models, in served order: [{ id, members, cycle }]. */
export const modelsOf = (run) => {
  if (Array.isArray(run.models)) return run.models.map((m) => ({ id: m.id, members: m.members ?? null, cycle: m.cycle ?? null }));
  const ids = (run.source_models ?? '').split(',').filter(Boolean);
  return ids.map((id) => ({ id, members: run[`${id}_members`] ?? null, cycle: run.model_cycles?.[id] ?? null }));
};

/** One hour's members as a Map of model id -> member list. */
export const membersAt = (hour) => {
  const m = hour.members;
  if (!m) return new Map();
  return Array.isArray(m) ? new Map(m.map((e) => [e.id, e.members])) : new Map(Object.entries(m));
};

/** Human names of the model ids, as the spec's attribution names them. */
export const MODEL_NAMES = {
  aifs: 'ECMWF AIFS-ENS',
  ifs_ens: 'ECMWF IFS-ENS',
  aigefs: 'NOAA AIGEFS',
  gefs: 'NOAA GEFS',
  rrfs: 'NOAA RRFS',
};

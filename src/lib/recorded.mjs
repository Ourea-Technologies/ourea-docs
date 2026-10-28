// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Reads the responses recorded from the live API (src/data/recorded/, by
// scripts/record-fixtures.mjs) for the charts, in the v1 response shape
// (model_run.models[], timeseries[].members as [{id, members}]). It only
// re-arranges fields; every number is as recorded.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const loadRecording = (root, name) => JSON.parse(readFileSync(join(root, 'src/data/recorded', `${name}.json`), 'utf8'));

/** The contributing models, in served order: [{ id, members, cycle }]. */
export const modelsOf = (run) => run.models.map((m) => ({ id: m.id, members: m.members ?? null, cycle: m.cycle ?? null }));

/** One hour's members as a Map of model id -> member list. */
export const membersAt = (hour) => {
  return new Map((hour.members ?? []).map((e) => [e.id, e.members]));
};

/** Human names of the model ids, as the spec's attribution names them. */
export const MODEL_NAMES = {
  aifs: 'ECMWF AIFS-ENS',
  ifs_ens: 'ECMWF IFS-ENS',
  aigefs: 'NOAA AIGEFS',
  gefs: 'NOAA GEFS',
  rrfs: 'NOAA RRFS',
};

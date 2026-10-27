#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Per-model breakdowns, available runs and a pinned run (Pro).
# models=true adds model_means[] to every hour; /api/v1/runs lists the cycles ?run= can pin.
# Docs: https://docs.oureawx.com/features/models/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "model_run"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"
# docs:hide-start
if [ -z "${OUREA_API_KEY:-}" ]; then
  echo "This example needs a Pro API key in OUREA_API_KEY; skipping."
  exit 0
fi
# docs:hide-end

# Per-model statistics at every hour.
curl -sS --fail-with-body --compressed -H "X-API-Key: $OUREA_API_KEY" "$API/api/v1/locations/or/mt-hood-meadows?models=true"
echo
# The runs a forecast can pin, and what is served now.
curl -sS --fail-with-body --compressed -H "X-API-Key: $OUREA_API_KEY" "$API/api/v1/runs"
echo
# A pinned historical run (served from its init).
curl -sS --fail-with-body --compressed -H "X-API-Key: $OUREA_API_KEY" "$API/api/v1/locations/or/mt-hood-meadows?run=2026-11-15T00%3A00%3A00Z"
echo

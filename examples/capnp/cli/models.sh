#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Per-model breakdowns, available runs and a pinned run (Pro), as Cap'n Proto.
# format=capnp returns the same values as one Cap'n Proto message; capnp decode prints it with the published schema.
# Docs: https://docs.oureawx.com/capnp/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"
# docs:hide-start
if [ -z "${OUREA_API_KEY:-}" ]; then
  echo "This example needs a Pro API key in OUREA_API_KEY; skipping."
  exit 0
fi
# docs:hide-end
# docs:hide-start
SCHEMA="${OUREA_CAPNP_SCHEMA:-ourea.capnp}"
# docs:hide-end

# Per-model statistics at every hour.
curl -sS --fail-with-body --compressed -H "X-API-Key: $OUREA_API_KEY" "$API/api/v1/locations/or/mt-hood-meadows?format=capnp&models=true" \
  | capnp decode "$SCHEMA" ForecastResponse
# The runs a forecast can pin, and what is served now.
curl -sS --fail-with-body --compressed -H "X-API-Key: $OUREA_API_KEY" "$API/api/v1/runs?format=capnp" \
  | capnp decode "$SCHEMA" ListRunsResponse
# A pinned historical run (served from its init).
curl -sS --fail-with-body --compressed -H "X-API-Key: $OUREA_API_KEY" "$API/api/v1/locations/or/mt-hood-meadows?format=capnp&run=2026-11-15T00%3A00%3A00Z" \
  | capnp decode "$SCHEMA" ForecastResponse

#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Choosing the horizon: max_hours, max_days and include_past, as Cap'n Proto.
# format=capnp returns the same values as one Cap'n Proto message; capnp decode prints it with the published schema.
# Docs: https://docs.oureawx.com/capnp/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"
# docs:hide-start
SCHEMA="${OUREA_CAPNP_SCHEMA:-ourea.capnp}"
# docs:hide-end

# The whole Free horizon: the current hour plus the next 240.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?format=capnp&max_hours=240" \
  | capnp decode "$SCHEMA" ForecastResponse
# Three local days of daily rows, whatever max_hours is.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?format=capnp&max_days=3" \
  | capnp decode "$SCHEMA" ForecastResponse
# From the run's init instead of now, past hours included.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?format=capnp&include_past=true&max_hours=48" \
  | capnp decode "$SCHEMA" ForecastResponse

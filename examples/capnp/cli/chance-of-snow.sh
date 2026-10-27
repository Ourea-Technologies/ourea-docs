#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Probabilities: several prob terms in one request, as Cap'n Proto.
# format=capnp returns the same values as one Cap'n Proto message; capnp decode prints it with the published schema.
# Docs: https://docs.oureawx.com/capnp/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"
# docs:hide-start
SCHEMA="${OUREA_CAPNP_SCHEMA:-ourea.capnp}"
# docs:hide-end

# P(>= 6 in in 0-24 h), P(>= 12 in in 0-72 h), P(>= 6 in in 24-48 h), P(<= 32 F at any hour in 24 h).
# max_hours=72 so the served series reaches the end of every window.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?format=capnp&max_hours=72&prob=snowfall:ge:6.000:24h,snowfall:ge:12.000:72h,snowfall:ge:6.000:24-48h,temperature:le:32.0:24h&units=imperial" \
  | capnp decode "$SCHEMA" ForecastResponse

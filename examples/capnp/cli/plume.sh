#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Plumes: every ensemble member, every hour, as Cap'n Proto.
# format=capnp returns the same values as one Cap'n Proto message; capnp decode prints it with the published schema.
# Docs: https://docs.oureawx.com/capnp/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"
# docs:hide-start
SCHEMA="${OUREA_CAPNP_SCHEMA:-ourea.capnp}"
# docs:hide-end

# The cacheable plume request (parameters in alphabetical order).
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?daily=false&format=capnp&max_hours=240&members=true&nowcast=false&units=imperial" \
  | capnp decode "$SCHEMA" ForecastResponse

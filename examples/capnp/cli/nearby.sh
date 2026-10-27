#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Nearest locations, to a location or to a coordinate, as Cap'n Proto.
# format=capnp returns the same values as one Cap'n Proto message; capnp decode prints it with the published schema.
# Docs: https://docs.oureawx.com/capnp/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"
# docs:hide-start
SCHEMA="${OUREA_CAPNP_SCHEMA:-ourea.capnp}"
# docs:hide-end

# The five nearest public locations to Mt. Hood Meadows (default 3, at most 20).
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows/nearby?format=capnp&limit=5" \
  | capnp decode "$SCHEMA" NearbyLocationsResponse
# The nearest locations to a coordinate (no credentials needed).
curl -sS --fail-with-body --compressed "$API/api/v1/nearby?format=capnp&lat=45.33&lon=-121.66" \
  | capnp decode "$SCHEMA" NearbyLocationsResponse

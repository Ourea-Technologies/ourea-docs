#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Nearest locations, to a location or to a coordinate.
# Nearest first; the location itself is never one of its own neighbours.
# Docs: https://docs.oureawx.com/features/places/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "locations"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# The five nearest public locations to Mt. Hood Meadows (default 3, at most 20).
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows/nearby?limit=5"
echo
# The nearest locations to a coordinate (no credentials needed).
curl -sS --fail-with-body --compressed "$API/api/v1/nearby?lat=45.33&lon=-121.66"
echo

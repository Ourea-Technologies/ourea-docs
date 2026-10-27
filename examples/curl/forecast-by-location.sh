#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Forecast for a named location (state + slug).
# The default request: the current hour plus the next 24, metric, with the daily rows.
# Docs: https://docs.oureawx.com/features/places/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "timeseries"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# A named location is /api/v1/locations/{state}/{slug}; the state is the lowercase USPS code.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows"
echo

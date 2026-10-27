#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Forecasts at every named elevation of a ski area.
# elevations=all adds elevation_forecasts[], one full forecast per base, mid or summit point.
# Docs: https://docs.oureawx.com/features/location-info/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "location"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# Every extra elevation; name them instead (elevations=base,summit) to pay for fewer.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?elevations=all"
echo

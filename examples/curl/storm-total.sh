#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Window totals: the storm-total range from the server.
# Each window_totals[] entry is the distribution of every member's own total over the window, never summed hourly quantiles.
# Docs: https://docs.oureawx.com/features/window-totals/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "window_totals"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# Precipitation over the next 24 h and snowfall over the next 72 h.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?max_hours=72&totals=precipitation:24h,snowfall:72h&units=imperial"
echo

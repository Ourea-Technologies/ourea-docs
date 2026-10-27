#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Quickstart, readable in a terminal: the same request, with jq picking out the answer.
# jq only selects fields; every value is the server's.
# Docs: https://docs.oureawx.com/getting-started/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "chance"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# The place, the chance of at least 6 in of snow in 24 h, and the first hour's temperature range.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?prob=snowfall:ge:6.000:24h&units=imperial" \
  | jq '{place: .location.name, chance: .probabilities[0], first_hour: .forecast.timeseries[0] | {valid_time, temperature: (.ensemble.temperature | {p10, p50, p90})}}'

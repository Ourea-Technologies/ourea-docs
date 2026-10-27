#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Quickstart: an anonymous forecast, no signup.
# The next 24 h at Mt. Hood Meadows in imperial units, with the chance of at least 6 in of snow.
# Docs: https://docs.oureawx.com/getting-started/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "probabilities"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# Anonymous: no API key. Temperature quantiles per hour, plus the 6 in snow probability.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?prob=snowfall:ge:6.000:24h&units=imperial"
echo

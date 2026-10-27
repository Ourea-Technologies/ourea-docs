#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Daily summaries only: the cheap request for daily views.
# hourly=false serves daily[] and snow_outlook without computing any hourly point.
# Docs: https://docs.oureawx.com/features/variables/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "forecast"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# Seven local days, no hourly series.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?hourly=false&max_days=7"
echo

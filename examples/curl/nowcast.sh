#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# The base forecast plus the live nowcast overlay.
# nowcast=false is the pure model forecast (cacheable per cycle); /current?include=nowcast_hours is the live band to lay over it.
# Docs: https://docs.oureawx.com/features/nowcast/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "nowcast_hours"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# Layer A: the base forecast, no live observations.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?nowcast=false"
echo
# Layer B: the observation-blended hours; for valid times it covers, it wins over the base.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows/current?include=nowcast_hours"
echo

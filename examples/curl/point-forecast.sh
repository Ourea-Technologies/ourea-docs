#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Forecast at coordinates (Pro).
# Latitude and longitude are quantized to 0.01 degrees; elevation_m (metres) is optional and always wins.
# Docs: https://docs.oureawx.com/features/places/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "model_run"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"
# docs:hide-start
if [ -z "${OUREA_API_KEY:-}" ]; then
  echo "This example needs a Pro API key in OUREA_API_KEY; skipping."
  exit 0
fi
# docs:hide-end

# Pro only: an anonymous or Free caller gets 403 PRO_REQUIRED.
curl -sS --fail-with-body --compressed -H "X-API-Key: $OUREA_API_KEY" "$API/api/v1/forecast?elevation_m=1661&lat=45.3311&lon=-121.6649&max_hours=48"
echo

#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Current conditions and alerts at coordinates (Pro).
# The same bodies as the location routes, for an arbitrary point.
# Docs: https://docs.oureawx.com/features/current-and-alerts/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "alerts"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"
# docs:hide-start
if [ -z "${OUREA_API_KEY:-}" ]; then
  echo "This example needs a Pro API key in OUREA_API_KEY; skipping."
  exit 0
fi
# docs:hide-end

# Current conditions at a point.
curl -sS --fail-with-body --compressed -H "X-API-Key: $OUREA_API_KEY" "$API/api/v1/current?lat=45.33&lon=-121.71"
echo
# Active alerts at a point.
curl -sS --fail-with-body --compressed -H "X-API-Key: $OUREA_API_KEY" "$API/api/v1/alerts?lat=45.33&lon=-121.71"
echo

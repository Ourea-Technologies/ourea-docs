#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Current conditions and active NWS alerts for a location.
# Both work without credentials. Alerts are never shared-cached; poll them with If-None-Match.
# Docs: https://docs.oureawx.com/features/current-and-alerts/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "alerts"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# Nearby sensors, the flat 'right now' block and active alerts.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows/current"
echo
# Active NWS watches, warnings and advisories.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows/alerts"
echo

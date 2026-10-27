#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Choosing the horizon: max_hours, max_days and include_past.
# max_hours counts from the current hour and is clamped to the tier (Free 240, Pro 360); applied says what was served.
# Docs: https://docs.oureawx.com/features/horizon/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "model_run"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# The whole Free horizon: the current hour plus the next 240.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?max_hours=240"
echo
# Three local days of daily rows, whatever max_hours is.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?max_days=3"
echo
# From the run's init instead of now, past hours included.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?include_past=true&max_hours=48"
echo

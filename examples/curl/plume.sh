#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Plumes: every ensemble member, every hour.
# members=true over the whole Free horizon, base layer only (nowcast=false), no daily rows.
# Docs: https://docs.oureawx.com/features/plumes/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "model_run"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# The cacheable plume request (parameters in alphabetical order).
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?daily=false&max_hours=240&members=true&nowcast=false&units=imperial"
echo

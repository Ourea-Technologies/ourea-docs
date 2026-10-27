#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# List a state's locations, one page at a time.
# Pages are ordered by slug; pass next_cursor back as cursor until it is absent. Uses jq to read the cursor.
# Docs: https://docs.oureawx.com/features/location-info/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "locations"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

page=$(curl -sS --fail-with-body --compressed "$API/api/v1/locations/or?limit=100")
echo "$page"
cursor=$(echo "$page" | jq -r '.next_cursor // empty')
if [ -n "$cursor" ]; then
  curl -sS --fail-with-body --compressed "$API/api/v1/locations/or?cursor=$cursor&limit=100"
fi

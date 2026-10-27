#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Location info from the catalog (beta).
# The catalog row with its elevations, photos, webcams and nearby stations; then one page of the Oregon catalog, and the same for observation stations. Uses jq to read a slug.
# Docs: https://docs.oureawx.com/features/location-info/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "slug"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# One location's catalog detail (no credentials needed).
curl -sS --fail-with-body --compressed "$API/api/v1/catalog/locations/mt-hood-meadows"
echo
# Catalog locations in Oregon, 20 to a page; follow next_cursor for the rest.
curl -sS --fail-with-body --compressed "$API/api/v1/catalog/locations?admin1=US-OR"
echo
# Observation stations in Oregon (no credentials needed).
stations=$(curl -sS --fail-with-body --compressed "$API/api/v1/catalog/stations?admin1=US-OR")
echo "$stations"
# One station's detail, by a slug the list returned.
slug=$(echo "$stations" | jq -r '.items[0].slug // empty')
if [ -n "$slug" ]; then
  curl -sS --fail-with-body --compressed "$API/api/v1/catalog/stations/$slug"
  echo
fi

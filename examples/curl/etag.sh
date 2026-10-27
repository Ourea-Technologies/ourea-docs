#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# ETag revalidation: a 304 instead of the body when nothing changed.
# Send the ETag back byte for byte as If-None-Match.
# Docs: https://docs.oureawx.com/features/caching/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: ^304$
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

url="$API/api/v1/locations/or/mt-hood-meadows?nowcast=false"
etag=$(curl -sS --fail-with-body --compressed -o /dev/null -D - "$url" | tr -d '\r' | awk 'tolower($1) == "etag:" {print $2}')
echo "ETag: $etag"
# Prints 304 while the served cycle is unchanged, 200 with a fresh body after it.
curl -sS -o /dev/null -w '%{http_code}\n' -H "If-None-Match: $etag" "$url"

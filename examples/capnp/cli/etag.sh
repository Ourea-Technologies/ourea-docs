#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# ETag revalidation for a Cap'n Proto body: the capnp URL has its own ETag
# and its own edge-cache entry; revalidate it exactly as the JSON one.
# Docs: https://docs.oureawx.com/capnp/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: ^304$
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

url="$API/api/v1/locations/or/mt-hood-meadows?format=capnp&nowcast=false"
etag=$(curl -sS --fail-with-body --compressed -o forecast.bin -D - "$url" | tr -d '\r' | awk 'tolower($1) == "etag:" {print $2}')
echo "ETag: $etag"
# 304 while unchanged: keep using forecast.bin.
curl -sS -o /dev/null -w '%{http_code}\n' -H "If-None-Match: $etag" "$url"

#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Rate-limit headers on a Cap'n Proto response: the same headers as JSON.
# Docs: https://docs.oureawx.com/capnp/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: (?i)ratelimit-policy
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"
# docs:hide-start
if [ -z "${OUREA_API_KEY:-}" ]; then
  echo "This example needs a Pro API key in OUREA_API_KEY; skipping."
  exit 0
fi
# docs:hide-end

curl -sS --fail-with-body --compressed -o /dev/null -D - -H "X-API-Key: $OUREA_API_KEY" \
  "$API/api/v1/locations/or/mt-hood-meadows?format=capnp" | grep -i '^ratelimit-'

#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Sending an API key, and what an invalid key returns.
# The key goes in the X-API-Key header; read it from the environment, never hard-code it.
# Docs: https://docs.oureawx.com/features/auth-and-tiers/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: INVALID_API_KEY
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"
# docs:hide-start
if [ -z "${OUREA_API_KEY:-}" ]; then
  echo "This example needs a Pro API key in OUREA_API_KEY; skipping."
  exit 0
fi
# docs:hide-end

# Your key, from the environment.
curl -sS --fail-with-body --compressed -H "X-API-Key: $OUREA_API_KEY" "$API/api/v1/locations/or/mt-hood-meadows"
echo
# A wrong key is 401 INVALID_API_KEY, never a silent downgrade to anonymous.
curl -sS -w '\nHTTP %{http_code}\n' -H "X-API-Key: not-a-real-key" "$API/api/v1/locations/or/mt-hood-meadows"

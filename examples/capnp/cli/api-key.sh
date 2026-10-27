#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Sending an API key, and what an invalid key returns, as Cap'n Proto.
# format=capnp returns the same values as one Cap'n Proto message; capnp decode prints it with the published schema.
# Docs: https://docs.oureawx.com/capnp/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"
# docs:hide-start
if [ -z "${OUREA_API_KEY:-}" ]; then
  echo "This example needs a Pro API key in OUREA_API_KEY; skipping."
  exit 0
fi
# docs:hide-end
# docs:hide-start
SCHEMA="${OUREA_CAPNP_SCHEMA:-ourea.capnp}"
# docs:hide-end

# Your key, from the environment.
curl -sS --fail-with-body --compressed -H "X-API-Key: $OUREA_API_KEY" "$API/api/v1/locations/or/mt-hood-meadows?format=capnp" \
  | capnp decode "$SCHEMA" ForecastResponse
# A wrong key is 401 INVALID_API_KEY, never a silent downgrade to anonymous.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?format=capnp" \
  | capnp decode "$SCHEMA" ForecastResponse

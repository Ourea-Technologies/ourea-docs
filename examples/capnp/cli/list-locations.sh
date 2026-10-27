#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# List a state's locations, one page at a time, as Cap'n Proto.
# The ListLocationsResponse carries nextCursor; pass it back as cursor.
# Docs: https://docs.oureawx.com/capnp/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"
# docs:hide-start
SCHEMA="${OUREA_CAPNP_SCHEMA:-ourea.capnp}"
# docs:hide-end

# The first 100 Oregon locations, in slug order.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or?format=capnp&limit=100" \
  | capnp decode "$SCHEMA" ListLocationsResponse
# Every location in the coverage area, 500 to a page.
curl -sS --fail-with-body --compressed "$API/api/v1/locations?format=capnp&limit=500" \
  | capnp decode "$SCHEMA" ListLocationsResponse

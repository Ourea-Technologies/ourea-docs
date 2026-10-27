#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Search the catalog by name, optionally filtered by type, as Cap'n Proto.
# format=capnp returns the same values as one Cap'n Proto message; capnp decode prints it with the published schema.
# Docs: https://docs.oureawx.com/capnp/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"
# docs:hide-start
SCHEMA="${OUREA_CAPNP_SCHEMA:-ourea.capnp}"
# docs:hide-end

# Free text, at least 2 characters. Spaces are sent as %20.
curl -sS --fail-with-body --compressed "$API/api/v1/search/locations?format=capnp&q=mt%20hood&type=ski_area" \
  | capnp decode "$SCHEMA" SearchLocationsResponse

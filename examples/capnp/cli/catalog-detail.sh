#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Location info from the catalog (beta), as Cap'n Proto.
# format=capnp returns the same values as one Cap'n Proto message; capnp decode prints it with the published schema.
# Docs: https://docs.oureawx.com/capnp/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"
# docs:hide-start
SCHEMA="${OUREA_CAPNP_SCHEMA:-ourea.capnp}"
# docs:hide-end

# One location's catalog detail (no credentials needed).
curl -sS --fail-with-body --compressed "$API/api/v1/catalog/locations/mt-hood-meadows?format=capnp" \
  | capnp decode "$SCHEMA" CatalogEntry
# Catalog locations in Oregon, 20 to a page; follow next_cursor for the rest.
curl -sS --fail-with-body --compressed "$API/api/v1/catalog/locations?admin1=US-OR&format=capnp" \
  | capnp decode "$SCHEMA" CatalogPage

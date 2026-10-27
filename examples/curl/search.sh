#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Search the catalog by name, optionally filtered by type.
# Search needs no credentials; key the hits by `key`, because bare slugs repeat across states.
# Docs: https://docs.oureawx.com/features/places/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "items"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# Free text, at least 2 characters. Spaces are sent as %20.
curl -sS --fail-with-body --compressed "$API/api/v1/search/locations?q=mt%20hood&type=ski_area"
echo

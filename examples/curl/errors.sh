#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Errors: one JSON envelope with a machine-readable code.
# Prints each error body and its HTTP status. No --fail here: the errors are the point.
# Docs: https://docs.oureawx.com/features/errors/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: PRO_REQUIRED
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# 404 LOCATION_NOT_FOUND: a slug that does not exist.
curl -sS -w '\nHTTP %{http_code}\n' "$API/api/v1/locations/or/nowhere"
# 400 BAD_REQUEST: an unknown parameter (a typo) is refused, never ignored.
curl -sS -w '\nHTTP %{http_code}\n' "$API/api/v1/locations/or/mt-hood-meadows?max_hour=48"
# 403 PRO_REQUIRED: a Pro-only option without a Pro key.
curl -sS -w '\nHTTP %{http_code}\n' "$API/api/v1/locations/or/mt-hood-meadows?models=true"

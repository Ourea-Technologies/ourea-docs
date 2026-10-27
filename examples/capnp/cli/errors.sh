#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Errors with format=capnp: they stay JSON.
# A refused capnp request answers the same JSON error envelope as REST, so
# check the status (or Content-Type) before decoding the body.
# Docs: https://docs.oureawx.com/capnp/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: application/json
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# 404 LOCATION_NOT_FOUND, as JSON even though format=capnp was asked for.
curl -sS -w '\nHTTP %{http_code} %{content_type}\n' "$API/api/v1/locations/or/nowhere?format=capnp"

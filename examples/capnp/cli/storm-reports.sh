#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Storm report cards: forecast vs observed totals for completed events, as Cap'n Proto.
# format=capnp returns the same values as one Cap'n Proto message; capnp decode prints it with the published schema.
# Docs: https://docs.oureawx.com/capnp/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"
# docs:hide-start
SCHEMA="${OUREA_CAPNP_SCHEMA:-ourea.capnp}"
# docs:hide-end

# The latest storm reports.
curl -sS --fail-with-body --compressed "$API/api/v1/storm-reports?format=capnp" \
  | capnp decode "$SCHEMA" StormReportsResponse
# One report card, by an id from the JSON list (jq reads it).
id=$(curl -sS --fail-with-body --compressed "$API/api/v1/storm-reports" | jq -r '(.reports? // [])[0].id // empty')
if [ -n "$id" ]; then
  curl -sS --fail-with-body --compressed "$API/api/v1/storm-reports/$id?format=capnp" \
    | capnp decode "$SCHEMA" StormReportCard
fi

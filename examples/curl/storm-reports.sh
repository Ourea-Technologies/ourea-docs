#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Storm report cards: forecast vs observed totals for completed events.
# Public; the most recent onset first.
# Docs: https://docs.oureawx.com/features/current-and-alerts/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "reports"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# The latest storm reports.
reports=$(curl -sS --fail-with-body --compressed "$API/api/v1/storm-reports")
echo "$reports"
# One report card, by an id the list returned (jq reads it).
id=$(echo "$reports" | jq -r '(.reports? // [])[0].id // empty')
if [ -n "$id" ]; then
  curl -sS --fail-with-body --compressed "$API/api/v1/storm-reports/$id"
  echo
fi

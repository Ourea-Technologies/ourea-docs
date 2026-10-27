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
curl -sS --fail-with-body --compressed "$API/api/v1/storm-reports"
echo

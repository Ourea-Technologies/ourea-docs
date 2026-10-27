#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# The data sources, their licences and the notices to carry.
# Every provider and source with its licence; redistribute Ourea output with attribution.credit.
# Docs: https://docs.oureawx.com/getting-started/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "providers"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# Every data source, its licence and its required notices (no credentials needed).
curl -sS --fail-with-body --compressed "$API/api/v1/attribution"
echo

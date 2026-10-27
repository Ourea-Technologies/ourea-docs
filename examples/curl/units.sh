#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# The same forecast in imperial and in kelvin units.
# units= changes every value in the body; the server converts, never the client.
# Docs: https://docs.oureawx.com/features/units/
# Runs against https://api.oureawx.com, or OUREA_BASE_URL when set (CI points
# it at the local mock server).
# expect-output: "units"
set -euo pipefail
API="${OUREA_BASE_URL:-https://api.oureawx.com}"

# Fahrenheit, inches, mph, feet.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?units=imperial"
echo
# Metric with temperatures in kelvin.
curl -sS --fail-with-body --compressed "$API/api/v1/locations/or/mt-hood-meadows?units=kelvin"
echo

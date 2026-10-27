# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
"""Ourea quickstart with only the Python standard library (no SDK, no key).

The next 24 h at Mt. Hood Meadows: each hour's temperature as a p10-p90
range, and the chance of at least 6 in of snow, computed by the server.
Docs: https://docs.oureawx.com/weather-api/python/
"""

import json
import os
import urllib.request

API = os.environ.get("OUREA_BASE_URL", "https://api.oureawx.com")
# Canonical URL: parameters in alphabetical order, ':' and ',' literal.
url = f"{API}/api/v1/locations/or/mt-hood-meadows?prob=snowfall:ge:6.000:24h&units=imperial"

with urllib.request.urlopen(url, timeout=30) as resp:
    forecast = json.load(resp)

place = forecast["location"]["name"]
for hour in forecast["forecast"]["timeseries"]:
    t = hour["ensemble"]["temperature"]
    print(f"{hour['valid_time']}  {t['p10']:.0f} to {t['p90']:.0f} °F (median {t['p50']:.0f})")

# One term asked, one answer: results come back in the order the terms were sent.
p = forecast["probabilities"][0]
window = f"{p['window_start_hours']}-{p['window_end_hours']} h"
if p["probability"] is None:  # the served series does not reach the window's end
    print(f"Chance of at least {p['threshold']} in of snow, {window}: not available")
else:
    print(f"{p['probability']:.0%} chance of at least {p['threshold']} in of snow at {place}, "
          f"hours {window} ({p['members']} ensemble members)")

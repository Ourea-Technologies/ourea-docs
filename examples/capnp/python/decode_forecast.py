# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
"""Decode an Ourea forecast served with ``?format=capnp`` using pycapnp.

The body is one standard (unpacked, ``capnp::serialize`` framing) message
whose root is ``ForecastResponse`` in
https://docs.oureawx.com/schema/v1/ourea.capnp::

    curl -sS --compressed -o forecast.bin \\
      'https://api.oureawx.com/api/v1/locations/or/mt-hood-meadows?format=capnp'
    python decode_forecast.py forecast.bin

Values are in the request's ``units``. Read ``units`` only when ``hasUnits``
is true: the ``Units`` enum's zero value is ``imperial``, while the REST
default is metric, so an unset field would otherwise be misread.
"""

import os
import sys
from datetime import datetime, timezone

import capnp  # pycapnp

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA = os.environ.get(
    "OUREA_CAPNP_SCHEMA",
    os.path.join(HERE, "..", "..", "..", "public", "schema", "v1", "ourea.capnp"),
)
# The schema imports /capnp/c++.capnp; pycapnp ships that file inside its
# package, so its parent directory is the import path.
ourea = capnp.load(SCHEMA, imports=[os.path.dirname(os.path.dirname(capnp.__file__))])


def rfc3339(unix: int) -> str:
    return datetime.fromtimestamp(unix, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def main() -> None:
    if len(sys.argv) > 1:
        with open(sys.argv[1], "rb") as f:
            data = f.read()
    else:
        data = sys.stdin.buffer.read()

    # A 360 h plume is a large message: raise pycapnp's traversal limit
    # (a guard against malicious input) to cover the body you fetched.
    limit = max(len(data) // 8 * 4, 8 * 1024 * 1024)
    with ourea.ForecastResponse.from_bytes(data, traversal_limit_in_words=limit) as r:
        loc = r.location
        print(f"location: {loc.name} ({loc.slug}, {loc.state}) {loc.timezone}")
        print(f"initialized_at: {rfc3339(r.modelRun.initializedAt)}")
        print(f"members: {r.modelRun.totalMembers}")
        print(f"units: {r.units if r.hasUnits else 'unknown'}")
        series = r.forecast.timeseries
        if len(series) > 0:
            first = series[0]
            t = first.ensemble.temperature
            print(
                f"first_hour: {rfc3339(first.validTime)} temperature "
                f"p10={t.p10:.1f} p50={t.p50:.1f} p90={t.p90:.1f}"
            )
        print(f"hours: {len(series)}")
        print(f"probabilities: {len(r.probabilities)}")


if __name__ == "__main__":
    main()

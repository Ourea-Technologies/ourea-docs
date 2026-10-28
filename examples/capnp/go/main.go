// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies

// Command decode_forecast decodes an Ourea forecast served with
// `?format=capnp`, using go-capnp v3 (capnproto.org/go/capnp/v3). The body is
// one standard (unpacked, `capnp::serialize` framing) message whose root is
// `ForecastResponse` in https://docs.oureawx.com/schema/v1/ourea.capnp:
//
//	curl -sS --compressed -o forecast.bin \
//	  'https://api.oureawx.com/api/v1/locations/or/mt-hood-meadows?format=capnp'
//	./gen.sh && go run . forecast.bin
//
// Values are in the request's `units`. Read `units` only when `hasUnits` is
// true: the `Units` enum's zero value is `imperial`, while the REST default is
// metric, so an unset field would otherwise be misread. The schema names its
// sibling `hasFoo` bools `HasFooFlag()` in Go (`$Go.name`), so `hasUnits` is
// `HasUnitsFlag()`.
package main

import (
	"fmt"
	"io"
	"os"
	"time"

	"capnproto.org/go/capnp/v3"

	"oureawx.com/docs/examples/capnp/go/build/ourea"
)

func rfc3339(unix int64) string {
	return time.Unix(unix, 0).UTC().Format("2006-01-02T15:04:05Z")
}

func run() error {
	var data []byte
	var err error
	if len(os.Args) > 1 {
		data, err = os.ReadFile(os.Args[1])
	} else {
		data, err = io.ReadAll(os.Stdin)
	}
	if err != nil {
		return err
	}
	msg, err := capnp.Unmarshal(data)
	if err != nil {
		return err
	}
	// Large plumes are large messages: lift the default traversal limit.
	msg.TraverseLimit = 1 << 33
	r, err := ourea.ReadRootForecastResponse(msg)
	if err != nil {
		return err
	}

	loc, err := r.Location()
	if err != nil {
		return err
	}
	name, _ := loc.Name()
	slug, _ := loc.Slug()
	state, _ := loc.State()
	tz, _ := loc.Timezone()
	fmt.Printf("location: %s (%s, %s) %s\n", name, slug, state, tz)

	mr, err := r.ModelRun()
	if err != nil {
		return err
	}
	fmt.Printf("initialized_at: %s\n", rfc3339(mr.InitializedAt()))
	fmt.Printf("members: %d\n", mr.TotalMembers())

	units := "unknown"
	if r.HasUnitsFlag() {
		switch r.Units() {
		case ourea.Units_metric:
			units = "metric"
		case ourea.Units_imperial:
			units = "imperial"
		case ourea.Units_kelvin:
			units = "kelvin"
		}
	}
	fmt.Printf("units: %s\n", units)

	fc, err := r.Forecast()
	if err != nil {
		return err
	}
	series, err := fc.Timeseries()
	if err != nil {
		return err
	}
	if series.Len() > 0 {
		first := series.At(0)
		ens, err := first.Ensemble()
		if err != nil {
			return err
		}
		t, err := ens.Temperature()
		if err != nil {
			return err
		}
		fmt.Printf("first_hour: %s temperature p10=%.1f p50=%.1f p90=%.1f\n",
			rfc3339(first.ValidTime()), t.P10(), t.P50(), t.P90())
	}
	fmt.Printf("hours: %d\n", series.Len())
	probs, err := r.Probabilities()
	if err != nil {
		return err
	}
	fmt.Printf("probabilities: %d\n", probs.Len())
	return nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "decode_forecast:", err)
		os.Exit(1)
	}
}

// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies

// Ourea quickstart with only the Go standard library (no SDK, no key).
// The next 24 h at Mt. Hood Meadows: each hour's temperature as a p10-p90
// range, and the chance of at least 6 in of snow, computed by the server.
// Docs: https://docs.oureawx.com/weather-api/go/
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

type quantiles struct{ P10, P50, P90 float64 }

type forecast struct {
	Location struct{ Name string } `json:"location"`
	Forecast struct {
		Timeseries []struct {
			ValidTime string `json:"valid_time"`
			Ensemble  struct {
				Temperature quantiles `json:"temperature"`
			} `json:"ensemble"`
		} `json:"timeseries"`
	} `json:"forecast"`
	Probabilities []struct {
		Threshold   float64  `json:"threshold"`
		Start       int      `json:"window_start_hours"`
		End         int      `json:"window_end_hours"`
		Probability *float64 `json:"probability"` // null when the series does not reach the window's end
		Members     int      `json:"members"`
	} `json:"probabilities"`
}

func main() {
	api := os.Getenv("OUREA_BASE_URL")
	if api == "" {
		api = "https://api.oureawx.com"
	}
	// Canonical URL: parameters in alphabetical order, ':' and ',' literal.
	url := api + "/api/v1/locations/or/mt-hood-meadows?prob=snowfall:ge:6.000:24h&units=imperial"

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Fatalf("HTTP %d", resp.StatusCode)
	}
	var f forecast
	if err := json.NewDecoder(resp.Body).Decode(&f); err != nil {
		log.Fatal(err)
	}

	for _, h := range f.Forecast.Timeseries {
		t := h.Ensemble.Temperature
		fmt.Printf("%s  %.0f to %.0f °F (median %.0f)\n", h.ValidTime, t.P10, t.P90, t.P50)
	}
	// One term asked, one answer: results come back in the order the terms were sent.
	p := f.Probabilities[0]
	if p.Probability == nil {
		fmt.Printf("Chance of at least %g in of snow, %d-%d h: not available\n", p.Threshold, p.Start, p.End)
		return
	}
	fmt.Printf("%.0f%% chance of at least %g in of snow at %s, hours %d-%d h (%d ensemble members)\n",
		*p.Probability*100, p.Threshold, f.Location.Name, p.Start, p.End, p.Members)
}

// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Ourea quickstart with HttpClient and System.Text.Json (no SDK, no key).
// The next 24 h at Mt. Hood Meadows: each hour's temperature as a p10-p90
// range, and the chance of at least 6 in of snow, computed by the server.
// Docs: https://docs.oureawx.com/weather-api/csharp/
using System.Text.Json;

var api = Environment.GetEnvironmentVariable("OUREA_BASE_URL") ?? "https://api.oureawx.com";
// Canonical URL: parameters in alphabetical order, ':' and ',' literal.
var url = $"{api}/api/v1/locations/or/mt-hood-meadows?prob=snowfall:ge:6.000:24h&units=imperial";

using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
using var resp = await http.GetAsync(url);
resp.EnsureSuccessStatusCode();
using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
var root = doc.RootElement;

var place = root.GetProperty("location").GetProperty("name").GetString();
foreach (var hour in root.GetProperty("forecast").GetProperty("timeseries").EnumerateArray())
{
    var t = hour.GetProperty("ensemble").GetProperty("temperature");
    Console.WriteLine($"{hour.GetProperty("valid_time").GetString()}  {t.GetProperty("p10").GetDouble():F0} to {t.GetProperty("p90").GetDouble():F0} °F (median {t.GetProperty("p50").GetDouble():F0})");
}
// One term asked, one answer: results come back in the order the terms were sent.
var p = root.GetProperty("probabilities")[0];
var window = $"{p.GetProperty("window_start_hours").GetInt32()}-{p.GetProperty("window_end_hours").GetInt32()} h";
var threshold = p.GetProperty("threshold").GetDouble();
var prob = p.GetProperty("probability");
if (prob.ValueKind == JsonValueKind.Null)
{
    // The served series does not reach the window's end.
    Console.WriteLine($"Chance of at least {threshold} in of snow, {window}: not available");
}
else
{
    Console.WriteLine($"{prob.GetDouble() * 100:F0}% chance of at least {threshold} in of snow at {place}, hours {window} ({p.GetProperty("members").GetInt32()} ensemble members)");
}

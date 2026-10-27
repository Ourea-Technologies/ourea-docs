// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Ourea quickstart with java.net.http (no SDK, no key). Run it with
// `java Quickstart.java` (JDK 11+). The JDK has no JSON parser, so this
// prints the JSON body; parse it with your JSON library, or use the SDK.
// The request asks for the next 24 h at Mt. Hood Meadows in imperial units
// with the chance of at least 6 in of snow, computed by the server.
// Docs: https://docs.oureawx.com/weather-api/java/

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class Quickstart {
  public static void main(String[] args) throws Exception {
    String api = System.getenv().getOrDefault("OUREA_BASE_URL", "https://api.oureawx.com");
    // Canonical URL: parameters in alphabetical order, ':' and ',' literal.
    URI uri = URI.create(api + "/api/v1/locations/or/mt-hood-meadows?prob=snowfall:ge:6.000:24h&units=imperial");

    HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
    HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(30)).GET().build();
    HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() != 200) {
      throw new IllegalStateException("HTTP " + response.statusCode() + ": " + response.body());
    }
    // forecast.timeseries[].ensemble.temperature.{p10,p50,p90}: the hourly range.
    // probabilities[0].probability: the chance of >= 6 in of snow in 0-24 h.
    System.out.println(response.body());
  }
}

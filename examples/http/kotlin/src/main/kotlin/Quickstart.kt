// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Ourea quickstart with java.net.http and kotlinx-serialization (no SDK, no
// key). Run it with `gradle run`.
// The next 24 h at Mt. Hood Meadows: each hour's temperature as a p10-p90
// range, and the chance of at least 6 in of snow, computed by the server.
// Docs: https://docs.oureawx.com/weather-api/kotlin/
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import kotlin.math.roundToInt
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable data class Quantiles(val p10: Double, val p50: Double, val p90: Double)
@Serializable data class Ensemble(val temperature: Quantiles)
@Serializable data class Hour(@SerialName("valid_time") val validTime: String, val ensemble: Ensemble)
@Serializable data class Series(val timeseries: List<Hour>)
@Serializable data class Location(val name: String)
@Serializable
data class Probability(
    val threshold: Double,
    @SerialName("window_start_hours") val start: Int,
    @SerialName("window_end_hours") val end: Int,
    val probability: Double?, // null when the served series does not reach the window's end
    val members: Int,
)
@Serializable data class Forecast(val location: Location, val forecast: Series, val probabilities: List<Probability>)

private val json = Json { ignoreUnknownKeys = true } // v1 only ever adds fields

fun main() {
    val api = System.getenv("OUREA_BASE_URL") ?: "https://api.oureawx.com"
    // Canonical URL: parameters in alphabetical order, ':' and ',' literal.
    val uri = URI.create("$api/api/v1/locations/or/mt-hood-meadows?prob=snowfall:ge:6.000:24h&units=imperial")

    val client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build()
    val request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(30)).GET().build()
    val response = client.send(request, HttpResponse.BodyHandlers.ofString())
    check(response.statusCode() == 200) { "HTTP ${response.statusCode()}: ${response.body()}" }
    val f = json.decodeFromString<Forecast>(response.body())

    for (hour in f.forecast.timeseries) {
        val t = hour.ensemble.temperature
        println("${hour.validTime}  ${t.p10.roundToInt()} to ${t.p90.roundToInt()} °F (median ${t.p50.roundToInt()})")
    }
    // One term asked, one answer: results come back in the order the terms were sent.
    val p = f.probabilities.first()
    val window = "${p.start}-${p.end} h"
    val chance = p.probability
    if (chance == null) {
        println("Chance of at least ${p.threshold} in of snow, $window: not available")
    } else {
        println("${(chance * 100).roundToInt()}% chance of at least ${p.threshold} in of snow at ${f.location.name}, hours $window (${p.members} ensemble members)")
    }
}

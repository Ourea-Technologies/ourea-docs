// SPDX-License-Identifier: BSD-2-Clause
// Point forecast: a forecast at coordinates and a given elevation (Timberline
// Lodge's upper mountain). Forecasts at arbitrary points need a Pro key, read
// from OUREA_API_KEY; without one this example says so and exits.

import EnsembleWeather
import Foundation

guard let apiKey = ProcessInfo.processInfo.environment["OUREA_API_KEY"], !apiKey.isEmpty else {
    print("point_forecast needs a Pro API key in OUREA_API_KEY; skipping.")
    exit(0)
}

let client = EnsembleWeatherClient(apiKey: apiKey)
let forecast = try await client.forecast(
    latitude: 45.3311, longitude: -121.7113, elevationMeters: 1829,
    options: ForecastOptions(maxHours: 48))

if let point = forecast.point {
    print(
        "Grid point \(point.latitude), \(point.longitude) at \(point.elevation) \(forecast.units.heightUnit)"
    )
}
for hour in (forecast.forecast.timeseries ?? []).prefix(6) {
    let wind = hour.ensemble.windSpeed
    print(
        "\(hour.validTime): \(hour.conditionText); wind median \(wind.median.map { "\($0)" } ?? "n/a") \(forecast.units.speedUnit)"
    )
}

// SPDX-License-Identifier: BSD-2-Clause
// Quickstart: an anonymous forecast for Mt. Hood Meadows, Oregon. Prints the
// next 24 hours' temperature as a range (p10 to p90) and the chance of at
// least 6 in (15 cm) of snow in the next 24 hours. No API key needed.

import EnsembleWeather

let client = EnsembleWeatherClient()
let sixInches = ProbabilityQuery.snowfall(atLeast: .inches(6))

let forecast = try await client.forecast(
    for: "or/mt-hood-meadows",
    options: ForecastOptions(probabilities: [sixInches]))

print("\(forecast.location.name), temperature over the next 24 h (p10 to p90):")
for hour in forecast.forecast.timeseries ?? [] {
    if let range = hour.ensemble.temperature.range(.p10ToP90) {
        let unit = forecast.units.temperatureUnit
        print(
            "  \(hour.validTime.formatted(date: .omitted, time: .shortened))  \(range.lower)\(unit) to \(range.upper)\(unit)"
        )
    }
}

if let snow = forecast.probability(for: sixInches), let chance = snow.probability {
    print(
        "Chance of at least 6 in of snow in the next 24 h: \(chance.formatted(.percent)) (\(snow.members) members)"
    )
}

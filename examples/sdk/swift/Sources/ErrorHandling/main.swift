// SPDX-License-Identifier: BSD-2-Clause
// Error handling: catch an out-of-coverage error by its code, tell it apart
// from a missing Pro key, and read the rate-limit state.

import EnsembleWeather

let client = EnsembleWeatherClient()

do {
    _ = try await client.forecast(latitude: 51.5, longitude: -0.1)  // London: outside CONUS
} catch let error as EnsembleWeatherError where error.code == .outsideCoverage {
    print("Outside the forecast domain (\(error.code?.rawValue ?? "")): \(error.message)")
} catch let error as EnsembleWeatherError where error.category == .permission {
    print("Point forecasts need a Pro key: \(error.message)")
}

let forecast = try await client.forecast(for: "or/mt-hood-meadows")
if let rateLimit = forecast.metadata.rateLimit {
    print(
        "Rate limit: \(rateLimit.remaining ?? 0) of \(rateLimit.limit ?? 0) left, resets in \(rateLimit.resetSeconds ?? 0) s"
    )
} else {
    print("This response carries no rate-limit headers (an edge-cacheable anonymous response).")
}

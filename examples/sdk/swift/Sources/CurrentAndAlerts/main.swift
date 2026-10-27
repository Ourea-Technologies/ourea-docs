// SPDX-License-Identifier: BSD-2-Clause
// Current conditions and alerts: the blended current reading and the active
// weather alerts for a named location.

import EnsembleWeather

let client = EnsembleWeatherClient()

let now = try await client.currentConditions(for: "or/mt-hood-meadows")
if let current = now.current {
    print(
        "\(now.location.name) now: \(current.conditionText), \(current.temperature)\(now.units.temperatureUnit), "
            + "wind \(current.windSpeed) \(now.units.speedUnit) (from \(current.source.rawValue))")
} else {
    print("No current reading for \(now.location.name) yet.")
}
print("\(now.sensorCount) sensors nearby")

let alerts = try await client.alerts(for: "or/mt-hood-meadows")
if alerts.alerts.isEmpty { print("No active alerts.") }
for alert in alerts.alerts {
    print("\(alert.severity): \(alert.headline) (until \(alert.expires))")
}

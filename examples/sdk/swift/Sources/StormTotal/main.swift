// SPDX-License-Identifier: BSD-2-Clause
// Storm total: the distribution of total precipitation and snowfall over a
// window, from each ensemble member's own total. This is the only storm total
// the SDK offers; summing hourly quantiles would give a wrong answer.

import EnsembleWeather

let client = EnsembleWeatherClient()
let forecast = try await client.forecast(
    for: "or/mt-hood-meadows",
    options: ForecastOptions(
        maxHours: 72,
        windowTotals: [.precipitation(in: .hours(72)), .snowfall(in: .hours(72))]))

for total in forecast.windowTotals {
    guard let quantiles = total.quantiles, let range = quantiles.range(.p10ToP90) else {
        print(
            "\(total.variable.rawValue), hours 0-\(total.windowEndHours): unanswered "
                + "(\(total.nullReason?.rawValue ?? "no reason given"))")
        continue
    }
    print(
        "\(total.variable.rawValue), next \(total.windowEndHours) h: \(range.lower) to \(range.upper) "
            + "\(forecast.units.amountUnit) (p10 to p90), median \(quantiles.median ?? 0), \(total.members) members"
    )
}

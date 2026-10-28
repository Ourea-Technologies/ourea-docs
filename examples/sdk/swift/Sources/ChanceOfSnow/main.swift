// SPDX-License-Identifier: BSD-2-Clause
// Chance of snow: several probability terms in one request. Each answer
// carries its reference class: the threshold, the window and the members
// that voted. The server computes every probability from the full ensemble.

import EnsembleWeather

let client = EnsembleWeatherClient()
let questions: [ProbabilityQuery] = [
    .snowfall(atLeast: .inches(1)),
    .snowfall(atLeast: .inches(6)),
    .snowfall(atLeast: .inches(12), in: .hours(72)),
    .temperature(atMost: .fahrenheit(32), in: .hours(48), aggregation: .all),
]

let forecast = try await client.forecast(
    for: "or/mt-hood-meadows",
    options: ForecastOptions(units: .imperial, maxHours: 72, probabilities: questions))

for answer in forecast.probabilities {
    let unit =
        answer.variable == .temperature ? forecast.units.temperatureUnit : forecast.units.amountUnit
    let chance =
        answer.probability.map { $0.formatted(.percent) }
        ?? "unanswered (\(answer.nullReason?.rawValue ?? "no reason given"))"
    print(
        "P(\(answer.variable.rawValue) \(answer.comparison == .atLeast ? ">=" : "<=") \(answer.threshold) \(unit), "
            + "hours \(answer.windowStartHours)-\(answer.windowEndHours), \(answer.aggregation.rawValue)) = "
            + "\(chance) from \(answer.members) members")
}

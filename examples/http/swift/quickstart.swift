// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Ourea quickstart with URLSession and Codable (no SDK, no key). Run it with
// `swift quickstart.swift` (Swift 5.7+, macOS 12+ or iOS 15+).
// The next 24 h at Mt. Hood Meadows: each hour's temperature as a p10-p90
// range, and the chance of at least 6 in of snow, computed by the server.
// Docs: https://docs.oureawx.com/weather-api/swift/
import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

struct Quantiles: Decodable { let p10: Double; let p50: Double; let p90: Double }
struct Hour: Decodable {
    let valid_time: String
    let ensemble: Ensemble
    struct Ensemble: Decodable { let temperature: Quantiles }
}
struct Probability: Decodable {
    let variable: String
    let threshold: Double
    let window_start_hours: Int
    let window_end_hours: Int
    let probability: Double?  // nil when the served series does not reach the window's end
    let members: Int
}
struct Forecast: Decodable {
    struct Location: Decodable { let name: String }
    struct Data: Decodable { let timeseries: [Hour] }
    let location: Location
    let forecast: Data
    let probabilities: [Probability]
}

let api = ProcessInfo.processInfo.environment["OUREA_BASE_URL"] ?? "https://api.oureawx.com"
// Canonical URL: parameters in alphabetical order, ':' and ',' literal.
let url = URL(string: "\(api)/api/v1/locations/or/mt-hood-meadows?prob=snowfall:ge:6.000:24h&units=imperial")!

let (data, response) = try await URLSession.shared.data(from: url)
guard (response as? HTTPURLResponse)?.statusCode == 200 else {
    fatalError("HTTP error: \(String(decoding: data, as: UTF8.self))")
}
let f = try JSONDecoder().decode(Forecast.self, from: data)

for hour in f.forecast.timeseries {
    let t = hour.ensemble.temperature
    print("\(hour.valid_time)  \(Int(t.p10.rounded())) to \(Int(t.p90.rounded())) °F (median \(Int(t.p50.rounded())))")
}
// One term asked, one answer: results come back in the order the terms were sent.
if let p = f.probabilities.first {
    let window = "\(p.window_start_hours)-\(p.window_end_hours) h"
    if let chance = p.probability {
        print("\(Int((chance * 100).rounded()))% chance of at least \(p.threshold) in of snow at \(f.location.name), hours \(window) (\(p.members) ensemble members)")
    } else {
        print("Chance of at least \(p.threshold) in of snow, \(window): not available")
    }
}

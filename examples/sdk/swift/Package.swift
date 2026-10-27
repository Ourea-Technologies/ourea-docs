// swift-tools-version: 6.0
// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Runnable examples, one executable per task. Run one with
//   swift run --package-path examples Quickstart
// or all of them against the local mock with scripts/run-examples.

import PackageDescription

let examples = [
    "Quickstart", "PointForecast", "ChanceOfSnow", "StormTotal", "SearchAndCatalog",
    "CurrentAndAlerts", "ErrorHandling", "Units",
]

let package = Package(
    name: "ensemble-weather-swift-examples",
    platforms: [.macOS(.v12)],
    dependencies: [.package(name: "ensemble-weather-swift", path: "..")],
    targets: examples.map { name in
        .executableTarget(
            name: name,
            dependencies: [.product(name: "EnsembleWeather", package: "ensemble-weather-swift")],
            path: "Sources/\(name)")
    },
    swiftLanguageModes: [.v6]
)

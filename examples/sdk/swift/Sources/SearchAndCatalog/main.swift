// SPDX-License-Identifier: BSD-2-Clause
// Search and catalog: find a location by name, then walk the catalog page by
// page. The page sequence follows the server's cursor lazily.

import EnsembleWeather

let client = EnsembleWeatherClient()

let results = try await client.searchLocations("hood meadows")
for hit in results.items {
    print("Found \(hit.name) (\(hit.state)/\(hit.slug)) in \(hit.county) County")
}

var count = 0
for try await location in client.catalogLocations(admin1: "US-OR") {
    print("Catalog: \(location.slug) (\(location.type.rawValue))")
    count += 1
    if count == 50 { break }
}
print("\(count) catalog locations")

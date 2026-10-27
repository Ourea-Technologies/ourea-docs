// Search and catalog: find a location by name, then page through the catalog with the cursor. Search is an
// open route, sent without the API key so every caller shares one edge-cache entry.
using EnsembleWeather;

using var client = new EnsembleWeatherClient();

SearchLocationsResponse hits = await client.SearchLocationsAsync("hood meadows", new SearchOptions { Limit = 5 });
foreach (SearchHit hit in hits.Items)
{
    // Key results by hit.Key: a slug is unique within its state only.
    Console.WriteLine($"{hit.Key}: {hit.Name}, {hit.County} County ({hit.Type})");
}

// The iterator follows next_cursor until the last page; GetCatalogLocationsPageAsync fetches one page.
int count = 0;
await foreach (CatalogLocation location in client.GetCatalogLocationsAsync(new CatalogLocationListOptions { Admin1 = "US-OR", Limit = 50 }))
{
    Console.WriteLine($"  catalog: {location.Slug} ({location.Name})");
    if (++count == 100)
    {
        break;
    }
}

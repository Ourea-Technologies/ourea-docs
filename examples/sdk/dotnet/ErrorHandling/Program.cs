// Error handling: catch an out-of-coverage error by its type and code, and read the rate-limit state.
// Coordinates need a Pro key; without one the API answers PRO_REQUIRED first, which is caught too.
using EnsembleWeather;

using var client = new EnsembleWeatherClient();

try
{
    await client.GetPointForecastAsync(51.5, -0.12); // London: outside the CONUS coverage
}
catch (OutsideCoverageException ex)
{
    Console.WriteLine($"Outside coverage ({ex.ErrorCode}, HTTP {ex.StatusCode}): {ex.ApiMessage}");
}
catch (PermissionDeniedException ex) when (ex.ErrorCode == "PRO_REQUIRED")
{
    Console.WriteLine($"Coordinates need a Pro key ({ex.ErrorCode}, HTTP {ex.StatusCode}).");
}
catch (RateLimitExceededException ex)
{
    Console.WriteLine($"Rate limited; retry after {ex.RetryAfter?.TotalSeconds} s.");
}
catch (EnsembleWeatherException ex)
{
    Console.WriteLine($"Ourea API error {ex.ErrorCode} (HTTP {ex.StatusCode}, request {ex.RequestId}): {ex.Message}");
}

ForecastResponse forecast = await client.GetLocationForecastAsync("or/mt-hood-meadows");
if (forecast.Metadata.RateLimit is RateLimitState limit)
{
    Console.WriteLine($"Rate limit: {limit.Remaining} of {limit.Limit} left, whole again in {limit.Reset?.TotalSeconds} s ({limit.Policy})");
}
else
{
    Console.WriteLine("No rate-limit headers: an edge-cacheable (anonymous) response carries none.");
}

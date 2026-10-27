// Point forecast: the forecast at coordinates with an explicit elevation (the top of a lift), which needs
// a Pro API key in OUREA_API_KEY. Without one it says so and exits.
using EnsembleWeather;

if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("OUREA_API_KEY")))
{
    Console.WriteLine("point_forecast needs a Pro API key in OUREA_API_KEY; skipping.");
    return;
}

using var client = new EnsembleWeatherClient();
ForecastResponse forecast = await client.GetPointForecastAsync(45.3311, -121.6649, elevationMeters: 2100,
    new ForecastOptions { MaxHours = 48 });

PointInfo? point = forecast.Point;
Console.WriteLine($"Computed at {point?.Latitude}, {point?.Longitude}, {point?.Elevation} {forecast.UnitLabels.Length} ({point?.ElevationSource})");
foreach (TimeSeriesPoint hour in forecast.Forecast.Timeseries.Take(6))
{
    Quantiles t = hour.Ensemble.Temperature;
    Console.WriteLine($"  {hour.ValidTime:ddd HH:mm}Z  median {t.Median:F1}{forecast.UnitLabels.Temperature}, snow chance {hour.Ensemble.Snowfall?.Probability:P0}");
}

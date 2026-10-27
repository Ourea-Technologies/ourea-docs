// Units: the same forecast in metric and imperial. The server converts; the SDK never converts a response
// value, it only labels it.
using EnsembleWeather;

using var client = new EnsembleWeatherClient();

foreach (UnitSystem units in new[] { UnitSystem.Metric, UnitSystem.Imperial })
{
    ForecastResponse forecast = await client.GetLocationForecastAsync("or/mt-hood-meadows", new ForecastOptions { Units = units });
    TimeSeriesPoint first = forecast.Forecast.Timeseries[0];
    UnitLabels labels = forecast.UnitLabels;
    Console.WriteLine($"{forecast.Units}: temperature median {first.Ensemble.Temperature.Median} {labels.Temperature}, " +
        $"wind median {first.Ensemble.WindSpeed.Median} {labels.Speed}, snow level median {first.Ensemble.SnowLevel?.Median} {labels.Length}");
}

// Quickstart: an anonymous forecast for Mt. Hood Meadows, Oregon. Prints each of the next 24 hours'
// temperature as a range (10th to 90th percentile) and the chance of at least 6 in (15 cm) of snow
// in the next 24 hours. No API key needed.
using EnsembleWeather;

using var client = new EnsembleWeatherClient();

var options = new ForecastOptions();
options.Probabilities.Add(ProbabilityTerm.AtLeast(ForecastVariable.Snowfall, Threshold.Inches(6), ForecastWindow.Hours(24)));

ForecastResponse forecast = await client.GetLocationForecastAsync("or/mt-hood-meadows", options);

Console.WriteLine($"{forecast.Location.Name}: temperature, next 24 h (p10 to p90, {forecast.UnitLabels.Temperature})");
foreach (TimeSeriesPoint hour in forecast.Forecast.Timeseries)
{
    if (hour.Ensemble.Temperature.GetRange(10, 90) is QuantileRange range)
    {
        Console.WriteLine($"  {hour.ValidTime:ddd HH:mm}Z  {range.Low,6:F1} to {range.High,6:F1}");
    }
}

ProbabilityResult snow = forecast.Probabilities[0];
Console.WriteLine(snow.Probability is double chance
    ? $"Chance of at least 6 in of snow in the next 24 h: {chance:P0} ({snow.Members} members)"
    : $"Chance of at least 6 in of snow in the next 24 h: not available ({snow.NullReason})");

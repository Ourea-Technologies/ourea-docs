// Storm total: the distribution of each member's own precipitation and snowfall total over a window,
// computed by the server. Summing hourly percentiles would give a wrong total, so the SDK never does.
using EnsembleWeather;

using var client = new EnsembleWeatherClient();

var options = new ForecastOptions();
options.WindowTotals.Add(WindowTotalTerm.Precipitation(ForecastWindow.Hours(48)));
options.WindowTotals.Add(WindowTotalTerm.Snowfall(ForecastWindow.Hours(72)));

ForecastResponse forecast = await client.GetLocationForecastAsync("or/mt-hood-meadows", options);

foreach (WindowTotal total in forecast.WindowTotals)
{
    string unit = forecast.UnitLabels.Amount;
    if (total.Quantiles?.GetRange(10, 90) is QuantileRange range)
    {
        Console.WriteLine($"{total.Variable}, hours {total.WindowStartHours}-{total.WindowEndHours}: most likely " +
            $"{total.Quantiles.Median} {unit}, at least {range.Low} {unit}, could reach {range.High} {unit} ({total.Members} members)");
    }
    else
    {
        Console.WriteLine($"{total.Variable}, hours {total.WindowStartHours}-{total.WindowEndHours}: not covered by the forecast");
    }
}

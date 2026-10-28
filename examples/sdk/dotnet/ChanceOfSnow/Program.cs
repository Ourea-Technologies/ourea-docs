// Chance of snow: several probability questions in one call. Each answer comes back in the order asked,
// with its reference class: variable, comparison, threshold, window and the number of members that voted.
// The server computes every probability from the full ensemble; the SDK never derives one.
using EnsembleWeather;

using var client = new EnsembleWeatherClient();

var options = new ForecastOptions { Units = UnitSystem.Imperial };
options.Probabilities.Add(ProbabilityTerm.AtLeast(ForecastVariable.Snowfall, Threshold.Inches(6), ForecastWindow.Hours(24)));
options.Probabilities.Add(ProbabilityTerm.AtLeast(ForecastVariable.Snowfall, Threshold.Inches(12), ForecastWindow.Hours(72)));
options.Probabilities.Add(ProbabilityTerm.AtMost(ForecastVariable.Temperature, Threshold.Fahrenheit(32), ForecastWindow.Hours(12)));
options.Probabilities.Add(ProbabilityTerm.AtLeast(ForecastVariable.WindSpeed, Threshold.MilesPerHour(40), ForecastWindow.Between(12, 36)));

ForecastResponse forecast = await client.GetLocationForecastAsync("or/mt-hood-meadows", options);

foreach (ProbabilityResult p in forecast.Probabilities)
{
    string chance = p.Probability is double value ? $"{value:P0}" : $"unanswered ({p.NullReason})";
    Console.WriteLine($"P({p.Variable} {p.Operator} {p.Threshold}) over hours {p.WindowStartHours}-{p.WindowEndHours} " +
        $"({p.From:MMM d HH:mm}Z to {p.To:MMM d HH:mm}Z, {p.Aggregation}): {chance} of {p.Members} members");
}

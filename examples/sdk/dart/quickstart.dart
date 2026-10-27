// Quickstart: an anonymous forecast for Mt. Hood Meadows, Oregon (no API
// key). Prints the next 24 hours' temperature as a p10-p90 range, and the
// chance of at least 6 in (15 cm) of snow in the next 24 hours.
import 'package:ensemble_weather/ensemble_weather.dart';

Future<void> main() async {
  final client =
      EnsembleWeatherClient(); // anonymous unless OUREA_API_KEY is set
  const snow = Chance.atLeast(
    ProbabilityVariable.snowfall,
    Threshold.inches(6),
    window: ForecastWindow.hours(24),
  );

  try {
    final forecast = await client.forecast(
      'or/mt-hood-meadows',
      probabilities: [snow],
    );

    final degrees = forecast.units.temperatureUnit;
    print('${forecast.location.name}: temperature over the next 24 h '
        '(p10 to p90)');
    for (final hour in forecast.forecast.timeseries?.take(25) ??
        const <TimeSeriesPoint>[]) {
      final (:low, :high) =
          hour.ensemble.temperature.range(CentralRange.p10ToP90);
      print('  ${hour.validTime.toIso8601String()}  $low to $high $degrees');
    }

    final chance = forecast.probabilityFor(snow);
    if (chance?.probability case final p?) {
      print('Chance of 6 in (15 cm) or more of snow in the next 24 h: '
          '${(p * 100).round()}% (${chance!.members} members)');
    } else {
      print('The chance of 6 in of snow is not available for this window yet.');
    }
  } finally {
    client.close();
  }
}

// Several probability terms in one call. The server computes each one from
// the full ensemble; every answer carries its window and how many members
// voted.
import 'package:ensemble_weather/ensemble_weather.dart';

Future<void> main() async {
  final client = EnsembleWeatherClient(units: UnitSystem.imperial);
  final terms = [
    const Chance.atLeast(ProbabilityVariable.snowfall, Threshold.inches(6)),
    const Chance.atLeast(
      ProbabilityVariable.snowfall,
      Threshold.inches(12),
      window: ForecastWindow.hours(72),
    ),
    const Chance.atMost(
      ProbabilityVariable.temperature,
      Threshold.fahrenheit(32),
      window: ForecastWindow.between(6, 18),
      aggregation: Aggregation.all,
    ),
    const Chance.atLeast(
      ProbabilityVariable.windSpeed,
      Threshold.milesPerHour(40),
    ),
  ];
  try {
    final forecast = await client.forecast(
      'or/mt-hood-meadows',
      maxHours: 72,
      probabilities: terms,
    );
    // In the order asked, each with its reference class.
    for (final p in forecast.probabilities ?? const <ProbabilityResult>[]) {
      final chance = p.probability == null
          ? 'not covered yet'
          : '${(p.probability! * 100).round()}%';
      print('${p.variable} ${p.op} ${p.threshold} (${p.aggregation}, '
          '${p.window}): $chance of ${p.members} members');
    }
  } finally {
    client.close();
  }
}

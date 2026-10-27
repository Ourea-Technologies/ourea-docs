// A forecast at coordinates with an elevation: Timberline Lodge's upper
// slopes. Point forecasts need a Pro key, read from OUREA_API_KEY; without
// one this example says so and exits.
import 'dart:io';

import 'package:ensemble_weather/ensemble_weather.dart';

Future<void> main() async {
  final key = Platform.environment['OUREA_API_KEY'];
  if (key == null || key.isEmpty) {
    print('point_forecast needs a Pro key in OUREA_API_KEY; skipping.');
    return;
  }
  final client = EnsembleWeatherClient(apiKey: key);
  try {
    final forecast = await client.forecastAt(
      45.3311,
      -121.7113,
      elevationM: 2100,
      maxHours: 48,
    );
    final point = forecast.point;
    print('Forecast at ${point?.lat}, ${point?.lon} '
        '(${point?.elevation} ${forecast.units.lengthUnit}, '
        'from ${point?.elevationSource})');
    for (final hour
        in forecast.forecast.timeseries?.take(6) ?? const <TimeSeriesPoint>[]) {
      final t = hour.ensemble.temperature;
      print('  ${hour.validTime.toIso8601String()}  median ${t.median} '
          '${forecast.units.temperatureUnit} (p10 ${t.p10}, p90 ${t.p90})');
    }
  } finally {
    client.close();
  }
}

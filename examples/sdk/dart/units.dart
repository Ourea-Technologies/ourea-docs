// The same forecast in metric and imperial. The server converts: the SDK
// never converts a response value, it asks for the other unit system.
import 'package:ensemble_weather/ensemble_weather.dart';

Future<void> main() async {
  final client = EnsembleWeatherClient();
  try {
    for (final units in [UnitSystem.metric, UnitSystem.imperial]) {
      final forecast =
          await client.forecast('or/mt-hood-meadows', units: units);
      final hour = forecast.forecast.timeseries?.first;
      if (hour == null) continue;
      print('${forecast.units}: median ${hour.ensemble.temperature.median} '
          '${units.temperatureUnit}, wind ${hour.ensemble.windSpeed.median} '
          '${units.speedUnit}, snow level ${hour.ensemble.snowLevel?.median} '
          '${units.lengthUnit}');
    }
  } finally {
    client.close();
  }
}

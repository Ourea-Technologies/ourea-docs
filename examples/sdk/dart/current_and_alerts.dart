// Current conditions and active alerts for a named location.
import 'package:ensemble_weather/ensemble_weather.dart';

Future<void> main() async {
  final client = EnsembleWeatherClient();
  try {
    final now = await client.current('or/mt-hood-meadows');
    final c = now.current;
    if (c != null) {
      print('${now.location.name}: ${c.conditionText}, '
          '${c.temperature} ${now.units.temperatureUnit}, wind '
          '${c.windSpeed} ${now.units.speedUnit} (from the ${c.source})');
    }

    final alerts = await client.alerts('or/mt-hood-meadows');
    print('${alerts.alertCount} active alert(s):');
    for (final alert in alerts.alerts) {
      print('  ${alert.event} (${alert.severity}): ${alert.headline}');
    }
  } finally {
    client.close();
  }
}

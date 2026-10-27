# Examples

Small, complete programs, one per task. Each runs anonymously except
`point_forecast.dart`, which needs a Pro key in `OUREA_API_KEY` (without one
it says so and exits).

| Example | Shows |
| --- | --- |
| [`quickstart.dart`](quickstart.dart) | an anonymous forecast: the next 24 h's temperature range and the chance of 6 in of snow |
| [`point_forecast.dart`](point_forecast.dart) | a forecast at coordinates with elevation (Pro) |
| [`chance_of_snow.dart`](chance_of_snow.dart) | several `Chance` terms in one call, with their windows and member counts |
| [`storm_total.dart`](storm_total.dart) | `Total` window distributions for precipitation and snowfall |
| [`search_and_catalog.dart`](search_and_catalog.dart) | search, then page through the catalog with a `Stream` |
| [`current_and_alerts.dart`](current_and_alerts.dart) | current conditions and active alerts |
| [`error_handling.dart`](error_handling.dart) | catching an out-of-coverage error; reading rate-limit state |
| [`units.dart`](units.dart) | the same forecast in metric and imperial |

```dart
import 'package:ensemble_weather/ensemble_weather.dart';

Future<void> main() async {
  final client = EnsembleWeatherClient(); // anonymous unless OUREA_API_KEY is set
  final forecast = await client.forecast('or/mt-hood-meadows');
  final t = forecast.forecast.timeseries!.first.ensemble.temperature;
  print('${forecast.location.name}: median ${t.median} '
      '${forecast.units.temperatureUnit}');
  client.close();
}
```

To run them without touching the real API, start the local mock and point
the examples at it:

```sh
dart run tool/mock_server.dart &
OUREA_BASE_URL=http://127.0.0.1:8787 dart run example/quickstart.dart
```

`dart run tool/run_examples.dart` does both for every example, as CI does.

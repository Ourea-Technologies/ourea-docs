// Storm totals: the distribution of each member's own precipitation and
// snowfall total over a window, computed by the server. (Summing hourly
// quantiles would give a wrong answer, so the SDK never does.)
import 'package:ensemble_weather/ensemble_weather.dart';

Future<void> main() async {
  final client = EnsembleWeatherClient();
  const rain = Total.precipitation(ForecastWindow.hours(48));
  const snow = Total.snowfall(ForecastWindow.hours(72));
  try {
    final forecast = await client.forecast(
      'or/mt-hood-meadows',
      totals: [rain, snow],
    );
    final depth = forecast.units.depthUnit;
    for (final term in [rain, snow]) {
      final total = forecast.windowTotalFor(term);
      final q = total?.quantiles;
      if (total == null || q == null) {
        print('${term.variable} over ${term.window}: no value '
            '(${total?.nullReason ?? 'not answered'})');
        continue;
      }
      print(
          '${total.variable} over ${total.window}: median ${q.median} $depth, '
          '80% range ${q.p10} to ${q.p90} $depth (${total.members} members)');
    }
  } finally {
    client.close();
  }
}

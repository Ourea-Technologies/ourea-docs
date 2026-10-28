// Catch an out-of-coverage error by its type and code, and read the
// rate-limit state the API reports.
import 'package:ensemble_weather/ensemble_weather.dart';

Future<void> main() async {
  final client = EnsembleWeatherClient(maxRetries: 2);
  try {
    try {
      await client.forecastAt(51.5, -0.1); // London: outside the CONUS domain
    } on OutsideCoverageException catch (e) {
      print('Outside coverage (${e.code}), HTTP ${e.status}: ${e.message}');
      print('  request ${e.requestId}; see ${e.docUrl}');
    } on PermissionException catch (e) {
      print('Point forecasts need a Pro key (${e.code}).');
    } on EnsembleWeatherException catch (e) {
      // The hierarchy is sealed: a switch over it is exhaustive.
      final kind = switch (e) {
        ApiException(:final status) => 'HTTP $status',
        ConnectionException() => 'no response',
        UsageException() => 'a bad call',
      };
      print('Other Ourea error ($kind): ${e.message}');
    }

    final forecast = await client.forecast('or/mt-hood-meadows');
    final limit = forecast.meta?.rateLimit ?? client.rateLimit;
    print(limit == null
        ? 'No rate-limit headers on this response (an edge-cacheable '
            'anonymous response carries none).'
        : 'Rate limit: ${limit.remaining} of ${limit.limit} left, resets in '
            '${limit.reset} s (${limit.policy})');
  } finally {
    client.close();
  }
}

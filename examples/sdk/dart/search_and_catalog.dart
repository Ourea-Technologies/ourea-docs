// Search for a location, then page through the catalog: the Stream follows
// the cursor for you, fetching pages only as they are listened to.
import 'package:ensemble_weather/ensemble_weather.dart';

Future<void> main() async {
  final client = EnsembleWeatherClient();
  try {
    final hits = await client.searchLocations('hood meadows');
    for (final hit in hits.items) {
      print('found ${hit.name} (${hit.state}/${hit.slug}), ${hit.type}');
    }

    print('Oregon catalog:');
    await for (final location in client.catalogLocations(admin1: 'US-OR')) {
      print('  ${location.slug}: ${location.name}');
    }

    // Or one page at a time, with the cursor in your hands.
    final page = await client.catalogLocationsPage(limit: 20);
    print('first page: ${page.items.length} entries, '
        'next cursor ${page.nextCursor ?? 'none'}');
  } finally {
    client.close();
  }
}

// Search for a location, then page through the catalog with its cursor.
import com.oureawx.ensembleweather.CatalogLocationQuery;
import com.oureawx.ensembleweather.EnsembleWeatherClient;
import com.oureawx.ensembleweather.SearchOptions;
import com.oureawx.ensembleweather.model.CatalogLocationPage;
import com.oureawx.ensembleweather.model.SearchHit;
import com.oureawx.ensembleweather.model.SearchLocationsResponse;

public class SearchAndCatalog {
  public static void main(String[] args) {
    EnsembleWeatherClient client = EnsembleWeatherClient.builder().build();

    SearchLocationsResponse hits =
        client.searchLocations("hood meadows", SearchOptions.builder().limit(5).build());
    for (SearchHit hit : hits.items()) {
      System.out.println("search: " + hit.key() + "  " + hit.name() + " (" + hit.county() + ")");
    }

    // One page at a time...
    CatalogLocationQuery oregon = CatalogLocationQuery.builder().admin1("US-OR").limit(20).build();
    CatalogLocationPage first = client.listCatalogLocations(oregon);
    System.out.println(
        "first page: "
            + first.items().size()
            + " locations, next cursor "
            + first.nextCursor().orElse("(none)"));

    // ...or lazily, following next_cursor until the end (stop whenever you like).
    client.iterateCatalogLocations(oregon).stream()
        .limit(100)
        .forEach(location -> System.out.println("catalog: " + location.slug()));
  }
}

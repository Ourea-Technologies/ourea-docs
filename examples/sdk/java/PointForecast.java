// A forecast at coordinates with an elevation: the summit of Mt. Hood (Pro).
// Needs a Pro key in OUREA_API_KEY; without one it says so and exits 0.
import com.oureawx.ensembleweather.Coordinates;
import com.oureawx.ensembleweather.EnsembleWeatherClient;
import com.oureawx.ensembleweather.ForecastOptions;
import com.oureawx.ensembleweather.model.ForecastResponse;
import com.oureawx.ensembleweather.model.TimeSeriesPoint;

public class PointForecast {
  public static void main(String[] args) {
    EnsembleWeatherClient client = EnsembleWeatherClient.builder().build();
    if (!client.hasApiKey()) {
      System.out.println("Set OUREA_API_KEY to a Pro key to run this example; skipping.");
      return;
    }
    ForecastResponse forecast =
        client.getPointForecast(
            Coordinates.of(45.3736, -121.6960, 3429), // metres above sea level
            ForecastOptions.builder().maxHours(48).build());

    forecast
        .point()
        .ifPresent(
            p ->
                System.out.println(
                    "Computed at "
                        + p.lat()
                        + ", "
                        + p.lon()
                        + " ("
                        + p.elevation()
                        + " elevation, from "
                        + p.elevationSourceAsString()
                        + ")"));
    for (TimeSeriesPoint hour : forecast.forecast().timeseries()) {
      System.out.println(
          "  "
              + hour.validTime()
              + "  median "
              + hour.ensemble().temperature().median().orElse(Double.NaN)
              + " "
              + hour.conditionText());
    }
  }
}

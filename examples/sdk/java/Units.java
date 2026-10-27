// The same forecast in metric and imperial: the server converts, the SDK
// never does. Each response says which unit system its values are in.
import com.oureawx.ensembleweather.EnsembleWeatherClient;
import com.oureawx.ensembleweather.ForecastOptions;
import com.oureawx.ensembleweather.model.ForecastResponse;
import com.oureawx.ensembleweather.model.UnitSystem;

public class Units {
  public static void main(String[] args) {
    EnsembleWeatherClient client = EnsembleWeatherClient.builder().build();
    for (UnitSystem units : new UnitSystem[] {UnitSystem.METRIC, UnitSystem.IMPERIAL}) {
      ForecastResponse forecast =
          client.getForecast("or/mt-hood-meadows", ForecastOptions.builder().units(units).build());
      forecast.forecast().timeseries().stream()
          .findFirst()
          .ifPresent(
              hour ->
                  System.out.println(
                      forecast.unitsAsString()
                          + ": median temperature "
                          + hour.ensemble().temperature().median().orElse(Double.NaN)
                          + ", median wind "
                          + hour.ensemble().windSpeed().median().orElse(Double.NaN)
                          + " at "
                          + hour.validTime()));
    }
  }
}

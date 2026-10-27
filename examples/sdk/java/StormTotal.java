// Storm totals: the distribution of each member's own precipitation and
// snowfall total over a window, computed by the server (never summed hourly
// quantiles).
import com.oureawx.ensembleweather.EnsembleWeatherClient;
import com.oureawx.ensembleweather.ForecastOptions;
import com.oureawx.ensembleweather.TotalTerm;
import com.oureawx.ensembleweather.Window;
import com.oureawx.ensembleweather.model.ForecastResponse;
import com.oureawx.ensembleweather.model.Percentile;
import com.oureawx.ensembleweather.model.UnitSystem;
import com.oureawx.ensembleweather.model.Variable;
import com.oureawx.ensembleweather.model.WindowTotal;

public class StormTotal {
  public static void main(String[] args) {
    EnsembleWeatherClient client = EnsembleWeatherClient.builder().build();
    ForecastResponse forecast =
        client.getForecast(
            "or/mt-hood-meadows",
            ForecastOptions.builder()
                .total(TotalTerm.of(Variable.PRECIPITATION, Window.hours(48)))
                .total(TotalTerm.of(Variable.SNOWFALL, Window.hours(72)))
                .build());

    String unit = forecast.units() == UnitSystem.IMPERIAL ? " in" : " mm";
    for (WindowTotal total : forecast.windowTotals()) {
      String label = total.variableAsString() + " over the next " + total.windowEndHours() + " h";
      if (!total.quantiles().isPresent()) {
        System.out.println(label + ": not covered by this model run yet");
        continue;
      }
      total
          .quantiles()
          .get()
          .range(Percentile.P10, Percentile.P90)
          .ifPresent(
              r ->
                  System.out.println(
                      label
                          + ": most likely "
                          + total.quantiles().get().median().orElse(Double.NaN)
                          + unit
                          + ", at least "
                          + r.low()
                          + ", could reach "
                          + r.high()
                          + " ("
                          + total.members()
                          + " members)"));
    }
  }
}

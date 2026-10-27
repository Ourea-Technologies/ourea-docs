// Quickstart: an anonymous forecast for Mt. Hood Meadows, Oregon (no API key).
// Prints the next 24 hours' temperature as a p10-p90 range, and the chance of
// at least 6 in (15 cm) of snow in the next 24 hours.
import com.oureawx.ensembleweather.EnsembleWeatherClient;
import com.oureawx.ensembleweather.ForecastOptions;
import com.oureawx.ensembleweather.ProbabilityTerm;
import com.oureawx.ensembleweather.Threshold;
import com.oureawx.ensembleweather.model.ForecastResponse;
import com.oureawx.ensembleweather.model.Percentile;
import com.oureawx.ensembleweather.model.ProbabilityResult;
import com.oureawx.ensembleweather.model.TimeSeriesPoint;
import com.oureawx.ensembleweather.model.UnitSystem;
import com.oureawx.ensembleweather.model.Variable;
import java.util.List;

public class Quickstart {
  public static void main(String[] args) {
    EnsembleWeatherClient client = EnsembleWeatherClient.builder().build();
    ForecastOptions options =
        ForecastOptions.builder()
            .probability(ProbabilityTerm.atLeast(Variable.SNOWFALL, Threshold.inches(6)))
            .build();
    ForecastResponse forecast = client.getForecast("or/mt-hood-meadows", options);

    String degrees = forecast.units() == UnitSystem.IMPERIAL ? "°F" : "°C";
    System.out.println(forecast.location().name() + ": temperature, next 24 h (p10 to p90)");
    List<TimeSeriesPoint> hours = forecast.forecast().timeseries();
    for (TimeSeriesPoint hour : hours.subList(0, Math.min(25, hours.size()))) {
      hour.ensemble()
          .temperature()
          .range(Percentile.P10, Percentile.P90)
          .ifPresent(
              t ->
                  System.out.printf(
                      "  %s  %s to %s %s%n", hour.validTime(), t.low(), t.high(), degrees));
    }

    for (ProbabilityResult snow : forecast.probabilities()) {
      if (snow.probability().isPresent()) {
        System.out.printf(
            "Chance of 6 in (15 cm) or more of snow in the next 24 h: %.0f%% (%d members)%n",
            snow.probability().getAsDouble() * 100, snow.members());
      } else {
        System.out.println("The chance of 6 in of snow is not available for this window yet.");
      }
    }
  }
}

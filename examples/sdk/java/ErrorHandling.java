// Catch an out-of-coverage error by its type and code, and read the
// rate-limit state the API reports.
import com.oureawx.ensembleweather.Coordinates;
import com.oureawx.ensembleweather.EnsembleWeatherClient;
import com.oureawx.ensembleweather.EnsembleWeatherException;
import com.oureawx.ensembleweather.OutsideCoverageException;
import com.oureawx.ensembleweather.PermissionException;
import com.oureawx.ensembleweather.model.ForecastResponse;
import com.oureawx.ensembleweather.model.RateLimit;
import java.util.Optional;

public class ErrorHandling {
  public static void main(String[] args) {
    EnsembleWeatherClient client = EnsembleWeatherClient.builder().maxRetries(2).build();

    try {
      client.getPointForecast(Coordinates.of(51.5, -0.1)); // London: outside the CONUS domain
    } catch (OutsideCoverageException e) {
      System.out.println(
          "Outside coverage ("
              + e.code().orElse("")
              + ", HTTP "
              + e.status().orElse(0)
              + "): "
              + e.getMessage());
    } catch (PermissionException e) {
      System.out.println("Point forecasts need a Pro key (" + e.code().orElse("") + ").");
    } catch (EnsembleWeatherException e) {
      System.out.println("Other Ourea error, category " + e.category() + ": " + e.getMessage());
    }

    ForecastResponse forecast = client.getForecast("or/mt-hood-meadows");
    Optional<RateLimit> limit = forecast.metadata().rateLimit().or(client::lastRateLimit);
    System.out.println(
        limit
            .map(
                l ->
                    "Rate limit: "
                        + l.remaining()
                        + " of "
                        + l.limit()
                        + " left, resets in "
                        + l.reset().toSeconds()
                        + " s ("
                        + l.policy().orElse("no policy")
                        + ")")
            .orElse(
                "No rate-limit headers on this response (an edge-cacheable anonymous response"
                    + " carries none)."));
  }
}

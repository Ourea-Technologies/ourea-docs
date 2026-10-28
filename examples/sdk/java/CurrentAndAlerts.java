// Current conditions and the active NWS alerts for a location.
import com.oureawx.ensembleweather.EnsembleWeatherClient;
import com.oureawx.ensembleweather.LocationId;
import com.oureawx.ensembleweather.model.ActiveAlert;
import com.oureawx.ensembleweather.model.AlertsResponse;
import com.oureawx.ensembleweather.model.CurrentResponse;
import com.oureawx.ensembleweather.model.UnitSystem;

public class CurrentAndAlerts {
  public static void main(String[] args) {
    EnsembleWeatherClient client = EnsembleWeatherClient.builder().build();
    LocationId meadows = LocationId.of("or", "mt-hood-meadows");

    CurrentResponse now = client.getCurrent(meadows);
    now.current()
        .ifPresentOrElse(
            c ->
                System.out.println(
                    "Now at "
                        + now.location().name()
                        + ": "
                        + c.temperature()
                        + " "
                        + (now.units() == UnitSystem.IMPERIAL ? "°F" : "°C")
                        + ", "
                        + c.conditionText()
                        + ", wind "
                        + c.windSpeed()
                        + " ("
                        + c.sourceAsString()
                        + ")"),
            () -> System.out.println("No current conditions are servable right now."));

    AlertsResponse alerts = client.getAlerts(meadows);
    System.out.println(alerts.alertCount() + " active alert(s)");
    for (ActiveAlert alert : alerts.alerts()) {
      System.out.println("  " + alert.severityAsString() + ": " + alert.headline());
    }
  }
}

@0xd62698523ecbfddd;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("ourea");

# The Ourea weather API's Cap'n Proto schema (API v1).
#
# Every public read route answers `?format=capnp` with one standard
# (unpacked) Cap'n Proto message, `Content-Type: application/x-capnp`,
# whose root is the route's response struct (ForecastResponse,
# CurrentObservationsResponse, ListLocationsResponse,
# SearchLocationsResponse, ...). It carries the same values as the JSON body,
# under the same auth, rate limits, entitlements and cache policy. Errors stay
# JSON. Guide: https://docs.oureawx.com/capnp/
#
# Versioning: this schema only ever grows.
#  * Field ordinals (@0, @1, ...) never change, and fields are never deleted.
#  * Renaming a field is allowed: the wire format keys on @N, not the name.
#  * A breaking change would be a new struct; none is planned.
#
# Optional fields use the sibling-bool pattern (`hasFoo` + `foo`), because
# Cap'n Proto has no native Option type. When `hasFoo` is false the inner
# value is zero-initialized and must be ignored.

# ── Auth ────────────────────────────────────────────────────────────
#
# Mobile apps use either an API key (3rd-party / power users) OR a
# session token (logged-in app users). Exactly one of the two should
# be set per request; both empty → unauthenticated.
struct Credentials {
  apiKey       @0 :Text;   # X-API-Key equivalent. Empty = not provided.
  sessionToken @1 :Text;   # Authorization: Bearer <token> equivalent.
}

# Unit system selector. Mirrors the REST `?units=` query parameter.
enum Units {
  imperial @0;   # °F, mph, in, ft  (default)
  metric   @1;   # °C, m/s, mm, m
  # REST `?units=kelvin` -- metric with temperatures in K. New
  # enumerant; an older reader sees an unknown value.
  kelvin   @2;
}

# ── Forecast request / response ─────────────────────────────────────

struct ForecastRequest {
  credentials @0 :Credentials;
  state       @1 :Text;       # "OR" / "WA" / "CA" — case-insensitive.
  locationName @2 :Text;      # Catalog slug ("mt-hood-meadows", the key
                              # every response serves); the airport
                              # FAA code and the legacy camelCase name
                              # ("mtHoodMeadows") still resolve as aliases.
  maxHours    @3 :UInt32;     # 6..360 inclusive; 0 means default (24).
  units       @4 :Units;
  # ── Toggles mirroring REST query params. All default to false/zero.
  includeModels       @5 :Bool;     # ?models=true (per-model breakdowns).
  includeMembers      @6 :Bool;     # ?members=true (raw per-member values).
  showAllElevations   @7 :Bool;     # ?elevations=all (ski-area lapse forecasts).
  # `includeDaily` defaults to TRUE on REST; mirror that semantically
  # by interpreting `excludeDaily=true` as the opt-out signal so the
  # Cap'n Proto bool default-false matches REST default-true.
  excludeDaily        @8 :Bool;     # When true, skip daily summaries.
  # RFC-3339 init time for historical queries (`?run=...`). Empty = latest.
  requestedInitTime   @9 :Text;
  # Source filtering for the nowcast blend and `nearestSensors`. Both
  # are unioned with the server-side defaults: an empty `allowedSources`
  # falls back to the per-variable allowlist; `excludedSources` is
  # added to the deny list (cocorahs / usgs / ndbc / rawinsonde are
  # always denied unless explicitly allowed).
  allowedSources      @10 :List(Text);
  excludedSources     @11 :List(Text);
  # Daily rows for the run's first `maxDays` local dates,
  # independent of `maxHours` (REST `?max_days=`). 0 = default: the tier's
  # full horizon (Free 10, Pro 15); clamped to it.
  maxDays             @12 :UInt32;
  # Omit the hourly `timeseries` (REST `?hourly=false`) and serve
  # the dailies alone; `maxHours` is then ignored. Same opt-out convention
  # as `excludeDaily`. Setting both is INVALID_ARGUMENT.
  excludeHourly       @13 :Bool;
  # The REST `?elevations=<name>[,<name>]` selector -- serve only
  # these named elevations of a multi-elevation location (case, `-`, `_` and
  # spaces ignored), each with its members when `includeMembers` is set.
  # Empty (the default) = the primary only, unless `showAllElevations`,
  # which wins. A name the location does not have is a BAD_REQUEST error.
  # New ordinal; an older client never sets it.
  elevations          @14 :List(Text);
  # The REST `?feels_like=` selector -- which feels-like indices to
  # serve: "nws" (the NWS apparent temperature, `feelsLike*`) and/or "utci"
  # (`feelsLikeUtci*`). Empty (the default) = "nws", today's response. An
  # unknown name is BAD_REQUEST; "utci" is FEELS_LIKE_UNAVAILABLE until its
  # radiation inputs are stored. New ordinal; an older
  # client never sets it.
  feelsLike           @15 :List(Text);
  # The hourly `timeseries` starts at the CURRENT hour
  # and `maxHours` counts forward from it. `includePast` (REST
  # `?include_past=true`) serves it from the run's init instead, the hours
  # already past included -- the behaviour before 2026-10-19. A pinned
  # `requestedInitTime` is always served from its init. The daily rows cover
  # whole local days either way. New ordinal; an older client never sets it.
  includePast         @16 :Bool;
}

struct LocationInfo {
  name       @0 :Text;
  lat        @1 :Float64;
  lon        @2 :Float64;
  elevation  @3 :Float64;     # In the request's units (ft / m).
  type       @4 :Text;        # SkiArea / Town / Trailhead / etc.
  # Multi-elevation locations (ski areas) carry one entry per named
  # point (base / mid / summit). Empty for single-elevation locations.
  elevations @5 :List(ElevationInfo);
  # The IANA zone the location's local days and hours are kept in
  # ("America/Los_Angeles"). New ordinal; an older reader ignores it.
  timezone   @6 :Text;
  # The LocationRef fields REST serves (`name` is the display name).
  slug       @7 :Text;
  state      @8 :Text;
  elevationM @9 :Float64;
}

# Named elevation point on a multi-elevation location.
struct ElevationInfo {
  name       @0 :Text;        # Free-text label (e.g. "Mid Mountain").
  elevation  @1 :Float64;     # In the request's units.
  isDefault  @2 :Bool;        # The elevation a UI should show first.
}

struct ModelRunInfo {
  initializedAt   @0 :Int64;  # Unix seconds UTC.
  totalMembers    @1 :UInt32;
  aifsMembers     @2 :Int32;  # -1 = not contributing.
  aigefsMembers   @3 :Int32;
  ifsEnsMembers   @4 :Int32;
  rrfsMembers     @5 :Int32;
  sourceModels    @6 :Text;   # Comma-separated; matches REST.
  # GEFS member count. -1 = not contributing (matches the other *Members).
  # Trails by @N (logically a peer of the counts above); clients key on @N.
  gefsMembers     @7 :Int32;
  # REST `model_cycles`: each contributing model's OWN
  # cycle init. The blend is per-model-latest, so these differ model to
  # model; `initializedAt` is the newest. Empty when nothing was read.
  modelCycles     @8 :List(ModelCycle);
  # REST `models`, one entry per contributing model (the
  # per-model counts and modelCycles above stay for older clients).
  models @9 :List(ModelEntry);
}

struct ModelCycle {
  model         @0 :Text;   # "aifs", "gefs", "ifs_ens", ... (REST key).
  initializedAt @1 :Int64;  # Unix seconds UTC.
}

# Ensemble percentile bundle for one variable. Mirrors REST `StatValues`.
# Cap'n Proto keys on @N (not declaration order), so `p50` trails the
# original eight even though Rust declares it between p25 and p75.
# Spread = max - min.
struct StatValues {
  mean   @0 :Float64;
  min    @1 :Float64;
  p10    @2 :Float64;
  p25    @3 :Float64;
  p75    @4 :Float64;
  p90    @5 :Float64;
  max    @6 :Float64;
  spread @7 :Float64;
  # Ensemble median — headline-appropriate amount for skewed precip
  # (REST `p50`). Half the members above, half below.
  p50    @8 :Float64;
  # Probability of (non-zero) occurrence (REST `probability: Option`).
  # Present only on precipitation & snowfall stats; hasProbability is
  # false (and probability zero-init) for every other variable.
  hasProbability @9 :Bool;
  probability    @10 :Float64;
}

# Per-hour ensemble bundle. Mirrors REST `EnsembleStats`. The fields
# below the required four are signaled by sibling `has*` booleans —
# Cap'n Proto has no Option, so we use the convention that a false
# `hasFoo` means the corresponding struct is zero-initialized and
# carries no information.
struct EnsembleStats {
  temperature       @0  :StatValues;
  precipitation     @1  :StatValues;
  windSpeed         @2  :StatValues;
  windDirection     @3  :StatValues;

  hasFeelsLike      @4  :Bool;
  feelsLike         @5  :StatValues;
  hasDewpoint       @6  :Bool;
  dewpoint          @7  :StatValues;
  hasSnowLevel      @8  :Bool;
  snowLevel         @9  :StatValues;
  hasWindGust       @10 :Bool;
  windGust          @11 :StatValues;

  # Cloud cover percentage, 0–100. REST: `cloud_cover`.
  hasCloudCover     @12 :Bool;
  cloudCover        @13 :StatValues;
  # Snow-to-liquid ratio (unitless). REST: `slr`.
  hasSlr            @14 :Bool;
  slr               @15 :StatValues;
  # Snowfall in the request's length units. REST: `snowfall`.
  hasSnowfall       @16 :Bool;
  snowfall          @17 :StatValues;
  # Skin / ground surface temperature in the request's temperature
  # units. From IFS ENS `skt`. REST: `skin_temperature`.
  hasSkinTemperature @18 :Bool;
  skinTemperature    @19 :StatValues;
  # Model-native ECMWF ptype code (1=rain, 3=freezing rain, 5=snow,
  # 6=wet snow, 7=mixed, 8=ice pellets). REST: `ptype`.
  hasPtype          @20 :Bool;
  ptype             @21 :StatValues;
  # The wind direction as a circular distribution (REST
  # `wind_direction_circular`). New ordinals only; an old decoder reads a
  # zeroed struct with the flag false.
  hasWindDirectionCircular @22 :Bool;
  windDirectionCircular    @23 :CircularStats;
  # Mean sea-level pressure, hPa (inHg for imperial). REST:
  # `mslp`. New ordinals only; an old decoder never sees them.
  hasMslp           @24 :Bool;
  mslp              @25 :StatValues;
  # CAPE, J/kg in every unit system. REST: `cape`.
  hasCape           @26 :Bool;
  cape              @27 :StatValues;
  # Relative humidity, percent in every unit system. REST:
  # `relative_humidity`.
  hasRelativeHumidity @28 :Bool;
  relativeHumidity    @29 :StatValues;
  # The Universal Thermal Climate Index, request's temperature
  # units, per member like `feelsLike` (REST `feels_like_utci`). Present only
  # with `ForecastRequest.feelsLike` naming "utci", which is not served yet,
  # so the flag is false today. New ordinals only.
  hasFeelsLikeUtci  @30 :Bool;
  feelsLikeUtci     @31 :StatValues;
}

# A bearing's circular summary, mirroring REST `CircularStats`.
# Arcs are clockwise; `to` may be numerically smaller than `from` when the
# arc crosses north, and its width is (to - from) mod 360.
struct CircularStats {
  mean         @0 :Float64;   # resultant direction, degrees in [0, 360)
  hasStddev    @1 :Bool;
  stddev       @2 :Float64;   # offset-frame standard deviation, degrees
  sector50From @3 :Float64;
  sector50To   @4 :Float64;
  sector90From @5 :Float64;
  sector90To   @6 :Float64;
}

# Categorical precipitation type derived from snow level / SLR.
# Distinct from the model-native `ptype` StatValues above.
enum PrecipKind {
  rain          @0;
  snow          @1;
  rainSnowMix   @2;
  freezingRain  @3;
}

struct PrecipType {
  kind             @0 :PrecipKind;
  snowProbability  @1 :Float64;   # 0..1
  rainProbability  @2 :Float64;
}

# Inversion / cold-pool diagnostic for the hour. Absent when no
# inversion is detected (the parent struct's `hasInversion` is false).
enum InversionKind {
  surfaceShallow @0;
  coldPool       @1;
  elevated       @2;
}

struct InversionInfo {
  kind     @0 :InversionKind;
  depth    @1 :Float64;          # Length units of the request.
  strength @2 :Float64;          # Temperature units of the request.
}

# The hour's freezing level (0 °C height), REST `freezing_level`.
# A union, like the REST `kind` tag: each variant carries only the fields
# that mean something for it. Heights are MSL in the request's length units.
struct FreezingLevel {
  union {
    belowSurface @0 :Void;       # Freezing from the surface up.
    height :group {
      height                 @1 :Float64;  # Lowest 0 °C height.
      aboveFreezingLayerAloft @2 :Bool;    # Warm nose higher up.
    }
    aboveProfile :group {
      top @3 :Float64;           # Warm up to the highest level read.
    }
  }
}

# Per-model ensemble stats. The same 8 variables REST `ModelStats` carries,
# every one of them optional — so each value has a `has*` sibling and the
# struct is 17 ordinals, not the 12 it was before a change gave the first four
# their flags.
struct ModelStats {
  temperature   @0  :StatValues;
  precipitation @1  :StatValues;
  windSpeed     @2  :StatValues;
  windDirection @3  :StatValues;
  hasDewpoint   @4  :Bool;
  dewpoint      @5  :StatValues;
  hasSnowLevel  @6  :Bool;
  snowLevel     @7  :StatValues;
  hasSlr        @8  :Bool;
  slr           @9  :StatValues;
  hasSnowfall   @10 :Bool;
  snowfall      @11 :StatValues;
  # The global ensembles publish 6-hourly, so at five lead hours out
  # of six a contributing model has nothing for the hour. New ordinals only
  # (never renumber) -- old decoders see an unset (zeroed) struct with the
  # flag absent, the status quo for them; new decoders can tell absence from
  # a real 0 via the flag.
  hasTemperature   @12 :Bool;
  hasPrecipitation @13 :Bool;
  hasWindSpeed     @14 :Bool;
  hasWindDirection @15 :Bool;
  # This model did not publish at this lead -- the stats above were
  # interpolated from its two bracketing native steps so the blend pools the
  # same set of contributors at every lead. New ordinal only (never renumber):
  # old decoders read the zeroed default, false, which is what every hour said
  # before this landed.
  interpolated     @16 :Bool;
}

struct ModelMeans {
  hasAifs   @0 :Bool;
  aifs      @1 :ModelStats;
  hasAigefs @2 :Bool;
  aigefs    @3 :ModelStats;
  hasIfsEns @4 :Bool;
  ifsEns    @5 :ModelStats;
  hasRrfs   @6 :Bool;
  rrfs      @7 :ModelStats;
  hasGefs @8 :Bool;
  gefs    @9 :ModelStats;
}

# Single ensemble member's hourly forecast. Per-member values lack the
# spread/percentile structure, so we use scalar f64 + `has*` siblings.
struct MemberForecast {
  # memberId was `Text` to match the JSON API; switched to Int32 so
  # the API JSON serializes as a number and the RPC wire avoids the
  # length-prefixed UTF-8 path.
  memberId         @0 :Int32;
  temperature      @1 :Float64;
  hasPrecipitation @2 :Bool;
  precipitation    @3 :Float64;
  hasWindSpeed     @4 :Bool;
  windSpeed        @5 :Float64;
  hasWindDirection @6 :Bool;
  windDirection    @7 :Float64;
  hasSnowLevel     @8 :Bool;
  snowLevel        @9 :Float64;
  hasSlr           @10 :Bool;
  slr              @11 :Float64;
  hasSnowfall      @12 :Bool;
  snowfall         @13 :Float64;
  # A member of a 6-hourly model has NO temperature at five lead hours
  # out of six. Appended (ordinals cannot be renumbered) rather than sitting
  # beside `temperature`; read `temperature` only when this is true.
  hasTemperature   @14 :Bool;
  # The hours `precipitation` covers (REST `precipitation_hours`):
  # it is the total over that span ending at this hour. Appended ordinals.
  hasPrecipitationHours @15 :Bool;
  precipitationHours    @16 :UInt32;
  # This member's running totals from the start of the served
  # window (REST `cumulative_precipitation` / `cumulative_snowfall`). Each present exactly when its hourly value is. Appended.
  hasCumulativePrecipitation @17 :Bool;
  cumulativePrecipitation    @18 :Float64;
  hasCumulativeSnowfall      @19 :Bool;
  cumulativeSnowfall         @20 :Float64;
}

# Per-model member arrays, only populated when `includeMembers=true`.
struct MemberForecasts {
  aifs   @0 :List(MemberForecast);
  aigefs @1 :List(MemberForecast);
  ifsEns @2 :List(MemberForecast);
  rrfs   @3 :List(MemberForecast);
  gefs @4 :List(MemberForecast);
}

# The per-hour serve-path PROVENANCE tag (REST `provenance`, asked with
# `?diagnostics=provenance`) is not carried in this format: a Cap'n Proto reader
# must treat provenance as not reported, never as "nothing happened".
struct TimeSeriesPoint {
  validTime       @0 :Int64;     # Unix seconds.
  leadTimeHours   @1 :UInt32;
  isNight         @2 :Bool;
  condition       @3 :Text;      # "Clear", "Partly Cloudy", …
  conditionIcon   @4 :Text;      # "night_clear", "sunny", …
  ensemble        @5 :EnsembleStats;

  # Categorical precipitation type (rain / snow / mix / freezing rain).
  # Only meaningful when ensemble.precipitation.mean ≥ 0.1 mm.
  hasPrecipType   @6 :Bool;
  precipType      @7 :PrecipType;
  # Inversion diagnostic — absent on most hours.
  hasInversion    @8 :Bool;
  inversion       @9 :InversionInfo;
  # Per-model breakdown when the request set `includeModels=true`.
  hasModelMeans   @10 :Bool;
  modelMeans      @11 :ModelMeans;
  # Per-member values when the request set `includeMembers=true`.
  hasMembers      @12 :Bool;
  members         @13 :MemberForecasts;
  # Freezing level. New ordinals only.
  hasFreezingLevel @14 :Bool;
  freezingLevel    @15 :FreezingLevel;
  # The distribution of the members' running totals at this hour
  # (REST `members_cumulative`), present only with members, at an hour where
  # at least two members carry a running total. New ordinals only.
  hasMembersCumulative @16 :Bool;
  membersCumulative    @17 :MembersCumulative;
  # `condition` is the machine code (`partly_cloudy`); its display text.
  conditionText @18 :Text;
  # Whether the hour's gust is worth showing (REST `gust_notable`).
  hasGustNotable @19 :Bool;
  gustNotable    @20 :Bool;
  # The headline running totals (REST `cumulative_precipitation`,
  # `cumulative_snowfall`): the sum of the blend's hourly means so far.
  hasCumulativePrecipitation @21 :Bool;
  cumulativePrecipitation    @22 :Float64;
  hasCumulativeSnowfall      @23 :Bool;
  cumulativeSnowfall         @24 :Float64;
}

# One quantity's running totals across the members at an hour
# (REST `CumulativeStats`), in the response's precipitation units.
# Percentiles over the members' totals -- never sums of hourly percentiles.
struct CumulativeStats {
  members @0 :UInt32;
  mean    @1 :Float64;
  min     @2 :Float64;
  p10     @3 :Float64;
  p25     @4 :Float64;
  p50     @5 :Float64;
  p75     @6 :Float64;
  p90     @7 :Float64;
  max     @8 :Float64;
}

# REST `members_cumulative`. A quantity fewer than two members
# carry is absent (has* false).
struct MembersCumulative {
  hasPrecipitation @0 :Bool;
  precipitation    @1 :CumulativeStats;
  hasSnowfall      @2 :Bool;
  snowfall         @3 :CumulativeStats;
}

# Beaufort-style daily wind summary (REST: `daily.wind`).
enum WindStatus {
  calm        @0;
  light       @1;
  moderate    @2;
  strong      @3;
  veryStrong  @4;
  extreme     @5;
}

struct DailyWind {
  status         @0 :WindStatus;
  peakSpeed      @1 :Float64;
  isGust         @2 :Bool;        # peakSpeed is from gust data, not sustained wind.
  sustainedSpeed @3 :Float64;     # peak sustained wind; == peakSpeed when isGust is false.
  # REST `peak_speed_p90`: the "gusts could reach" tail
  # beside the expected peak. Present only when isGust.
  hasPeakSpeedP90 @4 :Bool;
  peakSpeedP90    @5 :Float64;
}

# Storm SLR-trend orientation (REST: `daily.storm_orientation`).
enum StormOrientation {
  rightSideUp @0;
  upsideDown  @1;
  mixed       @2;
}

# Eight-way moon phase enum (REST: `daily.moon_phase`).
enum MoonPhase {
  newMoon         @0;
  waxingCrescent  @1;
  firstQuarter    @2;
  waxingGibbous   @3;
  fullMoon        @4;
  waningGibbous   @5;
  lastQuarter     @6;
  waningCrescent  @7;
}

enum AstronomicalSeason {
  spring @0;
  summer @1;
  autumn @2;
  winter @3;
}

enum ZodiacSign {
  capricorn   @0;
  aquarius    @1;
  pisces      @2;
  aries       @3;
  taurus      @4;
  gemini      @5;
  cancer      @6;
  leo         @7;
  virgo       @8;
  libra       @9;
  scorpio     @10;
  sagittarius @11;
}

# Seasonal temperature normal served alongside a day (REST `DayClimatology`).
# Absent when no climatology station is in range (parent `hasClimatology`).
struct DayClimatology {
  mean @0 :Float64;   # All-hours seasonal mean.
  std  @1 :Float64;   # Seasonal standard deviation (incl. diurnal range).
}

struct DailyForecast {
  date              @0 :Text;        # YYYY-MM-DD, location-local.
  condition         @1 :Text;
  conditionIcon     @2 :Text;
  high              @3 :StatValues;
  low               @4 :StatValues;
  totalPrecip       @5 :StatValues;
  precipProbability @6 :Float64;     # 0..1
  snowProbability   @7 :Float64;     # 0..1
  snowLevelMean     @8 :Float64;
  sunrise           @9 :Int64;       # Unix seconds; 0 = unknown.
  sunset            @10 :Int64;

  # Dominant precipitation kind for the day (PrecipKind). When the
  # day is dry `hasPrecipType` is false.
  hasPrecipType     @11 :Bool;
  precipType        @12 :PrecipKind;
  # Wind chill applied to high/low.
  hasFeelsLikeHigh  @13 :Bool;
  feelsLikeHigh     @14 :StatValues;
  hasFeelsLikeLow   @15 :Bool;
  feelsLikeLow      @16 :StatValues;
  hasTotalSnowfall  @17 :Bool;
  totalSnowfall     @18 :StatValues;
  hasCloudCoverMean @19 :Bool;
  cloudCoverMean    @20 :Float64;    # 0..100
  hasWind           @21 :Bool;
  wind              @22 :DailyWind;
  hasStormOrientation @23 :Bool;
  stormOrientation  @24 :StormOrientation;
  # Plain-language companion to `stormOrientation`. Empty when absent.
  stormOrientationDescription @25 :Text;
  moonPhase         @26 :MoonPhase;
  moonIllumination  @27 :Float64;    # 0..1
  astronomicalSeason @28 :AstronomicalSeason;
  # No longer set (the zodiac sign is not served); ordinals are forever.
  zodiacSign        @29 :ZodiacSign;
  # Seasonal climate normal for the day from the nearest climatology
  # station (REST `climatology`). hasClimatology=false when out of range.
  hasClimatology @30 :Bool;
  climatology    @31 :DayClimatology;

  # `P(day total >= 1.0 mm)` — the chance the day precipitates at
  # all, read off the SAME day-total distribution `precipProbability` and
  # `totalPrecip` come from, at a lower threshold. This is the number
  # `condition` / `precipType` are derived from; `precipProbability`
  # (>= 2.5 mm) stays the "will it amount to anything" headline. One
  # distribution, two thresholds, so this is never below
  # `precipProbability`.
  #
  # NOT an NWS PoP: that event is >= 0.254 mm, this one is >= 1.0 mm, so
  # this reads LOWER than an NWS PoP for the same day. The threshold is
  # PROVISIONAL and set by what the served rho=1 rank-sum day total can
  # resolve, not by meteorology — it is re-measured once a fitted
  # rho < 1 lands, and it is expected to fall toward 0.254 mm.
  #
  # New ordinal, so a reader built against an older schema is unaffected.
  # A peer that predates the field sends the Float64 default 0.0, which is
  # indistinguishable from a genuinely dry day — pair it with
  # `precipProbability` before treating a 0 as a forecast.
  precipOccurrenceProbability @32 :Float64;   # 0..1

  # The daily UTCI high/low, built like `feelsLikeHigh`/`Low` (each
  # member's own extreme over the same windows). Present only with
  # `ForecastRequest.feelsLike` naming "utci", not served yet, so
  # the flags are false today. New ordinals only.
  hasFeelsLikeUtciHigh @33 :Bool;
  feelsLikeUtciHigh    @34 :StatValues;
  hasFeelsLikeUtciLow  @35 :Bool;
  feelsLikeUtciLow     @36 :StatValues;
  # `condition` is the machine code; its display text.
  conditionText @37 :Text;
  # The day's snow level, the day totals given a wet day, and the headline (REST
  # `snow_level`, `total_precip_if_wet`, `total_snowfall_if_wet`, `precip_display`).
  hasSnowLevel          @38 :Bool;
  snowLevel             @39 :Quantiles;
  hasTotalPrecipIfWet   @40 :Bool;
  totalPrecipIfWet      @41 :Quantiles;
  hasTotalSnowfallIfWet @42 :Bool;
  totalSnowfallIfWet    @43 :Quantiles;
  precipDisplay         @44 :PrecipDisplay;
}

struct SnowOutlook {
  next24h            @0 :Float64;
  next48h            @1 :Float64;
  next7d             @2 :Float64;
  hasOvernight4pm9am @3 :Bool;
  overnight4pm9am    @4 :Float64;
  # Whether each window is covered by the forecast; an uncovered
  # window (the model run ends first) has no total and reads as null.
  hasNext24h         @5 :Bool;
  hasNext48h         @6 :Bool;
  hasNext7d          @7 :Bool;
  # Each window's range -- the percentiles of every member's own
  # window total, the mean the headline's (REST `quantiles`).
  hasQuantiles       @8 :Bool;
  quantiles          @9 :SnowOutlookQuantiles;
}

# REST `SnowOutlook.quantiles`; a window absent (has* false) when
# too few members cover it. Each a StatValues (REST `Quantiles`: spread is
# max - min, no probability).
struct SnowOutlookQuantiles {
  hasNext24h @0 :Bool;
  next24h    @1 :StatValues;
  hasNext48h @2 :Bool;
  next48h    @3 :StatValues;
  hasNext7d  @4 :Bool;
  next7d     @5 :StatValues;
}

struct ForecastData {
  # Hours from the first served `timeseries` point to the last (: the
  # first is the current hour by default, the run's init with `includePast`).
  maxHours       @0 :UInt32;
  intervalHours  @1 :UInt32;
  timeseries     @2 :List(TimeSeriesPoint);
  daily          @3 :List(DailyForecast);
  hasSnowOutlook @4 :Bool;
  snowOutlook    @5 :SnowOutlook;
}

# Legacy compact hourly point for a non-primary elevation, projected
# from that elevation's full `hourly` series (ElevationForecast).
struct ElevationTimeSeriesPoint {
  validTime         @0 :Int64;
  leadTimeHours     @1 :UInt32;
  temperature       @2 :StatValues;
  hasSnowLevelDelta @3 :Bool;
  snowLevelDelta    @4 :StatValues;  # Elevation minus snow level: positive = above it = snow.
  hasWindSpeed      @5 :Bool;
  windSpeed         @6 :StatValues;
  hasWindGust       @7 :Bool;
  windGust          @8 :StatValues;
  # The hour's served precipitation and condition, as on the
  # variant's `hourly` point. New ordinals; an older reader ignores them.
  precipitation     @9 :StatValues;
  condition         @10 :Text;
  conditionIcon     @11 :Text;
  # `condition` is the machine code; its display text.
  conditionText @12 :Text;
}

struct ElevationForecast {
  name       @0 :Text;        # Free-text elevation label.
  elevation  @1 :Float64;     # Length units of the request.
  isDefault  @2 :Bool;        # UI default for multi-elevation cards.
  timeseries @3 :List(ElevationTimeSeriesPoint);  # Legacy; see `hourly`.
  daily      @4 :List(DailyForecast);
  # The elevation's own point forecast, built by the same pipeline
  # as the primary's. New ordinals; an older reader ignores them.
  # With `includeMembers`, each `hourly` point carries this
  # elevation's members (`hasMembers`), lapsed and PRISM-carried to it as its
  # headline is, in the response's `membersView`.
  lat            @5 :Float64;   # Where this elevation was forecast.
  lon            @6 :Float64;
  hourly         @7 :List(TimeSeriesPoint);
  hasSnowOutlook @8 :Bool;
  snowOutlook    @9 :SnowOutlook;
}

# Columbia Gorge gap flow detection (REST: `gap_flow`).
enum GapFlowStatus {
  none      @0;
  weak      @1;
  moderate  @2;
  strong    @3;
  extreme   @4;
}

struct GapFlowInfo {
  status            @0 :GapFlowStatus;
  pressureDiffHpa   @1 :Float64;     # +ve = east higher than west (easterly).
  windMultiplier    @2 :Float64;
  direction         @3 :Text;        # "easterly" / "westerly".
}

# One nearby observation sensor ranked by elevation-weighted distance.
struct NearestSensor {
  stationName         @0 :Text;
  source              @1 :Text;      # snotel / nws / raws / rwis / ski_resort / ...
  distanceKm          @2 :Float64;
  elevationDiff       @3 :Float64;   # Length units of the request.
  effectiveDistanceKm @4 :Float64;   # distance + |elevation_diff_m|/100.
  observationTime     @5 :Int64;     # Unix seconds UTC.
  # The station id (REST `station_id`; `stationName` holds it too) and its registry name.
  stationId @6 :Text;
  name      @7 :Text;
}

struct ForecastResponse {
  location          @0 :LocationInfo;
  modelRun          @1 :ModelRunInfo;
  forecast          @2 :ForecastData;
  # Lapse-rate forecasts for ski-area sub-elevations (only when the
  # request set `showAllElevations=true` and the location has more
  # than one elevation point).
  elevationForecasts @3 :List(ElevationForecast);
  # Columbia Gorge gap flow status (only for Gorge corridor locations).
  hasGapFlow        @4 :Bool;
  gapFlow           @5 :GapFlowInfo;
  # Nearby sensors ranked by elevation-weighted distance (top 5 by default).
  nearestSensors    @6 :List(NearestSensor);
  # Which member view the timeseries' members carry (REST
  # `members_view`). `plume` withholds wind and SLR: a false has-flag on a
  # withheld field is the view, not a member that published nothing.
  membersView       @7 :MembersView;
  # ── The rest of the REST body. New ordinals only.
  # Whether the live observation layers were applied (REST
  # `nowcast_applied`; false for `?nowcast=false`).
  nowcastApplied    @8 :Bool;
  # The coordinate forecast's point (REST `point`).
  hasPoint          @9 :Bool;
  point             @10 :PointInfo;
  # "Right now" flattened (REST `current`).
  hasCurrent        @11 :Bool;
  current           @12 :CurrentConditions;
  # The data sources this body draws on (REST `attribution`).
  attribution       @13 :Attribution;
  # The unit system every value in this body is in (REST `units`):
  # the request's. `hasUnits` is false only on a message from a server older
  # than this field -- read `units` only when it is true (the enum's default,
  # `imperial`, would otherwise be a guess).
  hasUnits          @14 :Bool;
  units             @15 :Units;
  # The live nowcast sources this body was built without because
  # their read did not answer in time (REST `nowcast_unavailable`). Empty =
  # every source was read (or an older server).
  nowcastUnavailable @16 :List(Text);
  # The options the server applied after the tier clamps (REST
  # `applied`); false on a body no request shaped.
  hasApplied        @17 :Bool;
  applied           @18 :AppliedOptions;
  # The `prob` terms answered, and the `totals` distributions (REST
  # `probabilities`, `window_totals`); empty when none were asked.
  probabilities @19 :List(ProbabilityResult);
  windowTotals  @20 :List(WindowTotal);
  # The event behind every served probability (REST `thresholds`).
  hasThresholds @21 :Bool;
  thresholds    @22 :ProbabilityThresholds;
}

# The effective forecast options and which requested values
# the server changed (REST `AppliedOptions`).
struct AppliedOptions {
  hasMaxHours @0 :Bool;
  maxHours    @1 :UInt32;
  hasMaxDays  @2 :Bool;
  maxDays     @3 :UInt32;
  # Option names, in the REST order (`max_hours`, then `max_days`).
  clamped     @4 :List(Text);
}

# Where a coordinate forecast was computed (REST `PointInfo`).
struct PointInfo {
  requestedLat    @0 :Float64;
  requestedLon    @1 :Float64;
  lat             @2 :Float64;   # Quantized to resolutionDeg.
  lon             @3 :Float64;
  resolutionDeg   @4 :Float64;
  elevation       @5 :Float64;   # Length units of the request.
  elevationSource @6 :Text;      # "request" | "dem_3dep_10m"
  state           @7 :Text;      # Two-letter code.
}

# The flattened current-conditions block (REST `current`). Every
# value is the served mean of the hour `time` names, in the request's units.
struct CurrentConditions {
  time                 @0 :Int64;    # Unix seconds UTC.
  temperature          @1 :Float64;
  hasFeelsLike         @2 :Bool;
  feelsLike            @3 :Float64;
  condition            @4 :Text;
  conditionIcon        @5 :Text;
  wind                 @6 :CurrentWind;
  hasHumidity          @7 :Bool;
  humidity             @8 :Float64;  # Percent.
  hasDewpoint          @9 :Bool;
  dewpoint             @10 :Float64;
  hasPrecipProbability @11 :Bool;
  precipProbability    @12 :Float64; # 0..1
  source               @13 :Text;    # "nowcast" | "model"
  hasStation           @14 :Bool;
  station              @15 :CurrentStation;
  # `condition` is the machine code; its display text. The wind, flat as the
  # forecast's ensemble names it (REST `wind_speed`, `wind_gust`, `wind_direction`).
  conditionText @16 :Text;
  windSpeed     @17 :Float64;
  hasWindGust   @18 :Bool;
  windGust      @19 :Float64;
  windDirection @20 :Float64;
}

struct CurrentWind {
  speed     @0 :Float64;
  hasGust   @1 :Bool;
  gust      @2 :Float64;
  direction @3 :Float64;   # Degrees clockwise from north.
}

struct CurrentStation {
  name            @0 :Text;
  observationTime @1 :Int64;   # Unix seconds UTC.
}

# The response's data-source credit (REST `attribution`).
struct Attribution {
  sources @0 :List(Text);   # Registry ids (GET /api/v1/attribution).
  credit  @1 :Text;         # The providers' credit lines, "; "-joined.
  url     @2 :Text;         # The full notices: /api/v1/attribution.
}

enum MembersView {
  none  @0;   # no members in this response (the default for old servers)
  plume @1;   # free: temperature, precipitation (+hours), snow level, snowfall
  full  @2;   # pro: every member variable
}

# ── List runs (REST: GET /api/v1/runs) ──────────────────────────────

struct ListRunsRequest {
  credentials @0 :Credentials;
  limit       @1 :UInt32;     # 0 → server default (10), capped at 100.
}

struct ListRunsResponse {
  count          @0 :UInt32;
  availableRuns  @1 :List(Int64);   # Unix seconds UTC.
  # REST /runs -- what a forecast serves now, and the pinnable runs.
  hasServed @2 :Bool;
  served    @3 :ServedRun;
  runs      @4 :List(RunEntry);
}

# ── List locations (REST: GET /api/v1/locations[/{state}]) ──────────

struct ListLocationsRequest {
  credentials @0 :Credentials;
  state       @1 :Text;       # "OR" / "WA" / "CA" / empty = all.
  type        @2 :Text;       # Empty = no filter; otherwise camelCase enum value.
  units       @3 :Units;
  # Keyset paging, as REST (`?limit=&cursor=`). Ordered by slug;
  # `cursor` is the previous page's `nextCursor`. limit 0 = the REST
  # default: one page of 5000 for the all-states list (never the whole
  # catalog), the whole state for a state. Capped at 5000.
  cursor      @4 :Text;
  limit       @5 :UInt32;
}

struct LocationSummary {
  name           @0 :Text;       # The catalog slug ("mt-hood-meadows"):
                                 # the location's one key, as search's
                                 # `slug` and a stored favorite. MEANING
                                 # CHANGED: it was the airport
                                 # FAA code, else the camelCase display
                                 # name ("mtHoodMeadows"); both still
                                 # resolve as locationName aliases.
  displayName    @1 :Text;
  lat            @2 :Float64;
  lon            @3 :Float64;
  elevation      @4 :Float64;
  type           @5 :Text;
  state          @6 :Text;
  county         @7 :Text;
  hasDescription @8 :Bool;
  description    @9 :Text;
  elevations     @10 :List(ElevationInfo);
  # The IANA zone the location's local days and hours are kept in
  # ("America/Los_Angeles"). New ordinal; an older reader ignores it.
  timezone       @11 :Text;
  # `name` is now the display name, as REST; the key is `slug`.
  slug       @12 :Text;
  elevationM @13 :Float64;
}

struct ListLocationsResponse {
  state     @0 :Text;
  count     @1 :UInt32;
  locations @2 :List(LocationSummary);
  # The slug to pass back as `cursor` for the next page; empty on
  # the last page (REST `next_cursor` absent).
  nextCursor @3 :Text;
}

# ── Current observations (REST: .../current) ────────────────────────

struct CurrentObservationsRequest {
  credentials     @0 :Credentials;
  state           @1 :Text;
  locationName    @2 :Text;            # As ForecastRequest.locationName.
  units           @3 :Units;
  allowedSources  @4 :List(Text);    # Same semantics as ForecastRequest.
  excludedSources @5 :List(Text);
}

# Latest reading from one sensor near the requested location. Most
# fields are optional because each network exposes a different subset
# (a SNOTEL station has SWE but no road-pavement temperature; an RWIS
# station has the inverse).
struct SensorObservation {
  station             @0  :Text;
  source              @1  :Text;
  observationTime     @2  :Int64;
  hasTemperature      @3  :Bool;
  temperature         @4  :Float64;
  hasPrecipitation    @5  :Bool;
  precipitation       @6  :Float64;
  hasWindSpeed        @7  :Bool;
  windSpeed           @8  :Float64;
  hasWindDirection    @9  :Bool;
  windDirection       @10 :Float64;
  hasPressure         @11 :Bool;
  pressure            @12 :Float64;
  hasHumidity         @13 :Bool;
  humidity            @14 :Float64;
  hasDewpoint         @15 :Bool;
  dewpoint            @16 :Float64;
  hasPavementTemp     @17 :Bool;
  pavementTemp        @18 :Float64;
  hasSubsurfaceTemp   @19 :Bool;
  subsurfaceTemp      @20 :Float64;
  hasVisibility       @21 :Bool;
  visibility          @22 :Float64;
  hasSnowDepth        @23 :Bool;
  snowDepth           @24 :Float64;
  hasSwe              @25 :Bool;
  swe                 @26 :Float64;
  hasSwePercentOfMedian @27 :Bool;
  swePercentOfMedian    @28 :Float64;
  hasWindGust         @29 :Bool;
  windGust            @30 :Float64;
  hasSnowfall         @31 :Bool;
  snowfall            @32 :Float64;
  hasSolarRadiation   @33 :Bool;
  solarRadiation      @34 :Float64;
  hasPavementCondition @35 :Bool;
  pavementCondition    @36 :Text;
  # The readings REST serves that this struct lacked. Same units
  # rule as the fields above (cloud cover percent, radar dBZ, rate mm/h or
  # in/h, ceiling m or ft).
  hasCloudCover       @37 :Bool;
  cloudCover          @38 :Float64;
  hasCeilingHeight    @39 :Bool;
  ceilingHeight       @40 :Float64;
  hasPrecipRate       @41 :Bool;
  precipRate          @42 :Float64;
  hasReflectivity     @43 :Bool;
  reflectivity        @44 :Float64;
  # The station's registry name (`station` is its id).
  name @45 :Text;
}

struct CurrentObservationsResponse {
  location  @0 :Text;
  lat       @1 :Float64;
  lon       @2 :Float64;
  elevation @3 :Float64;
  sensors   @4 :List(SensorObservation);
  count     @5 :UInt32;
  # ── The rest of the REST `/current` body. New ordinals only.
  alerts                   @6  :List(ActiveAlert);
  alertsAsOf               @7  :Int64;   # Unix seconds UTC.
  asOf                     @8  :Int64;   # When this overlay was assembled.
  # The reference init of the cycle the band came from; 0 with
  # hasModelRunInitializedAt false when no cycle is servable.
  hasModelRunInitializedAt @9  :Bool;
  modelRunInitializedAt    @10 :Int64;
  # The obs-blended hours in [asOf - 1 h, asOf + 10 h]; absent (flag false)
  # when no cycle is servable.
  hasNowcastHours          @11 :Bool;
  nowcastHours             @12 :List(TimeSeriesPoint);
  hasCurrent               @13 :Bool;
  current                  @14 :CurrentConditions;
  units                    @15 :Units;
  attribution              @16 :Attribution;
  # The IANA zone the location's local days and hours are kept in
  # ("America/Los_Angeles"). New ordinal; an older reader ignores it.
  timezone                 @17 :Text;
  # The live nowcast sources the band was built without because
  # their read did not answer in time (REST `nowcast_unavailable`): any of
  # "observation", "radar", "cloud", "nearest_sensors". Empty = all read.
  nowcastUnavailable       @18 :List(Text);
  # The one location reference (REST `location`).
  locationRef @19 :LocationRef;
}

# One active NWS watch/warning/advisory (REST `ActiveAlert`).
struct ActiveAlert {
  id       @0 :Text;
  event    @1 :Text;
  severity @2 :Text;
  urgency  @3 :Text;
  headline @4 :Text;
  onset    @5 :Int64;   # Unix seconds UTC; 0 = not given.
  expires  @6 :Int64;
  ends     @7 :Int64;   # 0 = not given.
}

# ── Location search ─────────────

struct SearchLocationsRequest {
  credentials @0 :Credentials;
  query       @1 :Text;    # Free text; min 2 normalized chars. A trailing
                           # state token ("boston ma") is a SOFT rank hint.
  state       @2 :Text;    # HARD filter: 2-letter code or full name. Empty = none.
  county      @3 :Text;    # HARD filter: county name. Empty = none.
  type        @4 :Text;    # HARD filter: location type (camelCase). Empty = none.
                           # Also the only way to get observationStation rows.
  limit       @5 :UInt32;  # 0 = default (20); capped at 100.
  units       @6 :Units;   # Elevation unit for hits.
}

struct SearchLocationHit {
  key         @0 :Text;    # "<state-lower>-<slug>" — the state-qualified
                           # identity clients must key caches/favorites on
                           # (bare slugs are only unique per state).
  slug        @1 :Text;
  displayName @2 :Text;
  state       @3 :Text;    # Two-letter code.
  county      @4 :Text;
  type        @5 :Text;    # Primary type (SkiArea / CityTown / …).
  lat         @6 :Float64;
  lon         @7 :Float64;
  elevation   @8 :Float64; # In the request's units (ft / m).
  # Every type the location carries (REST `types`); `type` above is
  # the primary one.
  types       @9 :List(Text);
  # The IANA zone the location's local days and hours are kept in
  # ("America/Los_Angeles"). New ordinal; an older reader ignores it.
  timezone    @10 :Text;
  # Metres, whatever `units` (REST `elevation_m`).
  elevationM @11 :Float64;
}

struct SearchLocationsResponse {
  hits  @0 :List(SearchLocationHit);
  count @1 :UInt32;
}

# ── Service interface ───────────────────────────────────────────────

interface WeatherService {
  # Mirror of `GET /api/v1/locations/:state/:name`.
  # Errors are propagated as Cap'n Proto exceptions; clients see them
  # as a failed promise. The exception message includes a stable code
  # prefix the REST API uses ("LOCATION_NOT_FOUND", "UNAUTHORIZED",
  # "INVALID_MAX_HOURS", "INTERNAL").
  getLocationForecast    @0 (req :ForecastRequest)            -> (resp :ForecastResponse);

  # Mirror of `GET /api/v1/runs`.
  listRuns               @1 (req :ListRunsRequest)            -> (resp :ListRunsResponse);

  # Mirror of `GET /api/v1/locations[/{state}]`.
  listLocations          @2 (req :ListLocationsRequest)       -> (resp :ListLocationsResponse);

  # Mirror of `GET /api/v1/locations/:state/:name/current`.
  getCurrentObservations @3 (req :CurrentObservationsRequest) -> (resp :CurrentObservationsResponse);

  # Mirror of `GET /api/v1/search/locations` — fast typeahead over the
  # in-memory catalog index. Same tier/hint/filter semantics as REST.
  searchLocations        @4 (req :SearchLocationsRequest)     -> (resp :SearchLocationsResponse);
}

# One location reference, as REST `LocationRef`.
struct LocationRef {
  slug       @0 :Text;
  state      @1 :Text;
  name       @2 :Text;
  lat        @3 :Float64;
  lon        @4 :Float64;
  elevationM @5 :Float64;
  type       @6 :Text;
  timezone   @7 :Text;
}

# One answered probability term (REST `ProbabilityResult`).
struct ProbabilityResult {
  variable         @0 :Text;
  op               @1 :Text;
  threshold        @2 :Float64;
  windowStartHours @3 :UInt32;
  windowEndHours   @4 :UInt32;
  aggregation      @5 :Text;
  hasFrom          @6 :Bool;
  from             @7 :Int64;
  hasTo            @8 :Bool;
  to               @9 :Int64;
  hasProbability   @10 :Bool;
  probability      @11 :Float64;
  members          @12 :UInt32;
}

# One window total across the members (REST `WindowTotal`).
struct WindowTotal {
  variable         @0 :Text;
  windowStartHours @1 :UInt32;
  windowEndHours   @2 :UInt32;
  hasFrom          @3 :Bool;
  from             @4 :Int64;
  hasTo            @5 :Bool;
  to               @6 :Int64;
  hasQuantiles     @7 :Bool;
  quantiles        @8 :WindowQuantiles;
  members          @9 :UInt32;
}

# A window total's distribution (caller units).
struct WindowQuantiles {
  mean @0 :Float64;
  min  @1 :Float64;
  p10  @2 :Float64;
  p25  @3 :Float64;
  p50  @4 :Float64;
  p75  @5 :Float64;
  p90  @6 :Float64;
  max  @7 :Float64;
}

# The one quantile shape (REST `Quantiles`).
struct Quantiles {
  mean   @0 :Float64;
  p10    @1 :Float64;
  p25    @2 :Float64;
  p50    @3 :Float64;
  p75    @4 :Float64;
  p90    @5 :Float64;
  hasMin @6 :Bool;
  min    @7 :Float64;
  hasMax @8 :Bool;
  max    @9 :Float64;
}

# A day's precipitation headline (REST `PrecipDisplay`).
struct PrecipDisplay {
  kind      @0 :Text;
  chance    @1 :Float64;
  hasAmount @2 :Bool;
  amount    @3 :Float64;
}

# The event behind each served probability (REST `ProbabilityThresholds`).
struct ProbabilityThresholds {
  hourlyPrecipitation              @0 :Float64;
  hourlySnowfall                   @1 :Float64;
  dailyPrecipProbability           @2 :Float64;
  dailyPrecipOccurrenceProbability @3 :Float64;
  dailySnowProbability             @4 :Float64;
}

# REST `RunsResponse.served`.
struct ServedRun {
  initializedAt @0 :Int64;
  modelCycles   @1 :List(ModelCycleEntry);
  # REST `served.models`; supersedes modelCycles (never
  # released), which is left empty.
  models @2 :List(ModelEntry);
}

# One model's cycle (REST `model_cycles`, a map).
struct ModelCycleEntry {
  model @0 :Text;
  cycle @1 :Int64;
}

# REST `RunsResponse.runs[]`.
struct RunEntry {
  initializedAt @0 :Int64;
}

# REST `AlertsResponse` (/locations/{state}/{name}/alerts and /alerts?lat&lon).
struct AlertsResponse {
  location    @0 :LocationRef;
  alerts      @1 :List(ActiveAlert);
  alertCount  @2 :UInt32;
  asOf        @3 :Int64;
  attribution @4 :Attribution;
}

# REST `NearbyLocation` (a LocationSummary row and its distance).
struct NearbyLocation {
  location   @0 :LocationSummary;
  distanceKm @1 :Float64;
}

# REST `NearbyLocationsResponse`.
struct NearbyLocationsResponse {
  location  @0 :LocationSummary;
  radiusKm  @1 :Float64;
  count     @2 :UInt32;
  locations @3 :List(NearbyLocation);
}

# REST `NearbyPointResponse` (/nearby?lat&lon).
struct NearbyPointResponse {
  lat       @0 :Float64;
  lon       @1 :Float64;
  radiusKm  @2 :Float64;
  count     @3 :UInt32;
  locations @4 :List(NearbyLocation);
}

# REST `StormReportCard`; optional values are has*-flagged.
struct StormReportCard {
  id                    @0 :Int64;
  locationName          @1 :Text;
  eventType             @2 :Text;
  onsetTime             @3 :Int64;
  endTime               @4 :Int64;
  forecastTotalMm       @5 :Float64;
  observedTotalMm       @6 :Float64;
  hasForecastSnowfallMm @7 :Bool;
  forecastSnowfallMm    @8 :Float64;
  hasObservedSnowfallMm @9 :Bool;
  observedSnowfallMm    @10 :Float64;
  hasBestModel          @11 :Bool;
  bestModel             @12 :Text;
  hasBestLeadTimeHours  @13 :Bool;
  bestLeadTimeHours     @14 :Int32;
  hasCompositeScore     @15 :Bool;
  compositeScore        @16 :Float64;
  hasHeadline           @17 :Bool;
  headline              @18 :Text;
}

# REST `StormReportsResponse`.
struct StormReportsResponse {
  reports @0 :List(StormReportCard);
  count   @1 :UInt32;
}

# One source of the attribution registry.
struct AttributionSource {
  id       @0 :Text;
  name     @1 :Text;
  kind     @2 :Text;
  provider @3 :Text;
}

# One provider of the attribution registry (REST `providers[]`).
struct AttributionProvider {
  id         @0 :Text;
  name       @1 :Text;
  credit     @2 :Text;
  licence    @3 :Text;
  licenceUrl @4 :Text;
  termsUrl   @5 :Text;
  modified   @6 :Bool;
  notices    @7 :List(Text);
  sources    @8 :List(AttributionSource);
}

# REST /attribution.
struct AttributionRegistry {
  providers @0 :List(AttributionProvider);
}

# REST `PublicCatalogElevation`.
struct CatalogElevation {
  label          @0 :Text;
  elevationM     @1 :Float64;
  hasLatOverride @2 :Bool;
  latOverride    @3 :Float64;
  hasLonOverride @4 :Bool;
  lonOverride    @5 :Float64;
  isDefault      @6 :Bool;
}

# REST `PublicCatalogPhoto` (empty text = absent).
struct CatalogPhoto {
  url        @0 :Text;
  caption    @1 :Text;
  credit     @2 :Text;
  altText    @3 :Text;
  license    @4 :Text;
  licenseUrl @5 :Text;
}

# REST `PublicCatalogWebcam` (empty text = absent).
struct CatalogWebcam {
  name                      @0 :Text;
  url                       @1 :Text;
  embedType                 @2 :Text;
  provider                  @3 :Text;
  hasRefreshIntervalSeconds @4 :Bool;
  refreshIntervalSeconds    @5 :Int32;
}

# REST `PublicCatalogNearbyStation`.
struct CatalogNearbyStation {
  slug              @0 :Text;
  name              @1 :Text;
  network           @2 :Text;
  stationStatus     @3 :Text;
  hasDistanceKm     @4 :Bool;
  distanceKm        @5 :Float64;
  hasElevationDiffM @6 :Bool;
  elevationDiffM    @7 :Float64;
  isPrimary         @8 :Bool;
}

# REST `PublicCatalogPrimaryLocation`.
struct CatalogPrimaryLocation {
  slug       @0 :Text;
  name       @1 :Text;
  lat        @2 :Float64;
  lon        @3 :Float64;
  elevationM @4 :Float64;
  type       @5 :Text;
}

# One public catalog location or station (REST `PublicCatalogLocation`/`Station`
# and their details). Text fields are empty when absent; free-form JSON fields are carried as
# JSON text (`*Json`), as REST serves them unshaped. A field the entry's kind lacks is empty.
struct CatalogEntry {
  slug                      @0 :Text;
  state                     @1 :Text;
  name                      @2 :Text;
  lat                       @3 :Float64;
  lon                       @4 :Float64;
  elevationM                @5 :Float64;
  type                      @6 :Text;
  timezone                  @7 :Text;
  county                    @8 :Text;
  country                   @9 :Text;
  aliases                   @10 :List(Text);
  descriptionShort          @11 :Text;
  descriptionLong           @12 :Text;
  microclimateNotes         @13 :Text;
  metaTitle                 @14 :Text;
  metaDescription           @15 :Text;
  bestSeasons               @16 :List(Text);
  keyFactors                @17 :List(Text);
  tags                      @18 :List(Text);
  externalLinksJson         @19 :Text;
  isFeatured                @20 :Bool;
  network                   @21 :Text;
  sourceStationId           @22 :Text;
  hasElevationMslM          @23 :Bool;
  elevationMslM             @24 :Float64;
  hasSensorHeightAglM       @25 :Bool;
  sensorHeightAglM          @26 :Float64;
  sensorCapabilities        @27 :List(Text);
  stationStatus             @28 :Text;
  hasLastReportAt           @29 :Bool;
  lastReportAt              @30 :Int64;
  lastReportSummaryJson     @31 :Text;
  installDate               @32 :Text;
  decommissionDate          @33 :Text;
  hasUpdateFrequencyMinutes @34 :Bool;
  updateFrequencyMinutes    @35 :Int32;
  stationUrl                @36 :Text;
  dataUrl                   @37 :Text;
  elevations                @38 :List(CatalogElevation);
  photos                    @39 :List(CatalogPhoto);
  webcams                   @40 :List(CatalogWebcam);
  nearbyStations            @41 :List(CatalogNearbyStation);
  hasPrimaryLocation        @42 :Bool;
  primaryLocation           @43 :CatalogPrimaryLocation;
  templateJson              @44 :Text;
  contentJson               @45 :Text;
  adsJson                   @46 :Text;
}

# REST `PublicCatalogLocationPage`/`StationPage`.
struct CatalogPage {
  items      @0 :List(CatalogEntry);
  nextCursor @1 :Text;
}

# One contributing model (REST `ModelEntry`).
struct ModelEntry {
  id         @0 :Text;
  hasCycle   @1 :Bool;
  cycle      @2 :Int64;
  hasMembers @3 :Bool;
  members    @4 :UInt32;
}

# REST `GET /api/v1/maps/token` (Pro), so the
# route answers `?format=capnp` like every other public route.
struct MapsToken {
  token     @0 :Text;
  expiresAt @1 :Int64;   # Unix seconds.
  prefix    @2 :Text;
}

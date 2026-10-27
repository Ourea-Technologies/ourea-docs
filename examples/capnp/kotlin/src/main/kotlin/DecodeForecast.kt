// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Decode an Ourea forecast served with `?format=capnp` in Kotlin: one
// standard (unpacked, `capnp::serialize` framing) message whose root is
// `ForecastResponse` in https://docs.oureawx.com/schema/v1/ourea.capnp.
// Bindings come from capnpc-java (./gen.sh); the runtime is
// org.capnproto:runtime.
//
//   curl -sS --compressed -o forecast.bin \
//     'https://api.oureawx.com/api/v1/locations/or/mt-hood-meadows?format=capnp'
//   ./gen.sh && gradle -q run --args=forecast.bin
//
// Values are in the request's `units`. Read `units` only when `hasUnits`
// is true: the `Units` enum's zero value is `imperial`, while the REST
// default is metric, so an unset field would otherwise be misread.
import com.oureawx.examples.capnp.Ourea
import java.io.FileInputStream
import java.nio.channels.Channels
import java.nio.channels.ReadableByteChannel
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Locale
import org.capnproto.ReaderOptions
import org.capnproto.Serialize

private fun rfc3339(unix: Long): String = DateTimeFormatter.ISO_INSTANT.format(Instant.ofEpochSecond(unix))

private fun one(v: Double): String = String.format(Locale.ROOT, "%.1f", v)

fun main(args: Array<String>) {
    val channel: ReadableByteChannel =
        if (args.isNotEmpty()) FileInputStream(args[0]).channel else Channels.newChannel(System.`in`)
    // Large bodies (a 360 h plume) exceed the default traversal limit.
    val options = ReaderOptions(1L shl 30, 64)
    val message = channel.use { Serialize.read(it, options) }
    val r = message.getRoot(Ourea.ForecastResponse.factory)

    val loc = r.location
    println("location: ${loc.name} (${loc.slug}, ${loc.state}) ${loc.timezone}")
    val run = r.modelRun
    println("initialized_at: ${rfc3339(run.initializedAt)}")
    println("members: ${run.totalMembers}")

    val units =
        if (!r.hasUnits) {
            "unknown"
        } else {
            when (r.units) {
                Ourea.Units.METRIC -> "metric"
                Ourea.Units.IMPERIAL -> "imperial"
                Ourea.Units.KELVIN -> "kelvin"
                else -> "unknown" // an enumerant newer than this schema
            }
        }
    println("units: $units")

    val hours = r.forecast.timeseries
    if (hours.size() > 0) {
        val h = hours.get(0)
        val t = h.ensemble.temperature
        println("first_hour: ${rfc3339(h.validTime)} temperature p10=${one(t.p10)} p50=${one(t.p50)} p90=${one(t.p90)}")
    }
    println("hours: ${hours.size()}")
    println("probabilities: ${r.probabilities.size()}")
}

// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Decode an Ourea forecast served with `?format=capnp`: one standard
// (unpacked, `capnp::serialize` framing) message whose root is
// `ForecastResponse` in https://docs.oureawx.com/schema/v1/ourea.capnp.
//
//   curl -sS --compressed -o forecast.bin \
//     'https://api.oureawx.com/api/v1/locations/or/mt-hood-meadows?format=capnp'
//   cargo run --release -- forecast.bin
//
// Values are in the request's `units`. Read `units` only when `hasUnits`
// is true: the `Units` enum's zero value is `imperial`, while the REST
// default is metric, so an unset field would otherwise be misread.

use std::io::Read;

pub mod ourea_capnp {
    include!(concat!(env!("OUT_DIR"), "/ourea_capnp.rs"));
}
use ourea_capnp::{forecast_response, Units};

fn rfc3339(unix: i64) -> String {
    // Civil-from-days (H. Hinnant), so the example needs no date crate.
    let days = unix.div_euclid(86_400);
    let secs = unix.rem_euclid(86_400);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
        secs / 3600,
        secs % 3600 / 60,
        secs % 60
    )
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut bytes = Vec::new();
    match std::env::args().nth(1) {
        Some(path) => bytes = std::fs::read(path)?,
        None => {
            std::io::stdin().read_to_end(&mut bytes)?;
        }
    }
    let message = capnp::serialize::read_message_from_flat_slice(
        &mut bytes.as_slice(),
        capnp::message::ReaderOptions::new(),
    )?;
    let r = message.get_root::<forecast_response::Reader>()?;

    let loc = r.get_location()?;
    println!(
        "location: {} ({}, {}) {}",
        loc.get_name()?.to_str()?,
        loc.get_slug()?.to_str()?,
        loc.get_state()?.to_str()?,
        loc.get_timezone()?.to_str()?
    );
    let run = r.get_model_run()?;
    println!("initialized_at: {}", rfc3339(run.get_initialized_at()));
    println!("members: {}", run.get_total_members());

    let units = if r.get_has_units() {
        match r.get_units() {
            Ok(Units::Metric) => "metric",
            Ok(Units::Imperial) => "imperial",
            Ok(Units::Kelvin) => "kelvin",
            Err(_) => "unknown", // an enumerant newer than this schema
        }
    } else {
        "unknown"
    };
    println!("units: {units}");

    let series = r.get_forecast()?.get_timeseries()?;
    if !series.is_empty() {
        let first = series.get(0);
        let t = first.get_ensemble()?.get_temperature()?;
        println!(
            "first_hour: {} temperature p10={:.1} p50={:.1} p90={:.1}",
            rfc3339(first.get_valid_time()),
            t.get_p10(),
            t.get_p50(),
            t.get_p90()
        );
    }
    println!("hours: {}", series.len());
    println!("probabilities: {}", r.get_probabilities()?.len());
    Ok(())
}

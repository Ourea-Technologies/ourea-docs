// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Decode an Ourea forecast served with `?format=capnp`, using the reference
// C++ implementation (https://capnproto.org). The body is one standard
// (unpacked, `capnp::serialize` framing) message whose root is
// `ForecastResponse` in https://docs.oureawx.com/schema/v1/ourea.capnp:
//
//   curl -sS --compressed -o forecast.bin \
//     'https://api.oureawx.com/api/v1/locations/or/mt-hood-meadows?format=capnp'
//   ./build.sh && build/decode_forecast forecast.bin
//
// Values are in the request's `units`. Read `units` only when `hasUnits`
// is true: the `Units` enum's zero value is `imperial`, while the REST
// default is metric, so an unset field would otherwise be misread.

#include <capnp/serialize.h>
#include <kj/array.h>
#include <kj/io.h>

#include <cstdio>
#include <ctime>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>
#include <vector>

#include "ourea.capnp.h"

static std::string rfc3339(int64_t unix_seconds) {
  std::time_t t = static_cast<std::time_t>(unix_seconds);
  std::tm tm{};
  gmtime_r(&t, &tm);
  char buf[32];
  std::strftime(buf, sizeof buf, "%Y-%m-%dT%H:%M:%SZ", &tm);
  return buf;
}

static const char* unitsName(ourea::ForecastResponse::Reader r) {
  if (!r.getHasUnits()) return "unknown";
  switch (r.getUnits()) {
    case ourea::Units::METRIC: return "metric";
    case ourea::Units::IMPERIAL: return "imperial";
    case ourea::Units::KELVIN: return "kelvin";
  }
  return "unknown";  // an enumerant newer than this schema
}

int main(int argc, char** argv) {
  std::vector<char> bytes;
  if (argc > 1) {
    std::ifstream in(argv[1], std::ios::binary);
    if (!in) { std::cerr << "cannot open " << argv[1] << "\n"; return 1; }
    bytes.assign(std::istreambuf_iterator<char>(in), {});
  } else {
    bytes.assign(std::istreambuf_iterator<char>(std::cin), {});
  }
  // FlatArrayMessageReader needs word-aligned memory: copy into words.
  kj::Array<capnp::word> words = kj::heapArray<capnp::word>(bytes.size() / sizeof(capnp::word));
  memcpy(words.begin(), bytes.data(), words.size() * sizeof(capnp::word));

  capnp::ReaderOptions options;
  options.traversalLimitInWords = 1ull << 30;  // large plumes are large messages
  capnp::FlatArrayMessageReader message(words, options);
  auto r = message.getRoot<ourea::ForecastResponse>();

  auto loc = r.getLocation();
  std::printf("location: %s (%s, %s) %s\n", loc.getName().cStr(), loc.getSlug().cStr(),
              loc.getState().cStr(), loc.getTimezone().cStr());
  auto run = r.getModelRun();
  std::printf("initialized_at: %s\n", rfc3339(run.getInitializedAt()).c_str());
  std::printf("members: %u\n", run.getTotalMembers());
  std::printf("units: %s\n", unitsName(r));

  auto series = r.getForecast().getTimeseries();
  if (series.size() > 0) {
    auto first = series[0];
    auto t = first.getEnsemble().getTemperature();
    std::printf("first_hour: %s temperature p10=%.1f p50=%.1f p90=%.1f\n",
                rfc3339(first.getValidTime()).c_str(), t.getP10(), t.getP50(), t.getP90());
  }
  std::printf("hours: %u\n", series.size());
  std::printf("probabilities: %u\n", r.getProbabilities().size());
  return 0;
}

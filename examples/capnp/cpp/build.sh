#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Build the C++ decoder: generate the bindings from the published schema,
# then compile against the system Cap'n Proto library (capnp-rpc: the schema
# also declares the WeatherService interface, whose generated stubs need it)
# (brew install capnp / apt install capnproto libcapnp-dev).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
schema_dir="$here/../../../public/schema/v1"
out="$here/build"
mkdir -p "$out"
capnp compile --src-prefix="$schema_dir" -oc++:"$out" "$schema_dir/ourea.capnp"
${CXX:-c++} -std=c++20 -O2 -I"$out" \
  "$here/decode_forecast.c++" "$out/ourea.capnp.c++" \
  $(pkg-config --cflags --libs capnp-rpc) \
  -o "$out/decode_forecast"

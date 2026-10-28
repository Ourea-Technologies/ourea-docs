#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Generate Java bindings for the published schema with capnpc-java, the code
# generator of capnproto-java, which has no prebuilt release: this builds it
# from the pinned release tag's single C++ source against the system Cap'n
# Proto library (Homebrew `capnp`, or Debian/Ubuntu `libcapnp-dev`).
# Set CAPNPC_JAVA to an existing capnpc-java binary to skip the build.
#
# capnpc-java needs `$Java.package` / `$Java.outerClassname` annotations, which
# the published schema does not carry, so this annotates a COPY under build/.
# capnpc-java does not implement interfaces, so the copy also leaves out the
# schema's RPC `interface` blocks; no struct depends on them, and the wire
# format of every struct is unchanged.
set -euo pipefail
CAPNP_JAVA_TAG=v0.1.16   # keep in step with org.capnproto:runtime in build.gradle.kts
here="$(cd "$(dirname "$0")" && pwd)"
cd "$here"
mkdir -p build/tools build/schema build/generated/java

if [ ! -d build/tools/capnproto-java ]; then
  git clone --quiet --depth 1 --branch "$CAPNP_JAVA_TAG" https://github.com/capnproto/capnproto-java build/tools/capnproto-java
fi
compiler="${CAPNPC_JAVA:-$here/build/tools/capnpc-java}"
if [ ! -x "$compiler" ]; then
  # shellcheck disable=SC2046
  c++ -std=c++20 -O1 build/tools/capnproto-java/compiler/src/main/cpp/capnpc-java.c++ \
    $(pkg-config --cflags --libs capnp) -o build/tools/capnpc-java
fi

{
  head -n 1 ../../../public/schema/v1/ourea.capnp
  echo 'using Java = import "/capnp/java.capnp";'
  echo '$Java.package("com.oureawx.examples.capnp");'
  echo '$Java.outerClassname("Ourea");'
  tail -n +2 ../../../public/schema/v1/ourea.capnp |
    awk '/^interface [A-Za-z0-9_]+ *\{/ { skip = 1 } !skip { print } skip && /^\}/ { skip = 0 }'
} > build/schema/ourea.capnp
# ourea.capnp imports go.capnp (Go-only annotations) from its own directory.
cp ../../../public/schema/v1/go.capnp build/schema/go.capnp

capnp compile -I build/tools/capnproto-java/compiler/src/main/schema \
  --src-prefix=build/schema -o "$compiler:build/generated/java" build/schema/ourea.capnp

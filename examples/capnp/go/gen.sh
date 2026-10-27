#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Generate Go bindings for the published schema with capnpc-go (go-capnp v3).
# capnpc-go needs `$Go.package` / `$Go.import` annotations, which the published
# schema does not carry, so this annotates a COPY under build/ (gitignored) and
# generates build/ourea from it. Needs the `capnp` tool on PATH.
#
# The schema marks optional fields with a sibling bool (`hasFoo` beside
# `foo`). capnpc-go also generates `HasFoo()` for every pointer field `foo`,
# so the two collide; the copy renames each sibling bool's Go accessor with
# `$Go.name("hasFooFlag")` (`HasFooFlag()` in Go). The wire format is unchanged:
# it keys on ordinals, never names.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cd "$here"
version="$(go list -m -f '{{.Version}}' capnproto.org/go/capnp/v3)"
go mod download capnproto.org/go/capnp/v3
std="$(go list -m -f '{{.Dir}}' capnproto.org/go/capnp/v3)/std"
mkdir -p build/bin build/schema build/ourea
GOBIN="$here/build/bin" go install "capnproto.org/go/capnp/v3/capnpc-go@$version"
{
  head -n 1 ../../../public/schema/v1/ourea.capnp
  echo 'using Go = import "/go.capnp";'
  echo '$Go.package("ourea");'
  echo '$Go.import("oureawx.com/docs/examples/capnp/go/build/ourea");'
  tail -n +2 ../../../public/schema/v1/ourea.capnp |
    sed -E 's/^([[:space:]]*)(has[A-Z][A-Za-z0-9]*)([[:space:]]+@[0-9]+[[:space:]]*:Bool)[[:space:]]*;/\1\2\3 $Go.name("\2Flag");/'
} > build/schema/ourea.capnp
capnp compile -I"$std" --src-prefix=build/schema -o"$here/build/bin/capnpc-go:build/ourea" build/schema/ourea.capnp

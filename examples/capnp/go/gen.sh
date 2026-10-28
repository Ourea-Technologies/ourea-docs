#!/usr/bin/env bash
# SPDX-License-Identifier: BSD-2-Clause
# Copyright (c) 2026 Ourea Technologies
#
# Generate Go bindings for the published schema with capnpc-go (go-capnp v3).
# The schema already imports go.capnp (published beside it) and names every
# sibling presence flag `hasFoo` `$Go.name("hasFooFlag")` (`HasFooFlag()` in
# Go), so it does not collide with capnpc-go's `HasFoo()` for the pointer
# field `foo`. capnpc-go also needs the file annotations `$Go.package` /
# `$Go.import`, which only a reader can choose, so this adds them to a COPY
# under build/ (gitignored) and generates build/ourea from it. Needs the
# `capnp` tool on PATH.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cd "$here"
version="$(go list -m -f '{{.Version}}' capnproto.org/go/capnp/v3)"
go mod download capnproto.org/go/capnp/v3
mkdir -p build/bin build/schema build/ourea
GOBIN="$here/build/bin" go install "capnproto.org/go/capnp/v3/capnpc-go@$version"
{
  head -n 1 ../../../public/schema/v1/ourea.capnp
  echo '$Go.package("ourea");'
  echo '$Go.import("oureawx.com/docs/examples/capnp/go/build/ourea");'
  tail -n +2 ../../../public/schema/v1/ourea.capnp
} > build/schema/ourea.capnp
cp ../../../public/schema/v1/go.capnp build/schema/go.capnp
capnp compile --src-prefix=build/schema -o"$here/build/bin/capnpc-go:build/ourea" build/schema/ourea.capnp

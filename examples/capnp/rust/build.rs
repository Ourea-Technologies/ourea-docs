// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// Generates Rust bindings for the published schema at build time.
// Needs the `capnp` compiler on PATH (brew install capnp / apt install capnproto).
fn main() {
    capnpc::CompilerCommand::new()
        .src_prefix("../../../public/schema/v1")
        .file("../../../public/schema/v1/ourea.capnp")
        .run()
        .expect("compiling ourea.capnp (is the capnp tool installed?)");
    println!("cargo:rerun-if-changed=../../../public/schema/v1/ourea.capnp");
}

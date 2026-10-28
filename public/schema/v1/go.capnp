# Vendored, unchanged below this header, from go-capnp (capnproto.org/go/capnp/v3
# std/go.capnp, v3.1.0-alpha.2; MIT licence, Copyright (C) 2014 the
# go-capnproto authors and contributors). schema/ourea.capnp imports it for
# the `$Go.name` annotations that keep Go's generated accessors from
# colliding; only Go's code generator reads them. Keep it beside ourea.capnp.

@0xd12a1c51fedd6c88;

annotation package(file) :Text;
# The Go package name for the generated file.

annotation import(file) :Text;
# The Go import path that the generated file is accessible from.
# Used to generate import statements and check if two types are in the
# same package.

annotation doc(struct, field, enum) :Text;
# Adds a doc comment to the generated code.

annotation tag(enumerant) :Text;
# Changes the string representation of the enum in the generated code.

annotation notag(enumerant) :Void;
# Removes the string representation of the enum in the generated code.

annotation customtype(field) :Text;
# OBSOLETE, not used by code generator.

annotation name(struct, field, union, enum, enumerant, interface, method, param, annotation, const, group) :Text;
# Used to rename the element in the generated code.

$package("gocp");
$import("capnproto.org/go/capnp/v3/std/go");

#!/bin/sh
# Builds src/lib/audio/fastenhancer.wasm (the Rust engine in src/lib.rs) and
# src/lib/audio/fastenhancer_b.bin / fastenhancer_t.bin (the Base and Tiny
# models' weights, packed by pack.py from the released spec2spec ONNX files,
# checked against pinned SHA-256s). Needs cargo with the
# wasm32-unknown-unknown target, python with onnx, numpy and protobuf (set
# PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python if protobuf complains).
# Run: scripts/fastenhancer/build.sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
audio=$here/../../src/lib/audio
release=https://github.com/aask1357/fastenhancer/releases/download/onnx-48khz-v1
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
pack() { # size, sha256
    curl -sL -o "$tmp/$1.onnx" "$release/fastenhancer_$1_spec.onnx"
    echo "$2  $tmp/$1.onnx" | sha256sum -c -
    PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=${PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION:-python} \
        python "$here/pack.py" "$tmp/$1.onnx" "$audio/fastenhancer_$1.bin"
}
pack b 8df7941f5c9c81fdb79ccfeeb427ef7277d68821c1077eb940cc9893c0bbcac7
pack t ebc673b4346ecbb89d2dce13718dbac46db81c57b056e3cb0c79eb767405956a
(cd "$here" && cargo build --release)
cp "$here/target/wasm32-unknown-unknown/release/fastenhancer.wasm" "$audio/fastenhancer.wasm"
ls -l "$audio"/fastenhancer.wasm "$audio"/fastenhancer_b.bin "$audio"/fastenhancer_t.bin

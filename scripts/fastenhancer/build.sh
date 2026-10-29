#!/bin/sh
# Builds src/lib/audio/fastenhancer.wasm (the Rust engine in src/lib.rs) and
# src/lib/audio/fastenhancer_b.bin (the Base model's weights, packed by
# pack.py from the released spec2spec ONNX file, checked against a pinned
# SHA-256). Needs cargo with the wasm32-unknown-unknown target, python with
# onnx, numpy and protobuf (set PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python
# if protobuf complains).
# Run: scripts/fastenhancer/build.sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
audio=$here/../../src/lib/audio
url=https://github.com/aask1357/fastenhancer/releases/download/onnx-48khz-v1/fastenhancer_b_spec.onnx
sha=8df7941f5c9c81fdb79ccfeeb427ef7277d68821c1077eb940cc9893c0bbcac7
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -sL -o "$tmp/b.onnx" "$url"
echo "$sha  $tmp/b.onnx" | sha256sum -c -
PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=${PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION:-python} \
    python "$here/pack.py" "$tmp/b.onnx" "$audio/fastenhancer_b.bin"
(cd "$here" && cargo build --release)
cp "$here/target/wasm32-unknown-unknown/release/fastenhancer.wasm" "$audio/fastenhancer.wasm"
ls -l "$audio"/fastenhancer.wasm "$audio"/fastenhancer_b.bin

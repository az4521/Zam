#!/bin/sh
# Checks ios/App/NotificationService/Megolm.swift against vectors made by the
# real crypto WASM (@matrix-org/matrix-sdk-crypto-wasm): Megolm decryption
# across ratchet rollovers, tampering, late-starting sessions, and the key
# backup round trip. macOS only (swiftc + CryptoKit). Run from anywhere:
#   sh ios/MegolmTests/run.sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../.." && pwd)
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
node "$here/gen-vectors.mjs" "$repo" > "$out/vectors.json"
swiftc -O -o "$out/megolm-tests" "$repo/ios/App/NotificationService/Megolm.swift" "$here/main.swift"
"$out/megolm-tests" "$out/vectors.json"

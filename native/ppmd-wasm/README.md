# PPMd (Ppmd7) WebAssembly codec

Freestanding WebAssembly build of the 7-Zip PPMd variant H encoder and decoder
with the 7z range coder (`Ppmd7z_*`). It produces the same bitstream as the
7-Zip `.7z` PPMd coder and is wrapped by `src/lib/utils/ppmd.ts`.

## Sources

- `vendor/Ppmd.h`, `vendor/Ppmd7.h`, `vendor/Ppmd7.c`, `vendor/Ppmd7Enc.c`,
  `vendor/Ppmd7Dec.c`, `vendor/Precomp.h`, `vendor/7zTypes.h`,
  `vendor/Compiler.h`, `vendor/CpuArch.h`: unmodified copies from the 7-Zip
  LZMA SDK C tree.
- Upstream: https://github.com/ip7z/7zip (snapshot `main`, retrieved
  2026-11-26; `Ppmd7.c` and `Ppmd7Dec.c`/`Ppmd7Enc.c` are dated 2023-09-07,
  `Ppmd.h` 2023-03-05). The official SDK archive (https://www.7-zip.org/sdk.html)
  was not reachable when this was vendored.
- License: public domain. The PPMd model is based on Dmitry Shkarin's
  PPMd var.H (2001), also public domain. The 7-Zip C code is by Igor Pavlov.
- `shim/` (empty `errno.h`, `string.h` declarations) and `ppmd_wasm.c` are
  ours. Our glue provides `memset`, `memcpy`, `memmove` and a bump allocator
  over linear memory.

No vendored file has been edited.

## Interface (exports)

- `ppmd_in_reserve(n) -> ptr`, `ppmd_out_reserve(n) -> ptr`: scratch buffers
  in linear memory (may grow memory; re-create typed-array views afterwards).
- `ppmd_encode(inLen, order, memSize, outCap) -> len | negative`.
- `ppmd_decode(inLen, outSize, order, memSize) -> 0 | negative`: input must be
  consumed exactly and the range coder must finish with `Code == 0`.
- Error codes: see `enum` in `ppmd_wasm.c`.

## Rebuild

Requires Zig 0.17 on PATH. From the repo root:

    npm run build:ppmd-wasm

This runs `zig cc -target wasm32-freestanding -O3 -mbulk-memory -nostdlib`
with `--no-entry --export-memory --gc-sections --strip-all` and writes
`src/lib/utils/ppmd.wasm`, which is committed. The output has no imports.
The module needs WebAssembly bulk-memory (Chrome 75+, Safari 15+).

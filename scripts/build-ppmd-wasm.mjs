// Builds native/ppmd-wasm (7-Zip Ppmd7 + 7z range coder, freestanding) into
// src/lib/utils/ppmd.wasm with Zig's clang driver. The .wasm is committed, so
// only maintainers rebuilding the codec need zig installed.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeDir = join(root, "native", "ppmd-wasm");
const outFile = join(root, "src", "lib", "utils", "ppmd.wasm");

const args = [
    "cc",
    "-target",
    "wasm32-freestanding",
    "-O3",
    "-mbulk-memory",
    "-nostdlib",
    "-Wall",
    "-Wextra",
    "-Wno-unused-parameter",
    "-Ishim",
    "-Ivendor",
    "-Wl,--no-entry",
    "-Wl,--export-memory",
    "-Wl,--gc-sections",
    "-Wl,--strip-all",
    "-o",
    outFile,
    "vendor/Ppmd7.c",
    "vendor/Ppmd7Enc.c",
    "vendor/Ppmd7Dec.c",
    "ppmd_wasm.c",
];

execFileSync("zig", args, { cwd: nativeDir, stdio: "inherit" });

// Sanity check: the module must compile, import nothing, and export the API.
const mod = new WebAssembly.Module(readFileSync(outFile));
const imports = WebAssembly.Module.imports(mod);
const exports = WebAssembly.Module.exports(mod).map((e) => e.name);
for (const name of [
    "ppmd_in_reserve",
    "ppmd_out_reserve",
    "ppmd_encode",
    "ppmd_decode",
    "memory",
]) {
    if (!exports.includes(name))
        throw new Error(`ppmd.wasm is missing export ${name}`);
}
if (imports.length > 0)
    throw new Error(`ppmd.wasm must have no imports, found ${imports.length}`);
console.log(`wrote ${outFile} (${statSync(outFile).size} bytes)`);

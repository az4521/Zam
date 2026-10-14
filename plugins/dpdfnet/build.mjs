// Builds the DPDFNet plugin into a ready-to-publish Zam plugin repo:
//
//   plugins/dist/index.json
//   plugins/dist/plugins/dpdfnet/manifest.json     (every file + SHA-256)
//   plugins/dist/plugins/dpdfnet/main.js           (the plugin bundle)
//   plugins/dist/plugins/dpdfnet/assets/...        (worklet, Worker, model,
//                                                   ONNX Runtime Web)
//   plugins/dist/plugins/dpdfnet/native/...        (desktop: host + native
//                                                   ONNX Runtime per platform;
//                                                   Android: a .dex host + .so
//                                                   files per ABI)
//
// Push the contents of plugins/dist to a GitHub repo and add that repo in
// Zam (Settings > Plugins). usage, from the repo root:
//   node plugins/dpdfnet/build.mjs [--min-app <version>]
// --min-app defaults to the next minor version of Zam (the first with the
// plugin APIs this needs: zam.assets, zam.audio, zam.native).

import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
    SELFTEST_CHECK,
    SELFTEST_FRAMES,
    selftestFrame,
} from "./src/webgpu/selftest.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const nm = join(root, "node_modules");
const repoOut = join(root, "plugins", "dist");
const PLUGIN_ID = "com.zam.dpdfnet";
const out = join(repoOut, "plugins", PLUGIN_ID);
const zam = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const argMin = process.argv.indexOf("--min-app");
const [maj, min] = zam.version.split(".").map(Number);
const minAppVersion =
    argMin > 0 ? process.argv[argMin + 1] : `${maj}.${min + 1}.0`;

const PLUGIN = {
    id: PLUGIN_ID,
    name: "DPDFNet noise filter",
    version: "1.1.0",
    description:
        "Clearer AI noise removal for your microphone in calls (Ceva's DPDFNet-2). Runs on your device; heavier than the built-in DeepFilterNet3, which stands in on devices too slow for it.",
    author: "az4521",
};

// Type-check against Zam's plugin API first (esbuild only strips types).
execFileSync(
    process.execPath,
    [join(nm, "typescript", "bin", "tsc"), "-p", join(here, "tsconfig.json")],
    { stdio: "inherit" },
);

// Ceva's model, from Hugging Face at a pinned revision, checked and cached
// (kept out of Zam's git history).
const MODEL_URL =
    "https://huggingface.co/Ceva-IP/DPDFNet/resolve/dd6818d00f50c836fed43a6243ebe49116de5964/onnx/dpdfnet2_48khz_hr.onnx";
const MODEL_SHA256 =
    "7f0575a5cec0ba4ffd8f8bd657e06d007e4ccdd955d76faab922b9d3291dc14b";
const buildCache = join(nm, ".cache", "zam-plugin-build");
mkdirSync(buildCache, { recursive: true });
async function modelFile() {
    const path = join(buildCache, "dpdfnet2_48khz_hr.onnx");
    const sum = (b) => createHash("sha256").update(b).digest("hex");
    if (existsSync(path) && sum(readFileSync(path)) === MODEL_SHA256)
        return path;
    console.log(`Downloading ${MODEL_URL}`);
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${MODEL_URL}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (sum(bytes) !== MODEL_SHA256)
        throw new Error("DPDFNet model: checksum mismatch");
    writeFileSync(path, bytes);
    return path;
}

rmSync(repoOut, { recursive: true, force: true });
mkdirSync(join(out, "assets"), { recursive: true });

const common = {
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    legalComments: "inline",
    logLevel: "warning",
};
await build({
    ...common,
    entryPoints: [join(here, "src/main.ts")],
    outfile: join(out, "main.js"),
});
await build({
    ...common,
    entryPoints: [join(here, "src/worker.ts")],
    outfile: join(out, "assets/worker.js"),
});

const mkdirOut = (dir) => {
    mkdirSync(dir, { recursive: true });
    return dir;
};
const copy = (from, to) => {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
};
copy(join(here, "src/worklet.js"), join(out, "assets/worklet.js"));
copy(await modelFile(), join(out, "assets/model.onnx"));
copy(join(here, "model/LICENSE"), join(out, "LICENSE-DPDFNet"));
const ortWeb = join(nm, "onnxruntime-web");
for (const f of [
    "ort.wasm.min.mjs",
    "ort-wasm-simd-threaded.mjs",
    "ort-wasm-simd-threaded.wasm",
])
    copy(join(ortWeb, "dist", f), join(out, "assets", f));
copy(join(here, "LICENSE-onnxruntime"), join(out, "LICENSE-onnxruntime"));

// ---- the WebGPU backend's known answer: ONNX Runtime's output for the
// self-test frames (src/webgpu/selftest.js) ----
{
    const ort = createRequire(join(nm, "onnxruntime-node", "package.json"))(
        "onnxruntime-node",
    );
    const init = JSON.parse(
        readFileSync(join(here, "model/dpdfnet2_48khz_hr.init.json"), "utf8"),
    );
    const sess = await ort.InferenceSession.create(await modelFile(), {
        intraOpNumThreads: 1,
    });
    let state = new Float32Array(init.stateSize);
    state.set(init.erbNormInit, 0);
    state.set(init.specNormInit, init.erbNormInit.length);
    const spec = 481 * 2;
    const expected = new Float32Array(SELFTEST_CHECK * spec);
    for (let t = 0; t < SELFTEST_FRAMES; t++) {
        const r = await sess.run({
            spec: new ort.Tensor("float32", selftestFrame(t), [1, 1, 481, 2]),
            state_in: new ort.Tensor("float32", state, [state.length]),
        });
        state = r.state_out.data;
        const k = t - (SELFTEST_FRAMES - SELFTEST_CHECK);
        if (k >= 0) expected.set(r.spec_e.data, k * spec);
    }
    await sess.release?.();
    writeFileSync(
        join(out, "assets/selftest.bin"),
        Buffer.from(expected.buffer),
    );
}

// ---- native: the host plus native ONNX Runtime, per platform ----
const ortNode = join(nm, "onnxruntime-node");
const ortCommon = join(nm, "onnxruntime-common");
const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    );
const nativeOut = join(out, "native");
copy(join(here, "native/host.cjs"), join(nativeOut, "host.cjs"));
// JavaScript ONNX Runtime needs at runtime (no source maps, typings or the
// install-time scripts). Keep nested package.json files: onnxruntime-common
// is "type": "module" at its root and dist/cjs/package.json is what makes
// its CommonJS build load as CommonJS.
const runtimeFile = (f) => f.endsWith(".js") || f.endsWith("package.json");
const jsFiles = [
    join(ortNode, "package.json"),
    ...walk(join(ortNode, "dist")).filter(runtimeFile),
    join(ortCommon, "package.json"),
    ...walk(join(ortCommon, "dist", "cjs")).filter(runtimeFile),
];
for (const f of jsFiles)
    copy(f, join(nativeOut, "node_modules", relative(nm, f)));
// CPU only: skip the DirectML / shader compiler DLLs; macOS links only
// libonnxruntime.1.dylib (the versioned copy is a duplicate).
const SKIP =
    /^(DirectML\.dll|dxcompiler\.dll|dxil\.dll|libonnxruntime\.\d+\.\d+\.\d+\.dylib)$/;
const platforms = {};
const binRoot = join(ortNode, "bin", "napi-v6");
for (const os of readdirSync(binRoot))
    for (const arch of readdirSync(join(binRoot, os))) {
        const bins = readdirSync(join(binRoot, os, arch)).filter(
            (f) => !SKIP.test(f),
        );
        for (const b of bins)
            copy(
                join(binRoot, os, arch, b),
                join(
                    nativeOut,
                    "node_modules",
                    "onnxruntime-node",
                    "bin",
                    "napi-v6",
                    os,
                    arch,
                    b,
                ),
            );
        platforms[`${os}-${arch}`] = {
            host: "native/host.cjs",
            files: [
                "native/host.cjs",
                ...jsFiles.map(
                    (f) =>
                        `native/node_modules/${relative(nm, f).split("\\").join("/")}`,
                ),
                ...bins.map(
                    (b) =>
                        `native/node_modules/onnxruntime-node/bin/napi-v6/${os}/${arch}/${b}`,
                ),
            ],
        };
    }

// ---- Android: native/Host.java + ONNX Runtime's Android package, as one
// .dex per ABI with that ABI's .so files in lib/ next to it ----
const ORT_ANDROID = "1.30.0";
const ORT_AAR_SHA1 = "656d941369b97c730c4dc963799b159667893a45";
const cacheDir = join(nm, ".cache", "zam-plugin-build");
mkdirSync(cacheDir, { recursive: true });
const aarPath = join(cacheDir, `onnxruntime-android-${ORT_ANDROID}.aar`);
const sha1 = (b) => createHash("sha1").update(b).digest("hex");
if (!existsSync(aarPath) || sha1(readFileSync(aarPath)) !== ORT_AAR_SHA1) {
    const url = `https://repo1.maven.org/maven2/com/microsoft/onnxruntime/onnxruntime-android/${ORT_ANDROID}/onnxruntime-android-${ORT_ANDROID}.aar`;
    console.log(`Downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (sha1(bytes) !== ORT_AAR_SHA1)
        throw new Error("onnxruntime-android: checksum mismatch");
    writeFileSync(aarPath, bytes);
}
const AdmZip = createRequire(join(nm, "adm-zip", "package.json"))("adm-zip");
const aar = new AdmZip(aarPath);
const work = join(cacheDir, "android-build");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const ortJar = join(work, "onnxruntime.jar");
writeFileSync(ortJar, aar.getEntry("classes.jar").getData());
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk)
    throw new Error(
        "ANDROID_HOME isn't set (needed to build the Android host)",
    );
const newest = (dir) =>
    readdirSync(dir)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .pop();
const androidJar = join(
    sdk,
    "platforms",
    newest(join(sdk, "platforms")),
    "android.jar",
);
const d8 = join(
    sdk,
    "build-tools",
    newest(join(sdk, "build-tools")),
    process.platform === "win32" ? "d8.bat" : "d8",
);
const javac = process.env.JAVA_HOME
    ? join(process.env.JAVA_HOME, "bin", "javac")
    : "javac";
const sep = process.platform === "win32" ? ";" : ":";
// Zam's two interfaces: compiled only to compile against (the app has them).
const zamApi = join(
    root,
    "android",
    "app",
    "src",
    "main",
    "java",
    "moe",
    "crafty",
    "matrix",
);
const apiOut = join(work, "api");
execFileSync(
    javac,
    [
        "--release",
        "11",
        "-d",
        apiOut,
        join(zamApi, "PluginNativeHost.java"),
        join(zamApi, "PluginNativePort.java"),
        "-cp",
        androidJar,
    ],
    { stdio: "inherit" },
);
const hostOut = join(work, "classes");
const hostSrc = walk(join(here, "native", "android", "src")).filter((f) =>
    f.endsWith(".java"),
);
execFileSync(
    javac,
    [
        "--release",
        "11",
        "-d",
        hostOut,
        ...hostSrc,
        "-cp",
        [androidJar, ortJar, apiOut].join(sep),
    ],
    { stdio: "inherit" },
);
const dexOut = join(work, "dex");
mkdirSync(dexOut, { recursive: true });
execFileSync(
    d8,
    [
        "--release",
        "--min-api",
        "24",
        "--lib",
        androidJar,
        "--output",
        dexOut,
        ...walk(hostOut).filter((f) => f.endsWith(".class")),
        ortJar,
    ],
    { stdio: "inherit", shell: process.platform === "win32" },
);
const ABI = {
    "arm64-v8a": "arm64",
    "armeabi-v7a": "arm",
    x86_64: "x64",
    x86: "ia32",
};
for (const [abi, arch] of Object.entries(ABI)) {
    const key = `android-${arch}`;
    const libs = aar
        .getEntries()
        .filter(
            (e) =>
                e.entryName.startsWith(`jni/${abi}/`) &&
                e.entryName.endsWith(".so"),
        );
    if (libs.length === 0) continue;
    const base = `native/${key}`;
    copy(join(dexOut, "classes.dex"), join(out, base, "host.dex"));
    for (const e of libs)
        writeFileSync(
            join(mkdirOut(join(out, base, "lib")), e.name),
            e.getData(),
        );
    platforms[key] = {
        host: `${base}/host.dex`,
        entry: "zam.plugins.dpdfnet.Host",
        files: [
            `${base}/host.dex`,
            ...libs.map((e) => `${base}/lib/${e.name}`),
        ],
    };
}

// ---- manifest: every file with its size and SHA-256 ----
const describe = (rel) => {
    const bytes = readFileSync(join(out, rel));
    const size = statSync(join(out, rel)).size;
    if (size > 100 * 1024 * 1024)
        throw new Error(`${rel} is over GitHub's 100 MB file limit`);
    return {
        path: rel,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        size,
    };
};
const manifest = {
    ...PLUGIN,
    entry: "main.js",
    minAppVersion,
    capabilities: ["audio", "native", "storage"],
    assets: [
        "assets/worklet.js",
        "assets/worker.js",
        "assets/model.onnx",
        "assets/ort.wasm.min.mjs",
        "assets/ort-wasm-simd-threaded.mjs",
        "assets/ort-wasm-simd-threaded.wasm",
        "assets/selftest.bin",
    ].map(describe),
    native: {
        platforms: Object.fromEntries(
            Object.entries(platforms).map(([k, p]) => [
                k,
                { ...p, files: p.files.map(describe) },
            ]),
        ),
    },
};
writeFileSync(
    join(out, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
);
writeFileSync(
    join(repoOut, "index.json"),
    JSON.stringify(
        { schema: 1, plugins: [{ ...PLUGIN, path: `plugins/${PLUGIN_ID}` }] },
        null,
        2,
    ) + "\n",
);
copy(join(here, "README.md"), join(out, "README.md"));

const mb = (files) => (files.reduce((s, f) => s + f.size, 0) / 1e6).toFixed(1);
console.log(
    `Built ${PLUGIN.id} ${PLUGIN.version} (min app ${minAppVersion}) in ${relative(root, repoOut)}`,
);
console.log(`  assets ${mb(manifest.assets)} MB`);
for (const [k, p] of Object.entries(manifest.native.platforms))
    console.log(`  native ${k}: ${mb(p.files)} MB, ${p.files.length} files`);

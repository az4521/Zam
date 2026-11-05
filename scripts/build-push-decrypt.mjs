/**
 * Bundle the no-app-running push decryptor (src/lib/pushDecryptHeadless.ts)
 * into build/push-decrypt/, after `vite build`:
 *
 *   decrypt.js   - classic script defining self.pushDecryptHeadless, loaded by
 *                  static/sw.js with importScripts()
 *   index.html   - the page MatrixMessagingService.java loads into a hidden
 *                  WebView on Android; it talks to Java through the
 *                  PushDecryptHost JavaScript interface
 *
 * A separate bundle because the service worker cannot import the app's ES
 * modules, and neither surface should load the whole app to decrypt one event.
 *
 * The crypto WASM is NOT copied here: it is ~8 MB and Vite already emits it
 * under _app/immutable/assets/. decrypt.js carries that path as
 * pushDecryptHeadless.wasmPath, so every install ships one copy.
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = join(root, "build", "push-decrypt");
mkdirSync(outDir, { recursive: true });

// The app's copy, as `vite build` hashed it.
const assetsDir = join(root, "build", "_app", "immutable", "assets");
const wasmFiles = readdirSync(assetsDir).filter((f) =>
    /^matrix_sdk_crypto_wasm_bg\.[\w-]+\.wasm$/.test(f),
);
if (wasmFiles.length !== 1) {
    throw new Error(
        `build-push-decrypt: expected one crypto wasm in ${assetsDir}, found ${wasmFiles.length}`,
    );
}
const wasmPath = `/_app/immutable/assets/${wasmFiles[0]}`;

await build({
    entryPoints: [join(root, "src/lib/pushDecryptHeadless.ts")],
    outfile: join(outDir, "decrypt.js"),
    bundle: true,
    format: "iife",
    globalName: "pushDecryptHeadless",
    platform: "browser",
    target: "es2020",
    minify: true,
    // The WASM loader computes a default URL from import.meta.url at load
    // time, which a classic script has no value for. The URL is always passed
    // explicitly, so any valid base will do.
    define: { "import.meta.url": "self.location.href" },
    footer: { js: `pushDecryptHeadless.wasmPath=${JSON.stringify(wasmPath)};` },
    logLevel: "warning",
});

writeFileSync(
    join(outDir, "index.html"),
    `<!doctype html>
<meta charset="utf-8">
<script src="decrypt.js"></script>
<script>
(async () => {
    let result = null;
    try {
        const params = JSON.parse(PushDecryptHost.params());
        params.wasmUrl = new URL(pushDecryptHeadless.wasmPath, location.href).href;
        result = await pushDecryptHeadless.decryptHeadless(params);
    } catch (e) {
        console.info("[push-decrypt] page: " + e);
    }
    PushDecryptHost.done(result ? JSON.stringify(result) : "");
})();
</script>
`,
);

console.log("build-push-decrypt: wrote build/push-decrypt/");

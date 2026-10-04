/**
 * Bundle the no-app-running push decryptor (src/lib/pushDecryptHeadless.ts)
 * into build/push-decrypt/, after `vite build`:
 *
 *   decrypt.js   - classic script defining self.pushDecryptHeadless, loaded by
 *                  static/sw.js with importScripts()
 *   crypto.wasm  - the matrix-sdk-crypto-wasm module it instantiates
 *   index.html   - the page MatrixMessagingService.java loads into a hidden
 *                  WebView on Android; it talks to Java through the
 *                  PushDecryptHost JavaScript interface
 *
 * A separate bundle because the service worker cannot import the app's ES
 * modules, and neither surface should load the whole app to decrypt one event.
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = join(root, "build", "push-decrypt");
mkdirSync(outDir, { recursive: true });

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
    logLevel: "warning",
});

const require = createRequire(import.meta.url);
// The package exports no ./package.json; its entry sits at the package root.
const wasmPkg = dirname(require.resolve("@matrix-org/matrix-sdk-crypto-wasm"));
copyFileSync(
    join(wasmPkg, "pkg", "matrix_sdk_crypto_wasm_bg.wasm"),
    join(outDir, "crypto.wasm"),
);

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
        params.wasmUrl = new URL("crypto.wasm", location.href).href;
        result = await pushDecryptHeadless.decryptHeadless(params);
    } catch {}
    PushDecryptHost.done(result ? JSON.stringify(result) : "");
})();
</script>
`,
);

console.log("build-push-decrypt: wrote build/push-decrypt/");

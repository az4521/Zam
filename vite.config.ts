import { sveltekit } from "@sveltejs/kit/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import legacy from "@vitejs/plugin-legacy";
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(
    readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
);

export default defineConfig(({ mode }) => ({
    // `npm run dev:https` (--mode https) serves over TLS with a generated
    // self-signed cert. Needed for phone/LAN testing of secure-context APIs
    // (geolocation for live location, clipboard, …) — plain-http origins
    // other than localhost block them. Accept the browser's cert warning
    // once on the device.
    plugins: [
        ...(mode === "https" ? [basicSsl()] : []),
        sveltekit(),
        // matrix-js-sdk builds its keyword push-rule regex with a lookbehind,
        // which throws on Safari < 16.4. It's only ever tested for a match
        // (`!!val.match(regex)`), so consuming the boundary is equivalent.
        // Fails the build if the SDK changes, rather than silently skipping.
        {
            name: "zam:sdk-no-lookbehind",
            transform(code, id) {
                if (!/matrix-js-sdk[\\/]lib[\\/]pushprocessor\.js$/.test(id)) {
                    return null;
                }
                const from = '"(?<=^|\\\\W)"';
                if (!code.includes(from)) {
                    this.error(
                        "zam:sdk-no-lookbehind: pushprocessor.js changed; recheck its lookbehind",
                    );
                }
                return { code: code.replace(from, '"(?:^|\\\\W)"'), map: null };
            },
        },
        // matrix-js-sdk 44 lets only 3 threads fetch their first page at once,
        // across all rooms. A room's threads are all created together (the
        // thread list, a busy room's first sync), so the thread you open could
        // wait behind dozens of others before its panel filled. Lift the cap.
        {
            name: "zam:sdk-thread-fetch-cap",
            transform(code, id) {
                if (
                    !/matrix-js-sdk[\\/]lib[\\/]models[\\/]thread\.js$/.test(id)
                ) {
                    return null;
                }
                const from = "const MAX_CONCURRENT_INITIAL_FETCHES = 3;";
                if (!code.includes(from)) {
                    this.error(
                        "zam:sdk-thread-fetch-cap: thread.js changed; recheck its initial fetch cap",
                    );
                }
                return {
                    code: code.replace(
                        from,
                        "const MAX_CONCURRENT_INITIAL_FETCHES = Infinity;",
                    ),
                    map: null,
                };
            },
        },
        {
            ...legacy({
                targets: ["ios >= 15.8", "> 0.5%", "not dead"],
                renderLegacyChunks: true,
            }),
            apply(config, { isSsrBuild }) {
                return !isSsrBuild;
            },
        },
    ],
    define: {
        // App version (from package.json) exposed to the client bundle.
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    optimizeDeps: {
        // E2EE rust-crypto WASM. The package loads its .wasm via
        // `new URL("./pkg/…_bg.wasm", import.meta.url)`; when Vite pre-bundles
        // the dep with esbuild, that reference resolves into `.vite/deps/pkg/…`
        // which is never emitted there → the fetch 404s and `initRustCrypto`
        // throws "WebAssembly.compile … HTTP status code is not ok". Excluding
        // it routes the package through Vite's normal asset pipeline, which
        // rewrites the URL to the correctly served hashed asset. (Same fix
        // Element Web / matrix-react-sdk use.)
        exclude: ["@matrix-org/matrix-sdk-crypto-wasm"],
    },
    server: {
        host: "0.0.0.0",
        port: 5173,
    },
}));

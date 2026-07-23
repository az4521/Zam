import { sveltekit } from "@sveltejs/kit/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
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
    plugins: [...(mode === "https" ? [basicSsl()] : []), sveltekit()],
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

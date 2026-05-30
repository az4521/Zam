import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(
    readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
);

export default defineConfig({
    plugins: [sveltekit()],
    define: {
        // App version (from package.json) exposed to the client bundle.
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    server: {
        host: "0.0.0.0",
        port: 5173,
    },
});

import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "node:path";

export default defineConfig({
    // The Svelte plugin lets tests import `.svelte.ts` rune modules (stores)
    // and compile `$state`/`$derived`; without it, runes are undefined at
    // runtime and any store import throws.
    plugins: [svelte({ hot: false })],
    test: {
        environment: "jsdom",
        include: ["src/**/*.{test,spec}.{js,ts}"],
    },
    resolve: {
        // Runes modules pull in svelte's client runtime; the browser condition
        // resolves it the same way the app build does.
        conditions: ["browser"],
        alias: {
            $lib: resolve(__dirname, "./src/lib"),
        },
    },
});

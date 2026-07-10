import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
    test: {
        environment: "jsdom",
        include: ["src/**/*.{test,spec}.{js,ts}"],
    },
    resolve: {
        alias: {
            $lib: resolve(__dirname, "./src/lib"),
        },
    },
});

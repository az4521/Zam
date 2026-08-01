import { describe, it, expect } from "vitest";
import {
    extractStartupAssets,
    buildPrecacheManifest,
    precacheVersion,
    SHELL_EXTRA_URLS,
    MAX_STARTUP_ASSETS,
} from "./swPrecache";

// A trimmed copy of a real `build/index.html` emitted by adapter-static.
const HTML = `<!doctype html>
<html lang="en">
<head>
<link rel="icon" href="/favicon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
<link href="/_app/immutable/entry/start.vIgh-Gbe.js" rel="modulepreload">
<link href="/_app/immutable/chunks/CazlH01L.js" rel="modulepreload">
<link href="/_app/immutable/entry/app.CpkcrxVc.js" rel="modulepreload">
<link href="/_app/immutable/nodes/0.f7zDy0xc.js" rel="modulepreload">
<link href="/_app/immutable/assets/0.Cyikkxvy.css" rel="stylesheet">
</head>
<body>
<script>
Promise.all([
    import("/_app/immutable/entry/start.vIgh-Gbe.js"),
    import("/_app/immutable/entry/app.CpkcrxVc.js")
]).then(([kit, app]) => { kit.start(app, element); });
</script>
</body>
</html>`;

describe("extractStartupAssets", () => {
    it("pulls every /_app/immutable js and css referenced by the shell", () => {
        expect(extractStartupAssets(HTML)).toEqual([
            "/_app/immutable/assets/0.Cyikkxvy.css",
            "/_app/immutable/chunks/CazlH01L.js",
            "/_app/immutable/entry/app.CpkcrxVc.js",
            "/_app/immutable/entry/start.vIgh-Gbe.js",
            "/_app/immutable/nodes/0.f7zDy0xc.js",
        ]);
    });

    it("deduplicates the modulepreload and the inline import() of the same chunk", () => {
        const urls = extractStartupAssets(HTML);
        expect(new Set(urls).size).toBe(urls.length);
    });

    it("ignores assets that are not js or css (the 5.5 MB crypto wasm is NOT startup)", () => {
        const html = `<link href="/_app/immutable/assets/matrix_sdk_crypto_wasm_bg.DwIieW7K.wasm" rel="preload">`;
        expect(extractStartupAssets(html)).toEqual([]);
    });

    it("ignores anything outside /_app/immutable/", () => {
        const html = `<script src="/twemoji/1f600.svg.js"></script><link href="/_app/version.json">`;
        expect(extractStartupAssets(html)).toEqual([]);
    });

    it("does not match a same-prefixed decoy directory", () => {
        const html = `<link href="/_app/immutableX/evil.js" rel="modulepreload">`;
        expect(extractStartupAssets(html)).toEqual([]);
    });

    it("returns [] for html with no assets at all", () => {
        expect(extractStartupAssets("<html></html>")).toEqual([]);
    });
});

/** `count` distinct startup assets, referenced the way index.html does it. */
function htmlWithAssets(count: number): string {
    return Array.from(
        { length: count },
        (_, i) =>
            `<link href="/_app/immutable/chunks/c${i}.js" rel="modulepreload">`,
    ).join("\n");
}

describe("buildPrecacheManifest", () => {
    it("is the shell extras plus the startup assets, deduped and sorted", () => {
        const manifest = buildPrecacheManifest(HTML);
        for (const extra of SHELL_EXTRA_URLS) expect(manifest).toContain(extra);
        expect(manifest).toContain("/_app/immutable/entry/app.CpkcrxVc.js");
        expect(new Set(manifest).size).toBe(manifest.length);
        expect([...manifest].sort()).toEqual(manifest);
    });

    it("includes the navigation fallback document under both keys", () => {
        const manifest = buildPrecacheManifest(HTML);
        expect(manifest).toContain("/");
        expect(manifest).toContain("/index.html");
    });

    // The bound is asserted against LITERALS, deliberately. Phrased as
    // `MAX_STARTUP_ASSETS + 1` the assertion moves with the constant, so
    // raising the ceiling to 6000 — or flipping the `>` in the guard to `>=`
    // — kept the whole suite green while the precache stopped being bounded
    // in any meaningful sense (rubric item 8: that must FAIL a test).
    it("pins the bound to 60, so a raised ceiling cannot pass silently", () => {
        expect(MAX_STARTUP_ASSETS).toBe(60);
    });

    it("accepts exactly 60 startup assets", () => {
        expect(() => buildPrecacheManifest(htmlWithAssets(60))).not.toThrow();
    });

    it("throws at 61 startup assets (a windowing regression)", () => {
        expect(() => buildPrecacheManifest(htmlWithAssets(61))).toThrow(
            /bound/i,
        );
    });

    it("throws when the html references no build assets at all", () => {
        expect(() => buildPrecacheManifest("<html></html>")).toThrow(
            /no .*assets/i,
        );
    });
});

describe("precacheVersion", () => {
    it("is stable for the same inputs", () => {
        expect(precacheVersion("0.11.7", ["/a.js", "/b.js"])).toBe(
            precacheVersion("0.11.7", ["/a.js", "/b.js"]),
        );
    });

    it("changes when any asset hash changes (this is what re-installs the worker)", () => {
        expect(precacheVersion("0.11.7", ["/a.js"])).not.toBe(
            precacheVersion("0.11.7", ["/b.js"]),
        );
    });

    it("changes when the app version changes even if the assets did not", () => {
        expect(precacheVersion("0.11.7", ["/a.js"])).not.toBe(
            precacheVersion("0.11.8", ["/a.js"]),
        );
    });

    it("starts with the app version and contains no characters that need escaping", () => {
        const v = precacheVersion("0.11.7", ["/a.js"]);
        expect(v.startsWith("0.11.7-")).toBe(true);
        expect(v).toMatch(/^[A-Za-z0-9.\-]+$/);
    });
});

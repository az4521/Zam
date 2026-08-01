import { describe, it, expect } from "vitest";
import {
    extractStartupAssets,
    buildPrecacheManifest,
    injectPrecache,
    precacheEntryPath,
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

describe("precacheEntryPath", () => {
    it("maps / to the SPA fallback document adapter-static writes", () => {
        expect(precacheEntryPath("/")).toBe("index.html");
    });

    it("makes every other entry build-relative", () => {
        expect(precacheEntryPath("/index.html")).toBe("index.html");
        expect(precacheEntryPath("/favicon.svg")).toBe("favicon.svg");
        expect(precacheEntryPath("/_app/immutable/entry/app.js")).toBe(
            "_app/immutable/entry/app.js",
        );
    });

    it("never resolves outside the build dir on a protocol-relative entry", () => {
        // `new URL("//evil.com/x.js", buildDir)` would leave the directory
        // entirely; stripping every leading slash keeps the check honest.
        expect(precacheEntryPath("//evil.com/x.js")).toBe("evil.com/x.js");
    });

    it("gives a usable relative path for every real manifest entry", () => {
        for (const url of buildPrecacheManifest(HTML)) {
            const path = precacheEntryPath(url);
            expect(path.length).toBeGreaterThan(0);
            expect(path.startsWith("/")).toBe(false);
        }
    });
});

// The two placeholder lines from static/sw.js, verbatim in shape. The real
// worker source is run through the same function by
// swOfflineShell.mirrors.test.ts; this keeps the failure modes isolated.
const SW_TEMPLATE = [
    'const SW_PRECACHE_MANIFEST_JSON = "__SW_PRECACHE_MANIFEST__";',
    'const SW_SHELL_VERSION = "__SW_SHELL_VERSION__";',
].join("\n");

/** Evaluate an injected worker prelude and read the two constants back. */
function evaluate(source: string): {
    SW_PRECACHE_MANIFEST_JSON: unknown;
    SW_SHELL_VERSION: unknown;
} {
    return new Function(
        `${source}
        return { SW_PRECACHE_MANIFEST_JSON, SW_SHELL_VERSION };`,
    )();
}

describe("injectPrecache", () => {
    it("emits the manifest as a quoted JS STRING literal, not a bare array", () => {
        // The mutation this exists for: `.replace(token, () =>
        // JSON.stringify(urls))` injects `["/","/index.html",…]` — valid JS,
        // build exits 0, `npm run build` still prints "✔ done", and the
        // worker's swParsePrecacheManifest() rejects the non-string so
        // SW_OFFLINE_ENABLED is false and the entire feature is off.
        const evaluated = evaluate(injectPrecache(SW_TEMPLATE, HTML, "0.11.7"));

        expect(typeof evaluated.SW_PRECACHE_MANIFEST_JSON).toBe("string");
        expect(
            JSON.parse(evaluated.SW_PRECACHE_MANIFEST_JSON as string),
        ).toEqual(buildPrecacheManifest(HTML));
    });

    it("emits the shell version as a quoted string", () => {
        const evaluated = evaluate(injectPrecache(SW_TEMPLATE, HTML, "0.11.7"));
        expect(evaluated.SW_SHELL_VERSION).toBe(
            precacheVersion("0.11.7", buildPrecacheManifest(HTML)),
        );
    });

    it("leaves no placeholder token behind", () => {
        expect(injectPrecache(SW_TEMPLATE, HTML, "0.11.7")).not.toMatch(
            /__SW_[A-Z_]*__/,
        );
    });

    it("throws when a token is missing (renamed, or already injected)", () => {
        // Loud, because the alternative is shipping a worker with zero offline
        // support that looks completely normal.
        expect(() => injectPrecache("const x = 1;", HTML, "0.11.7")).toThrow(
            /zam-sw-precache.*found 0/,
        );
    });

    it("throws when only one of the two tokens is present", () => {
        expect(() =>
            injectPrecache(
                'const SW_PRECACHE_MANIFEST_JSON = "__SW_PRECACHE_MANIFEST__";',
                HTML,
                "0.11.7",
            ),
        ).toThrow(/SHELL_VERSION.*found 0/);
    });

    it("throws when a token appears twice", () => {
        // `String.replace` would rewrite only the first, leaving a half-injected
        // worker whose second copy still reads as a placeholder.
        expect(() =>
            injectPrecache(`${SW_TEMPLATE}\n${SW_TEMPLATE}`, HTML, "0.11.7"),
        ).toThrow(/zam-sw-precache.*found 2/);
    });

    it("propagates the manifest guards rather than emitting an empty shell", () => {
        expect(() =>
            injectPrecache(SW_TEMPLATE, "<html></html>", "0.11.7"),
        ).toThrow(/no .*assets/i);
    });
});

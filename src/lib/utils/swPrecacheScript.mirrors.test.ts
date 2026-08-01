import { describe, it, expect } from "vitest";
import * as ts from "./swPrecache";
import * as mjs from "../../../scripts/sw-precache-lib.mjs";

/**
 * The injection has to run after adapter-static has written `build/`, which a
 * Vite plugin cannot do (a plugin's first `closeBundle` firing predates the
 * adapter), so it runs as `node scripts/sw-precache.mjs` — and node cannot
 * import TypeScript. `scripts/sw-precache-lib.mjs` is therefore a hand copy of
 * `swPrecache.ts`, and a hand copy rots silently: the TS one is unit-tested and
 * looks healthy while the copy that ACTUALLY runs at build time drifts.
 *
 * So this file executes both modules over one case table and compares outputs.
 * Every assertion is a comparison, never a literal expectation, so it stays
 * meaningful no matter how the shared behaviour changes — mutate either copy
 * (drop `.css` from the asset regex, change the FNV offset, raise the bound,
 * add a shell extra) and these fail.
 */

// A trimmed copy of a real `build/index.html` emitted by adapter-static, plus
// the hostile / bounded cases the pair must agree on.
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

/** `count` distinct startup assets, referenced the way index.html does it. */
function htmlWithAssets(count: number): string {
    return Array.from(
        { length: count },
        (_, i) =>
            `<link href="/_app/immutable/chunks/c${i}.js" rel="modulepreload">`,
    ).join("\n");
}

/** The heavy assets that must never be pulled into a bounded precache. */
const HEAVY_HTML = `
<link rel="preload" href="/_app/immutable/assets/matrix_sdk_crypto_wasm_bg.DwIieW7K.wasm" as="fetch">
<link rel="preload" href="/twemoji/1f600.svg" as="image">
<script src="/ruffle/ruffle.js"></script>
<link href="/_app/immutableX/evil.js" rel="modulepreload">
<link href="//evil.com/_app/immutable/chunks/x.js" rel="modulepreload">
${HTML}`;

const HTML_CASES: Array<[string, string]> = [
    ["the real shell document", HTML],
    ["heavy + hostile references alongside the shell", HEAVY_HTML],
    ["exactly at the bound", htmlWithAssets(ts.MAX_STARTUP_ASSETS)],
    ["one over the bound", htmlWithAssets(ts.MAX_STARTUP_ASSETS + 1)],
    ["no build assets at all", "<html></html>"],
    ["empty string", ""],
];

describe("scripts/sw-precache-lib.mjs mirrors src/lib/utils/swPrecache.ts", () => {
    it("exports the same tokens", () => {
        expect(mjs.PRECACHE_MANIFEST_TOKEN).toBe(ts.PRECACHE_MANIFEST_TOKEN);
        expect(mjs.SHELL_VERSION_TOKEN).toBe(ts.SHELL_VERSION_TOKEN);
    });

    it("exports the same bound and shell extras", () => {
        expect(mjs.MAX_STARTUP_ASSETS).toBe(ts.MAX_STARTUP_ASSETS);
        expect([...mjs.SHELL_EXTRA_URLS]).toEqual([...ts.SHELL_EXTRA_URLS]);
    });

    it.each(HTML_CASES)("extractStartupAssets agrees on %s", (_name, html) => {
        expect(mjs.extractStartupAssets(html)).toEqual(
            ts.extractStartupAssets(html),
        );
    });

    it.each(HTML_CASES)("buildPrecacheManifest agrees on %s", (_name, html) => {
        const run = (fn: (h: string) => string[]) => {
            try {
                return { ok: true as const, value: fn(html) };
            } catch (e) {
                return { ok: false as const, message: (e as Error).message };
            }
        };
        expect(run(mjs.buildPrecacheManifest)).toEqual(
            run(ts.buildPrecacheManifest),
        );
    });

    it("agrees on the version digest, including that it moves with the inputs", () => {
        const cases: Array<[string, string[]]> = [
            ["0.11.7", ["/", "/index.html", "/_app/immutable/entry/a.js"]],
            ["0.11.8", ["/", "/index.html", "/_app/immutable/entry/a.js"]],
            ["0.11.7", ["/", "/index.html", "/_app/immutable/entry/b.js"]],
            ["0.11.7", []],
            ["v1.2.3-beta+meta/../", ["/a.js"]],
        ];
        const digests = cases.map(([v, urls]) => {
            const fromMjs = mjs.precacheVersion(v, urls);
            expect(fromMjs).toBe(ts.precacheVersion(v, urls));
            return fromMjs;
        });
        // The first three differ only in version / asset hash; if the copy ever
        // degenerated into a constant, the agreement above would still pass.
        expect(new Set(digests.slice(0, 3)).size).toBe(3);
    });

    it("keeps the runtime copy's precache bounded to the startup set", () => {
        const manifest = mjs.buildPrecacheManifest(HEAVY_HTML);
        expect(manifest.join("\n")).not.toMatch(/wasm|twemoji|ruffle/);
        // Nothing cross-origin or from a same-prefixed decoy directory either.
        expect(manifest.every((u) => u.startsWith("/"))).toBe(true);
        expect(manifest.some((u) => u.startsWith("//"))).toBe(false);
        expect(manifest.join("\n")).not.toMatch(/immutableX/);
    });
});

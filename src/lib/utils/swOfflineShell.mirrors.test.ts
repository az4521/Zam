import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    SHELL_CACHE_PREFIX,
    BUILD_ASSET_PREFIX,
    NAVIGATION_FALLBACK_URL,
} from "./swCacheRouting";
import { CLASSIFY_CASES, MANIFEST_CASES } from "./swCacheRouting.test";
import { PRECACHE_MANIFEST_TOKEN, SHELL_VERSION_TOKEN } from "./swPrecache";

// static/sw.js is hand-written and un-bundled, so it hand-mirrors
// swCacheRouting.ts. Regex-spotting that copy would pass against a worker
// whose logic had been mutated, so this test EXECUTES the mirrored region and
// runs the real case table against it.
// NB: resolve via dirname(), not `new URL("…", import.meta.url)` — Vite
// rewrites that literal pattern into an *asset* reference
// ("http://localhost:3000/static/sw.js") and fileURLToPath then throws
// "The URL must be of scheme file" (same trap as themeParity.test.ts).
const SW_SOURCE = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../static/sw.js"),
    "utf-8",
);

const REGION_START = "// #region mirrored:swCacheRouting";
const REGION_END = "// #endregion mirrored:swCacheRouting";

function mirroredRegion(): string {
    const start = SW_SOURCE.indexOf(REGION_START);
    const end = SW_SOURCE.indexOf(REGION_END);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return SW_SOURCE.slice(start + REGION_START.length, end);
}

const mirrored = new Function(
    `${mirroredRegion()}
    return {
        swClassifyRequest,
        swParsePrecacheManifest,
        swShellCacheName,
        swIsStaleShellCache,
        SW_SHELL_CACHE_PREFIX,
        SW_BUILD_ASSET_PREFIX,
        SW_NAVIGATION_FALLBACK_URL,
    };`,
)() as {
    swClassifyRequest: (input: unknown) => string;
    swParsePrecacheManifest: (raw: unknown) => string[] | null;
    swShellCacheName: (v: string) => string;
    swIsStaleShellCache: (n: unknown, cur: string) => boolean;
    SW_SHELL_CACHE_PREFIX: string;
    SW_BUILD_ASSET_PREFIX: string;
    SW_NAVIGATION_FALLBACK_URL: string;
};

describe("static/sw.js mirrors swCacheRouting.ts", () => {
    it("mirrors the constants", () => {
        expect(mirrored.SW_SHELL_CACHE_PREFIX).toBe(SHELL_CACHE_PREFIX);
        expect(mirrored.SW_BUILD_ASSET_PREFIX).toBe(BUILD_ASSET_PREFIX);
        expect(mirrored.SW_NAVIGATION_FALLBACK_URL).toBe(
            NAVIGATION_FALLBACK_URL,
        );
    });

    for (const c of CLASSIFY_CASES) {
        it(`classifies: ${c.name}`, () => {
            expect(mirrored.swClassifyRequest(c.input)).toBe(c.expected);
        });
    }

    for (const c of MANIFEST_CASES) {
        it(`parses the manifest: ${c.name}`, () => {
            expect(mirrored.swParsePrecacheManifest(c.raw)).toEqual(c.expected);
        });
    }

    it("mirrors the cache-name helpers", () => {
        const current = mirrored.swShellCacheName("0.11.7-new");
        expect(current).toBe(`${SHELL_CACHE_PREFIX}0.11.7-new`);
        expect(
            mirrored.swIsStaleShellCache(`${SHELL_CACHE_PREFIX}old`, current),
        ).toBe(true);
        expect(mirrored.swIsStaleShellCache(current, current)).toBe(false);
        expect(mirrored.swIsStaleShellCache("matrix-sw", current)).toBe(false);
    });
});

// The enablement prelude — the two injected constants, the parsed manifest and
// the SW_OFFLINE_ENABLED expression — is the single most dangerous line in the
// worker: if it were true with an un-injected version, swShellCacheName() would
// return the valid-LOOKING name `zam-shell-__SW_SHELL_VERSION__` and the
// activate sweep would delete every real shell cache on the device. Asserting
// the SOURCE merely mentions SW_OFFLINE_ENABLED would survive that mutation, so
// this executes the real prelude with the tokens substituted, one half at a time.
const PRELUDE_START = "const SW_PRECACHE_MANIFEST_JSON";
const PRELUDE_END =
    "const SW_SHELL_CACHE = swShellCacheName(SW_SHELL_VERSION);";

interface WorkerPrelude {
    SW_OFFLINE_ENABLED: boolean;
    SW_SHELL_CACHE: string;
    SW_PRECACHE_URLS: string[] | null;
}

function bootPrelude(manifestJson: string, version: string): WorkerPrelude {
    const start = SW_SOURCE.indexOf(PRELUDE_START);
    const end = SW_SOURCE.indexOf(PRELUDE_END);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    // The prelude spans the mirrored region (it sits between the constants and
    // the enablement flag), so this evaluates the routing helpers too.
    const source = SW_SOURCE.slice(start, end + PRELUDE_END.length)
        .replace(`"${PRECACHE_MANIFEST_TOKEN}"`, JSON.stringify(manifestJson))
        .replace(`"${SHELL_VERSION_TOKEN}"`, JSON.stringify(version));
    return new Function(
        `${source}
        return { SW_OFFLINE_ENABLED, SW_SHELL_CACHE, SW_PRECACHE_URLS };`,
    )() as WorkerPrelude;
}

const INJECTED_MANIFEST = '["/","/index.html"]';

describe("static/sw.js offline enablement", () => {
    it("stays off when neither half was injected (dev)", () => {
        expect(
            bootPrelude(PRECACHE_MANIFEST_TOKEN, SHELL_VERSION_TOKEN)
                .SW_OFFLINE_ENABLED,
        ).toBe(false);
    });

    it("stays off when only the manifest was injected", () => {
        const prelude = bootPrelude(INJECTED_MANIFEST, SHELL_VERSION_TOKEN);
        expect(prelude.SW_PRECACHE_URLS).toEqual(["/", "/index.html"]);
        // The manifest alone is not enough: the cache name would be garbage and
        // the sweep would treat every real zam-shell-* cache as stale.
        expect(prelude.SW_OFFLINE_ENABLED).toBe(false);
    });

    it("stays off when only the version was injected", () => {
        expect(
            bootPrelude(PRECACHE_MANIFEST_TOKEN, "0.11.7-abc")
                .SW_OFFLINE_ENABLED,
        ).toBe(false);
    });

    it("turns on, with a real cache name, once both halves are injected", () => {
        const prelude = bootPrelude(INJECTED_MANIFEST, "0.11.7-abc");
        expect(prelude.SW_OFFLINE_ENABLED).toBe(true);
        expect(prelude.SW_SHELL_CACHE).toBe(`${SHELL_CACHE_PREFIX}0.11.7-abc`);
    });
});

describe("static/sw.js build-time contract", () => {
    it("carries each injection token exactly once, quoted", () => {
        for (const token of [PRECACHE_MANIFEST_TOKEN, SHELL_VERSION_TOKEN]) {
            const quoted = `"${token}"`;
            expect(SW_SOURCE.split(quoted).length - 1).toBe(1);
            expect(SW_SOURCE.split(token).length - 1).toBe(1);
        }
    });

    it("keeps the offline layer off until the tokens are injected", () => {
        // The shipped source is un-injected, so a worker booted from it must
        // report offline support as unavailable — otherwise dev (and any build
        // where injection silently failed) would compute a garbage cache name
        // and sweep the real caches on activate.
        expect(
            mirrored.swParsePrecacheManifest(PRECACHE_MANIFEST_TOKEN),
        ).toBeNull();
        expect(SW_SOURCE).toContain("SW_OFFLINE_ENABLED");
    });

    it("never lets a document be answered from cache before the network", () => {
        // Network-first is the whole update story: an online user must never
        // be served a stale shell.
        const nav = SW_SOURCE.slice(
            SW_SOURCE.indexOf("async function swNavigateNetworkFirst"),
        );
        const body = nav.slice(0, nav.indexOf("\n}"));
        expect(body.indexOf("await fetch(")).toBeGreaterThan(-1);
        expect(body.indexOf("await fetch(")).toBeLessThan(
            body.indexOf("caches.open"),
        );
    });

    it("never writes to the cache on the navigation path", () => {
        // A same-origin document navigation to a /_matrix/… URL classifies
        // `navigate`, so this is the last path by which a /_matrix/ response
        // could reach the Cache API. It reads from the cache; it never writes.
        const nav = SW_SOURCE.slice(
            SW_SOURCE.indexOf("async function swNavigateNetworkFirst"),
        );
        const body = nav.slice(0, nav.indexOf("\n}"));
        expect(body).not.toContain("cache.put");
    });

    it("never bulk-adds, which would fail install on one bad asset", () => {
        expect(SW_SOURCE).not.toContain("addAll");
    });
});

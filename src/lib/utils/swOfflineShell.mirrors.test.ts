import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    SHELL_CACHE_PREFIX,
    BUILD_ASSET_PREFIX,
    NAVIGATION_FALLBACK_URL,
} from "./swCacheRouting";
import { CLASSIFY_CASES, MANIFEST_CASES } from "./swCacheRouting.test";
import {
    PRECACHE_MANIFEST_TOKEN,
    SHELL_VERSION_TOKEN,
    buildPrecacheManifest,
    injectPrecache,
    precacheVersion,
} from "./swPrecache";

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

function regionSource(name: string): string {
    const startMarker = `// #region mirrored:${name}`;
    const endMarker = `// #endregion mirrored:${name}`;
    const start = SW_SOURCE.indexOf(startMarker);
    const end = SW_SOURCE.indexOf(endMarker);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return SW_SOURCE.slice(start + startMarker.length, end);
}

const mirrored = new Function(
    `${regionSource("swCacheRouting")}
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

// ── A fake Cache API ────────────────────────────────────────────────────────
// The four functions in the swOfflineRuntime region are the ones that actually
// write to storage, and every interesting property of theirs (what gets stored,
// what never does, what happens when the Cache API is hostile) is invisible to
// source-text assertions. So: a Map-backed `caches`, a stub `Request` and a
// vi.fn `fetch`, and every assertion below is behavioural.

class FakeRequest {
    url: string;
    init: unknown;
    constructor(url: string, init?: unknown) {
        this.url = url;
        this.init = init;
    }
}

interface FakeResponse {
    status: number;
    /** Real Responses carry this, and `ok` is the tempting wrong gate: it is
     *  true for 204 and 206 as well, which must never be stored as if they were
     *  the whole asset. Modelled faithfully so a `status === 200` → `ok`
     *  mutation is judged on behaviour, not on a missing property. */
    ok: boolean;
    type: string;
    redirected: boolean;
    headers: { get(name: string): string | null };
    clone(): FakeResponse;
    /** Set by `cache.put()` on the exact object it was handed — see below. */
    bodyUsed: boolean;
    tag: string;
}

/**
 * A response whose `clone()` returns a DISTINCT object, and whose body a
 * `cache.put()` consumes.
 *
 * Both halves are load-bearing. A `clone()` that returns `this` makes the
 * canonical Cache API bug invisible: in a real browser `cache.put()` locks the
 * body stream, so `cache.put(request, response)` (no clone) hands the caller a
 * disturbed response and EVERY build asset fails to load — while a self-
 * returning fake keeps every assertion green. `bodyUsed` is what lets the tests
 * below state the real requirement: the object handed to the page is not the
 * object that was stored, and it was never consumed.
 */
function response(
    over: Partial<{
        status: number;
        type: string;
        redirected: boolean;
        contentType: string;
        tag: string;
    }> = {},
): FakeResponse {
    const contentType = over.contentType ?? "application/javascript";
    const status = over.status ?? 200;
    const make = (): FakeResponse => ({
        status,
        ok: status >= 200 && status < 300,
        type: over.type ?? "basic",
        redirected: over.redirected ?? false,
        tag: over.tag ?? "network",
        bodyUsed: false,
        headers: {
            get: (name: string) =>
                name.toLowerCase() === "content-type" ? contentType : null,
        },
        // A fresh object every time, exactly like the real thing.
        clone: () => make(),
    });
    return make();
}

function keyOf(request: unknown): string {
    return typeof request === "string"
        ? request
        : (request as { url: string }).url;
}

// No `add()` on purpose. `cache.add()` stores whatever the server answered on
// ANY 2xx, with no content-type check — the exact hole this branch closes on
// the install path — so a regression back to it must not quietly work here:
// with no such method the per-item catch swallows the TypeError and the "what
// got stored" assertions below fail.
interface FakeCache {
    entries: Map<string, FakeResponse>;
    putCalls: Array<{ key: string; response: FakeResponse }>;
    matchCalls: Array<{ key: string; options: unknown }>;
    match(
        request: unknown,
        options?: unknown,
    ): Promise<FakeResponse | undefined>;
    put(request: unknown, res: FakeResponse): Promise<void>;
}

function makeCache(): FakeCache {
    const cache: FakeCache = {
        entries: new Map(),
        putCalls: [],
        matchCalls: [],
        async match(request, options) {
            cache.matchCalls.push({ key: keyOf(request), options });
            return cache.entries.get(keyOf(request));
        },
        async put(request, res) {
            // Real `put()` locks the body stream of the response it is given.
            // Modelled, so handing it the response we also return to the page
            // is observable.
            res.bodyUsed = true;
            cache.putCalls.push({ key: keyOf(request), response: res });
            cache.entries.set(keyOf(request), res);
        },
    };
    return cache;
}

interface FakeCacheStorage {
    stores: Map<string, FakeCache>;
    opened: string[];
    deleted: string[];
    open(name: string): Promise<FakeCache>;
    keys(): Promise<string[]>;
    delete(name: string): Promise<boolean>;
}

function fakeCaches(names: string[] = []): FakeCacheStorage {
    const storage: FakeCacheStorage = {
        stores: new Map(
            names.map((n): [string, FakeCache] => [n, makeCache()]),
        ),
        opened: [],
        deleted: [],
        open(name) {
            storage.opened.push(name);
            let cache = storage.stores.get(name);
            if (!cache) {
                cache = makeCache();
                storage.stores.set(name, cache);
            }
            return Promise.resolve(cache);
        },
        keys() {
            return Promise.resolve([...storage.stores.keys()]);
        },
        delete(name) {
            storage.deleted.push(name);
            storage.stores.delete(name);
            return Promise.resolve(true);
        },
    };
    return storage;
}

interface RuntimeDeps {
    caches?: unknown;
    fetch?: unknown;
    cacheName?: string;
    urls?: string[];
}

// The routing region comes first: swSweepStaleCaches calls swIsStaleShellCache
// and swNavigateNetworkFirst reads SW_NAVIGATION_FALLBACK_URL, both of which
// live there. Nothing outside these two regions is evaluated — the deps bag is
// exactly what makes that possible.
const runtime = new Function(
    "Request",
    `${regionSource("swCacheRouting")}
${regionSource("swOfflineRuntime")}
    return {
        swPrecacheShell,
        swSweepStaleCaches,
        swNavigateNetworkFirst,
        swAssetCacheFirst,
        SW_PRECACHE_TIMEOUT_MS,
    };`,
)(FakeRequest) as {
    swPrecacheShell: (deps?: RuntimeDeps) => Promise<void>;
    swSweepStaleCaches: (deps?: RuntimeDeps) => Promise<void>;
    swNavigateNetworkFirst: (
        request: unknown,
        deps?: RuntimeDeps,
    ) => Promise<FakeResponse>;
    swAssetCacheFirst: (
        request: unknown,
        deps?: RuntimeDeps,
    ) => Promise<FakeResponse>;
    SW_PRECACHE_TIMEOUT_MS: number;
};

const CACHE = "zam-shell-test";
const ASSET_URL = "https://chat.example.org/_app/immutable/chunks/abc.js";
const DOC_URL = "https://chat.example.org/app";

/** A `caches` whose very first touch throws SYNCHRONOUSLY (private browsing). */
const throwingCaches = {
    open(): Promise<FakeCache> {
        throw new Error("SecurityError: The operation is insecure.");
    },
    keys(): Promise<string[]> {
        throw new Error("SecurityError: The operation is insecure.");
    },
    delete(): Promise<boolean> {
        throw new Error("SecurityError: The operation is insecure.");
    },
};

afterEach(() => {
    vi.useRealTimers();
});

describe("static/sw.js swAssetCacheFirst", () => {
    it("answers a cache hit without going to the network at all", async () => {
        const caches = fakeCaches();
        const cache = await caches.open(CACHE);
        const hit = response({ tag: "cached" });
        cache.entries.set(ASSET_URL, hit);
        const doFetch = vi.fn();

        const out = await runtime.swAssetCacheFirst(
            new FakeRequest(ASSET_URL),
            {
                caches,
                fetch: doFetch,
                cacheName: CACHE,
            },
        );

        expect(out).toBe(hit);
        expect(doFetch).not.toHaveBeenCalled();
    });

    it("ignores Vary on the cache lookup", async () => {
        // The precache fetches with `Accept: */*`; a <link rel=stylesheet>
        // asks with `Accept: text/css,*/*;q=0.1`. A host that answers
        // `Vary: Accept` would make the precached root CSS permanently
        // unmatchable and the offline shell would boot UNSTYLED.
        const caches = fakeCaches();
        const cache = await caches.open(CACHE);
        const doFetch = vi.fn(async () => response({ tag: "net" }));

        await runtime.swAssetCacheFirst(new FakeRequest(ASSET_URL), {
            caches,
            fetch: doFetch,
            cacheName: CACHE,
        });

        expect(cache.matchCalls).toEqual([
            { key: ASSET_URL, options: { ignoreVary: true } },
        ]);
    });

    it("stores a complete 200 basic asset response", async () => {
        const caches = fakeCaches();
        const net = response({ tag: "net" });
        const doFetch = vi.fn(async () => net);

        const out = await runtime.swAssetCacheFirst(
            new FakeRequest(ASSET_URL),
            {
                caches,
                fetch: doFetch,
                cacheName: CACHE,
            },
        );

        expect(out).toBe(net);
        const cache = await caches.open(CACHE);
        expect(cache.putCalls.map((c) => c.key)).toEqual([ASSET_URL]);
        expect(cache.putCalls[0].response.tag).toBe("net");
    });

    it("stores a CLONE, so the page's copy is never the consumed one", async () => {
        // The canonical Cache API bug: `cache.put(request, response)` locks the
        // response's body stream, so the object handed back to the page is
        // disturbed and every build asset fails to load. Dropping `.clone()`
        // must fail here.
        const caches = fakeCaches();
        const net = response({ tag: "net" });
        const doFetch = vi.fn(async () => net);

        const out = await runtime.swAssetCacheFirst(
            new FakeRequest(ASSET_URL),
            { caches, fetch: doFetch, cacheName: CACHE },
        );

        const cache = await caches.open(CACHE);
        expect(out).toBe(net);
        expect(cache.putCalls[0].response).not.toBe(net);
        expect(cache.putCalls[0].response.bodyUsed).toBe(true);
        // The one that matters: what the page got still has its body.
        expect(net.bodyUsed).toBe(false);
    });

    it("treats an HTML cache HIT as a miss, so a poisoned entry self-heals", async () => {
        // An entry stored by an OLDER build (before the write-side gate) can
        // hold the adapter-static SPA fallback under a `.js` key. Cache-first
        // would serve that HTML forever — the module script fails its MIME
        // check and no reload can clear it. Falling through to the network is
        // the only way out.
        const caches = fakeCaches();
        const cache = await caches.open(CACHE);
        cache.entries.set(
            ASSET_URL,
            response({ tag: "poison", contentType: "text/html" }),
        );
        const net = response({ tag: "net" });
        const doFetch = vi.fn(async () => net);

        const out = await runtime.swAssetCacheFirst(
            new FakeRequest(ASSET_URL),
            { caches, fetch: doFetch, cacheName: CACHE },
        );

        expect(out).toBe(net);
        expect(doFetch).toHaveBeenCalledTimes(1);
        // …and the good response replaces the poison.
        expect(cache.entries.get(ASSET_URL)?.tag).toBe("net");
    });

    // Each of these is its own test so a mutation to the storage gate names the
    // exact response shape it let through.
    const REFUSED: Array<{
        name: string;
        over: Parameters<typeof response>[0];
    }> = [
        { name: "a 206 partial", over: { status: 206 } },
        { name: "a 204 with no body", over: { status: 204 } },
        { name: "a 302", over: { status: 302 } },
        { name: "a redirected response", over: { redirected: true } },
        { name: "an opaque cross-origin response", over: { type: "opaque" } },
        {
            // adapter-static + `fallback: index.html` means the HOST answers
            // an unknown path with index.html and a 200 text/html. A
            // non-atomic deploy (or a stale CDN edge) can make a current-hash
            // chunk miss for a moment; storing that HTML under the .js key
            // would break the chunk for the life of this cache version and no
            // reload could clear it.
            name: "an html spa-fallback body under a build-asset url",
            over: { contentType: "text/html; charset=utf-8" },
        },
    ];

    for (const c of REFUSED) {
        it(`never stores ${c.name}`, async () => {
            const caches = fakeCaches();
            const net = response(c.over);
            const doFetch = vi.fn(async () => net);

            const out = await runtime.swAssetCacheFirst(
                new FakeRequest(ASSET_URL),
                { caches, fetch: doFetch, cacheName: CACHE },
            );

            // Still served to the page — refusing to CACHE it is not refusing
            // to deliver it.
            expect(out).toBe(net);
            const cache = await caches.open(CACHE);
            expect(cache.putCalls).toEqual([]);
        });
    }

    it("still serves the network when caches.open throws synchronously", async () => {
        // Firefox private browsing has thrown SecurityError on the `caches`
        // property access itself. `caches.open(…).catch()` only handles a
        // REJECTION; a synchronous throw would reject this function's promise,
        // and event.respondWith(rejected) is a NetworkError the browser does not
        // retry — a white screen where the network was fine.
        const net = response({ tag: "net" });
        const doFetch = vi.fn(async () => net);

        const out = await runtime.swAssetCacheFirst(
            new FakeRequest(ASSET_URL),
            {
                caches: throwingCaches,
                fetch: doFetch,
                cacheName: CACHE,
            },
        );

        expect(out).toBe(net);
        expect(doFetch).toHaveBeenCalledTimes(1);
    });

    it("still serves the network when caches.open rejects", async () => {
        const net = response({ tag: "net" });
        const doFetch = vi.fn(async () => net);

        const out = await runtime.swAssetCacheFirst(
            new FakeRequest(ASSET_URL),
            {
                caches: { open: () => Promise.reject(new Error("quota")) },
                fetch: doFetch,
                cacheName: CACHE,
            },
        );

        expect(out).toBe(net);
        expect(doFetch).toHaveBeenCalledTimes(1);
    });
});

describe("static/sw.js swNavigateNetworkFirst", () => {
    it("returns the network response and never writes to the cache", async () => {
        const caches = fakeCaches();
        const cache = await caches.open(CACHE);
        // A stale shell IS cached: network-first means it must lose anyway.
        cache.entries.set(DOC_URL, response({ tag: "stale" }));
        const net = response({ tag: "net", contentType: "text/html" });
        const doFetch = vi.fn(async () => net);

        const out = await runtime.swNavigateNetworkFirst(
            new FakeRequest(DOC_URL),
            { caches, fetch: doFetch, cacheName: CACHE },
        );

        expect(out).toBe(net);
        expect(cache.putCalls).toEqual([]);
        // Not even opened: a document response can never reach the Cache API.
        expect(caches.opened).toEqual([CACHE]); // only this test's own open()
    });

    it("falls back to the cached document when the network throws", async () => {
        const caches = fakeCaches();
        const cache = await caches.open(CACHE);
        const cached = response({
            tag: "cached-doc",
            contentType: "text/html",
        });
        cache.entries.set(DOC_URL, cached);
        const doFetch = vi.fn(async () => {
            throw new TypeError("Failed to fetch");
        });

        const out = await runtime.swNavigateNetworkFirst(
            new FakeRequest(DOC_URL),
            { caches, fetch: doFetch, cacheName: CACHE },
        );

        expect(out).toBe(cached);
        expect(cache.putCalls).toEqual([]);
    });

    it("falls back to the precached shell when the document itself is not cached", async () => {
        const caches = fakeCaches();
        const cache = await caches.open(CACHE);
        const shell = response({ tag: "shell", contentType: "text/html" });
        cache.entries.set(NAVIGATION_FALLBACK_URL, shell);
        const doFetch = vi.fn(async () => {
            throw new TypeError("Failed to fetch");
        });

        const out = await runtime.swNavigateNetworkFirst(
            new FakeRequest(DOC_URL),
            { caches, fetch: doFetch, cacheName: CACHE },
        );

        expect(out).toBe(shell);
    });

    it("ignores Vary on both offline lookups", async () => {
        // The shell was precached by a WORKER fetch (`Accept: */*`) but a real
        // navigation carries `Accept: text/html,…`. A host that sends
        // `Vary: Accept` makes both matches miss and offline silently does
        // nothing.
        const caches = fakeCaches();
        const cache = await caches.open(CACHE);
        const doFetch = vi.fn(async () => {
            throw new TypeError("Failed to fetch");
        });

        await expect(
            runtime.swNavigateNetworkFirst(new FakeRequest(DOC_URL), {
                caches,
                fetch: doFetch,
                cacheName: CACHE,
            }),
        ).rejects.toThrow("Failed to fetch");

        expect(cache.matchCalls).toEqual([
            { key: DOC_URL, options: { ignoreSearch: true, ignoreVary: true } },
            { key: NAVIGATION_FALLBACK_URL, options: { ignoreVary: true } },
        ]);
    });

    it("rethrows the network error when the Cache API is hostile", async () => {
        const doFetch = vi.fn(async () => {
            throw new TypeError("Failed to fetch");
        });

        await expect(
            runtime.swNavigateNetworkFirst(new FakeRequest(DOC_URL), {
                caches: throwingCaches,
                fetch: doFetch,
                cacheName: CACHE,
            }),
        ).rejects.toThrow("Failed to fetch");
    });
});

describe("static/sw.js swPrecacheShell", () => {
    const URLS = ["/", "/index.html", "/_app/immutable/entry/app.js"];

    /** The per-url network the precache sees. Defaults to a good asset 200. */
    function fetcher(
        impl: (url: string) => Promise<FakeResponse> | FakeResponse = (url) =>
            response({ tag: url }),
    ) {
        return vi.fn(async (request: FakeRequest) => impl(request.url));
    }

    // Every test here drives the install bound, so no real timer is ever left
    // pending behind a resolved test.
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it("lets one failed item neither reject nor abandon the rest", async () => {
        // The bulk API is all-or-nothing, so it would reject install here — and
        // a worker that never installs is a worker that never gets a push.
        // Per-ITEM `.catch()` also matters on its own: without it Promise.all
        // rejects the instant the 404 lands, install completes early and the
        // still-in-flight assets are never awaited (the browser is then free to
        // kill the worker). So the slow item below must still be waited for.
        const caches = fakeCaches();
        const cache = await caches.open(CACHE);
        let releaseSlow = () => {};
        const slow = new Promise<void>((r) => {
            releaseSlow = r;
        });
        const doFetch = fetcher(async (url) => {
            if (url === "/index.html") throw new Error("404");
            if (url === "/_app/immutable/entry/app.js") await slow;
            return response({ tag: url });
        });

        let settled = false;
        const pending = runtime
            .swPrecacheShell({
                caches,
                fetch: doFetch,
                cacheName: CACHE,
                urls: URLS,
            })
            .then(() => {
                settled = true;
            });

        await vi.advanceTimersByTimeAsync(0);
        expect(settled).toBe(false);

        releaseSlow();
        await vi.advanceTimersByTimeAsync(0);
        await pending;

        expect(settled).toBe(true);
        expect([...cache.entries.keys()].sort()).toEqual([
            "/",
            "/_app/immutable/entry/app.js",
        ]);
    });

    it("requests every url with cache: reload", async () => {
        const caches = fakeCaches();
        const doFetch = fetcher();

        await runtime.swPrecacheShell({
            caches,
            fetch: doFetch,
            cacheName: CACHE,
            urls: URLS,
        });

        const requests = doFetch.mock.calls.map(([r]) => r);
        expect(requests.map((r) => r.url)).toEqual(URLS);
        for (const request of requests) {
            expect(request.init).toEqual({ cache: "reload" });
        }
    });

    it("never stores an html spa-fallback body under a build-asset url", async () => {
        // The write-side twin of swAssetCacheFirst's gate, and the one that
        // actually bites in the field: installs cluster in the minutes after a
        // deploy, which is exactly when a non-atomic upload (or a CDN edge
        // holding the new sw.js but not the new chunk) answers a current-hash
        // chunk with index.html and a 200 text/html. `cache.add()` stores that
        // without a murmur; cache-first then serves HTML for that chunk for the
        // life of this cache version and NO reload can clear it.
        const caches = fakeCaches();
        const cache = await caches.open(CACHE);
        const doFetch = fetcher((url) =>
            response({
                tag: url,
                contentType: url.startsWith("/_app/")
                    ? "text/html; charset=utf-8"
                    : "text/html",
            }),
        );

        await runtime.swPrecacheShell({
            caches,
            fetch: doFetch,
            cacheName: CACHE,
            urls: URLS,
        });

        // …while the shell DOCUMENT, which is legitimately html under both of
        // its keys, is still precached — refusing it would disable the whole
        // offline navigation fallback.
        expect([...cache.entries.keys()].sort()).toEqual(["/", "/index.html"]);
    });

    const PRECACHE_REFUSED: Array<{
        name: string;
        over: Parameters<typeof response>[0];
    }> = [
        { name: "a 206 partial", over: { status: 206 } },
        { name: "a 204 with no body", over: { status: 204 } },
        {
            name: "a 404 body the host returned as a page",
            over: { status: 404 },
        },
        { name: "a redirected response", over: { redirected: true } },
        { name: "an opaque cross-origin response", over: { type: "opaque" } },
    ];

    for (const c of PRECACHE_REFUSED) {
        it(`never precaches ${c.name}`, async () => {
            const caches = fakeCaches();
            const cache = await caches.open(CACHE);
            const doFetch = fetcher((url) =>
                url === "/_app/immutable/entry/app.js"
                    ? response({ ...c.over, tag: url })
                    : response({ tag: url }),
            );

            await runtime.swPrecacheShell({
                caches,
                fetch: doFetch,
                cacheName: CACHE,
                urls: URLS,
            });

            expect(cache.entries.has("/_app/immutable/entry/app.js")).toBe(
                false,
            );
            // The refusal is per item: its siblings are still precached.
            expect([...cache.entries.keys()].sort()).toEqual([
                "/",
                "/index.html",
            ]);
        });
    }

    it("resolves on a bound instead of hanging install forever", async () => {
        // No timeout here means a single stalled connection holds install open
        // until the browser's own event timeout kills it — and a failed install
        // on a FIRST registration leaves no active worker at all: no web push,
        // and no SET_AUTH, because initServiceWorker() awaits
        // navigator.serviceWorker.ready before posting the media token.
        const caches = fakeCaches();
        const doFetch = fetcher(() => new Promise<FakeResponse>(() => {})); // never settles

        let settled = false;
        const pending = runtime
            .swPrecacheShell({
                caches,
                fetch: doFetch,
                cacheName: CACHE,
                urls: URLS,
            })
            .then(() => {
                settled = true;
            });

        await vi.advanceTimersByTimeAsync(runtime.SW_PRECACHE_TIMEOUT_MS - 1);
        expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await pending;
        expect(settled).toBe(true);
    });

    it("keeps the bound short enough to matter", () => {
        // Pinned to a LITERAL: this race sits inside install's waitUntil and
        // initServiceWorker() awaits navigator.serviceWorker.ready before
        // posting SET_AUTH, so this number IS the worst-case window in which
        // authenticated media renders 401-broken on a first registration.
        // Phrased against the constant, raising it back to 15 s would pass.
        expect(runtime.SW_PRECACHE_TIMEOUT_MS).toBeGreaterThan(0);
        expect(runtime.SW_PRECACHE_TIMEOUT_MS).toBeLessThanOrEqual(8000);
    });

    it("never rejects when the Cache API is hostile", async () => {
        await expect(
            runtime.swPrecacheShell({
                caches: throwingCaches,
                fetch: fetcher(),
                cacheName: CACHE,
                urls: URLS,
            }),
        ).resolves.toBeUndefined();
    });

    it("never rejects when fetch itself throws synchronously", async () => {
        const caches = fakeCaches();
        const doFetch = vi.fn(() => {
            throw new TypeError("Failed to fetch");
        });

        await expect(
            runtime.swPrecacheShell({
                caches,
                fetch: doFetch,
                cacheName: CACHE,
                urls: URLS,
            }),
        ).resolves.toBeUndefined();
        // Every item was still attempted: a sync throw from one must not
        // abandon its siblings.
        expect(doFetch).toHaveBeenCalledTimes(URLS.length);
    });
});

describe("static/sw.js swSweepStaleCaches", () => {
    it("deletes only this module's caches from other versions", async () => {
        const caches = fakeCaches([
            CACHE,
            `${SHELL_CACHE_PREFIX}0.11.6-old`,
            `${SHELL_CACHE_PREFIX}0.11.5-older`,
            "matrix-sw",
            "workbox-precache-v2",
        ]);

        await runtime.swSweepStaleCaches({ caches, cacheName: CACHE });

        expect(caches.deleted.sort()).toEqual([
            `${SHELL_CACHE_PREFIX}0.11.5-older`,
            `${SHELL_CACHE_PREFIX}0.11.6-old`,
        ]);
    });

    it("never rejects when the Cache API is hostile", async () => {
        await expect(
            runtime.swSweepStaleCaches({
                caches: throwingCaches,
                cacheName: CACHE,
            }),
        ).resolves.toBeUndefined();
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

/** Boot the enablement prelude out of an arbitrary sw.js source. */
function bootPreludeFrom(swSource: string, cacheApi: unknown): WorkerPrelude {
    const start = swSource.indexOf(PRELUDE_START);
    const end = swSource.indexOf(PRELUDE_END);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    // The prelude spans the mirrored region (it sits between the constants and
    // the enablement flag), so this evaluates the routing helpers too. `caches`
    // arrives as a parameter so the Cache-API half of the flag is exercised
    // rather than accidentally satisfied by the test environment.
    return new Function(
        "caches",
        `${swSource.slice(start, end + PRELUDE_END.length)}
        return { SW_OFFLINE_ENABLED, SW_SHELL_CACHE, SW_PRECACHE_URLS };`,
    )(cacheApi) as WorkerPrelude;
}

function bootPrelude(
    manifestJson: string,
    version: string,
    // An options bag, not a positional default: the interesting case passes
    // `undefined` deliberately (no Cache API at all) and a default parameter
    // would silently swap the fake back in.
    opts: { cacheApi?: unknown } = {},
): WorkerPrelude {
    const cacheApi = "cacheApi" in opts ? opts.cacheApi : fakeCaches();
    return bootPreludeFrom(
        SW_SOURCE.replace(
            `"${PRECACHE_MANIFEST_TOKEN}"`,
            JSON.stringify(manifestJson),
        ).replace(`"${SHELL_VERSION_TOKEN}"`, JSON.stringify(version)),
        cacheApi,
    );
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

    it("stays off when the browser has no Cache API", () => {
        // Fully injected, but no storage to put it in. Every offline path is
        // then dead code, so it must never be entered.
        expect(
            bootPrelude(INJECTED_MANIFEST, "0.11.7-abc", {
                cacheApi: undefined,
            }).SW_OFFLINE_ENABLED,
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

    it("never bulk-adds, which would fail install on one bad asset", () => {
        expect(SW_SOURCE).not.toContain("addAll");
    });
});

// The end-to-end seam: the REAL injector run over the REAL worker source, then
// booted. Everything else in this file substitutes the tokens by hand, which
// leaves the actual build step — the one whose failure ships a green build with
// zero offline support — proved by nothing. In particular, emitting the
// manifest as a bare ARRAY rather than a quoted JS string literal exits 0,
// keeps every other test green, and turns the whole feature off.
const BUILT_HTML = `<!doctype html>
<html lang="en">
<head>
<link rel="icon" href="/favicon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
<link href="/_app/immutable/entry/start.vIgh-Gbe.js" rel="modulepreload">
<link href="/_app/immutable/entry/app.CpkcrxVc.js" rel="modulepreload">
<link href="/_app/immutable/assets/0.Cyikkxvy.css" rel="stylesheet">
</head>
<body></body>
</html>`;

describe("static/sw.js after the real build-time injection", () => {
    it("boots with offline enabled, the real manifest and a real cache name", () => {
        const injected = injectPrecache(SW_SOURCE, BUILT_HTML, "0.11.7");
        const prelude = bootPreludeFrom(injected, fakeCaches());

        expect(prelude.SW_OFFLINE_ENABLED).toBe(true);
        expect(prelude.SW_PRECACHE_URLS).toEqual(
            buildPrecacheManifest(BUILT_HTML),
        );
        expect(prelude.SW_SHELL_CACHE).toBe(
            SHELL_CACHE_PREFIX +
                precacheVersion("0.11.7", buildPrecacheManifest(BUILT_HTML)),
        );
    });

    it("leaves no placeholder assignment behind", () => {
        const injected = injectPrecache(SW_SOURCE, BUILT_HTML, "0.11.7");
        // The `raw.startsWith("__SW_")` guard inside the worker survives, and
        // must: this looks only for a whole `__SW_…__` token.
        expect(injected).not.toMatch(/__SW_[A-Z_]*__/);
    });
});

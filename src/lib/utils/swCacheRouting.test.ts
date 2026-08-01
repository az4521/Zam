import { describe, it, expect } from "vitest";
import {
    classifyRequest,
    parsePrecacheManifest,
    shellCacheName,
    isStaleShellCache,
    SHELL_CACHE_PREFIX,
    NAVIGATION_FALLBACK_URL,
    type ClassifyInput,
    type FetchKind,
} from "./swCacheRouting";
import { SHELL_EXTRA_URLS } from "./swPrecache";

const ORIGIN = "https://chat.example.org";

function req(over: Partial<ClassifyInput> = {}): ClassifyInput {
    return {
        method: "GET",
        mode: "no-cors",
        destination: "script",
        url: `${ORIGIN}/_app/immutable/chunks/abc.js`,
        appOrigin: ORIGIN,
        hasAuthHeader: false,
        ...over,
    };
}

// Shared with the mirrors test in swOfflineShell.mirrors.test.ts, which runs
// this exact table against static/sw.js's hand-written copy of the logic.
export const CLASSIFY_CASES: Array<{
    name: string;
    input: ClassifyInput;
    expected: FetchKind;
}> = [
    { name: "hashed build asset", input: req(), expected: "asset" },
    {
        name: "document navigation",
        input: req({
            mode: "navigate",
            destination: "document",
            url: `${ORIGIN}/app`,
        }),
        expected: "navigate",
    },
    {
        name: "root navigation",
        input: req({
            mode: "navigate",
            destination: "document",
            url: `${ORIGIN}/`,
        }),
        expected: "navigate",
    },
    {
        name: "destination document without navigate mode",
        input: req({
            mode: "cors",
            destination: "document",
            url: `${ORIGIN}/app`,
        }),
        expected: "navigate",
    },
    {
        name: "POST is never cached",
        input: req({ method: "POST" }),
        expected: "bypass",
    },
    {
        name: "an Authorization header is never cached",
        input: req({ hasAuthHeader: true }),
        expected: "bypass",
    },
    {
        name: "cross-origin build-asset path",
        input: req({
            url: "https://evil.example/_app/immutable/chunks/abc.js",
        }),
        expected: "bypass",
    },
    {
        name: "same-origin homeserver media stays with the auth handler",
        input: req({
            url: `${ORIGIN}/_matrix/client/v1/media/download/x/y`,
            destination: "image",
        }),
        expected: "bypass",
    },
    {
        name: "same-origin homeserver API is never cached",
        input: req({
            url: `${ORIGIN}/_matrix/client/v3/sync`,
            destination: "",
        }),
        expected: "bypass",
    },
    {
        name: "traversal out of the asset prefix",
        input: req({
            url: `${ORIGIN}/_app/immutable/../_matrix/client/v3/sync`,
        }),
        expected: "bypass",
    },
    {
        // `new URL` normalises `..` segments but does NOT decode `%2f`, so this
        // pathname really does still start with `/_app/immutable/`. Some servers
        // decode `%2F` before resolving, which would make a cache-first,
        // Cache-API-stored `asset` verdict a `/_matrix/` response in disguise.
        name: "percent-encoded traversal out of the asset prefix",
        input: req({
            url: `${ORIGIN}/_app/immutable/..%2f..%2f_matrix/client/v3/sync`,
        }),
        expected: "bypass",
    },
    {
        // The rule is "no percent sign anywhere in the path", not "no %2f":
        // a real Vite build asset filename never contains one, so rejecting the
        // whole class costs nothing and leaves no encoding to be clever with.
        name: "a percent-escaped filename is not a build asset",
        input: req({ url: `${ORIGIN}/_app/immutable/chunks/a%20b.js` }),
        expected: "bypass",
    },
    {
        name: "decoy prefix directory",
        input: req({ url: `${ORIGIN}/_app/immutableX/evil.js` }),
        expected: "bypass",
    },
    {
        // The prefix test must be `startsWith`, not `includes`. `new URL`
        // normalises the `..` in the traversal case above out of the prefix
        // entirely (`/_app/immutable/../_matrix/x` → `/_app/_matrix/x`), so
        // that case cannot tell the two apart — this one can, and a homeserver
        // that serves media under a path like this would otherwise be stored
        // in the Cache API cache-first.
        name: "the asset prefix appearing mid-path is not a build asset",
        input: req({
            url: `${ORIGIN}/_matrix/client/v1/media/download/x/_app/immutable/y.js`,
            destination: "image",
        }),
        expected: "bypass",
    },
    {
        // `mode: "navigate"` is also what an <iframe>/<frame>/<embed>/<object>
        // sub-resource sends, and the worker's media-auth branch admits exactly
        // those destinations. Against a same-origin homeserver such a request
        // would otherwise be claimed as a document: stripped of its
        // Authorization header (401) and, offline, answered with the cached app
        // shell at a /_matrix/ URL. The /_matrix/ check must therefore come
        // BEFORE the navigate check.
        name: "a navigation to a /_matrix/ url is still not ours",
        input: req({
            mode: "navigate",
            destination: "document",
            url: `${ORIGIN}/_matrix/client/v1/media/download/x/y`,
        }),
        expected: "bypass",
    },
    {
        // Pins the ORDER of the navigate and asset checks: swapping them would
        // make this cache-first, so a document response would be `cache.put()`
        // under a build-asset URL. Documents are network-first, always.
        name: "a navigation whose path looks like a build asset is still a navigation",
        input: req({
            mode: "navigate",
            destination: "document",
            url: `${ORIGIN}/_app/immutable/entry/app.js`,
        }),
        expected: "navigate",
    },
    {
        name: "the worker script itself",
        input: req({ url: `${ORIGIN}/sw.js`, destination: "" }),
        expected: "bypass",
    },
    {
        name: "reloadToLatest's cache-busting document fetch is not a navigation",
        input: req({ mode: "cors", destination: "", url: `${ORIGIN}/app` }),
        expected: "bypass",
    },
    {
        name: "unparseable url",
        input: req({ url: "not a url" }),
        expected: "bypass",
    },
    {
        name: "static twemoji is out of scope",
        input: req({
            url: `${ORIGIN}/twemoji/1f600.svg`,
            destination: "image",
        }),
        expected: "bypass",
    },
];

describe("classifyRequest", () => {
    for (const c of CLASSIFY_CASES) {
        it(c.name, () => {
            expect(classifyRequest(c.input)).toBe(c.expected);
        });
    }
});

// Shared with the mirrors test too.
export const MANIFEST_CASES: Array<{
    name: string;
    raw: unknown;
    expected: string[] | null;
}> = [
    {
        name: "an injected manifest",
        raw: '["/","/index.html","/_app/immutable/entry/app.js"]',
        expected: ["/", "/index.html", "/_app/immutable/entry/app.js"],
    },
    {
        name: "the un-injected placeholder",
        raw: "__SW_PRECACHE_MANIFEST__",
        expected: null,
    },
    { name: "a non-string", raw: 42, expected: null },
    { name: "malformed json", raw: "[", expected: null },
    { name: "json that is not an array", raw: '{"a":1}', expected: null },
    { name: "an empty array", raw: "[]", expected: null },
    {
        name: "protocol-relative entries are dropped",
        raw: '["//evil.example/x.js","/ok.js"]',
        expected: ["/ok.js"],
    },
    {
        name: "absolute and relative entries are dropped",
        raw: '["https://evil.example/x.js","./rel.js","/ok.js"]',
        expected: ["/ok.js"],
    },
    {
        name: "non-string entries are dropped",
        raw: '[1,null,{"u":"/x.js"},"/ok.js"]',
        expected: ["/ok.js"],
    },
    {
        name: "an array with nothing usable left",
        raw: '["//evil.example/x.js"]',
        expected: null,
    },
];

describe("parsePrecacheManifest", () => {
    for (const c of MANIFEST_CASES) {
        it(c.name, () => {
            expect(parsePrecacheManifest(c.raw)).toEqual(c.expected);
        });
    }
});

// Both of these constants get hand-copied into `static/sw.js`, so they are
// pinned to literals rather than derived from themselves. Deriving the
// expectation from the constant let either one drift silently: a changed
// prefix means the activate sweep stops recognising the caches it wrote (they
// accumulate forever), and a changed fallback URL means the offline
// navigation fallback is a permanent cache miss — an app that looks online-only.
describe("the constants mirrored into static/sw.js", () => {
    it("pins the shell cache prefix", () => {
        expect(SHELL_CACHE_PREFIX).toBe("zam-shell-");
    });

    it("pins the navigation fallback url", () => {
        expect(NAVIGATION_FALLBACK_URL).toBe("/index.html");
    });

    it("precaches the navigation fallback, so it can actually be served", () => {
        expect(SHELL_EXTRA_URLS).toContain(NAVIGATION_FALLBACK_URL);
    });
});

describe("shellCacheName / isStaleShellCache", () => {
    it("prefixes the version", () => {
        expect(shellCacheName("0.11.7-abc")).toBe(
            `${SHELL_CACHE_PREFIX}0.11.7-abc`,
        );
    });

    it("treats an older shell cache as stale", () => {
        const current = shellCacheName("0.11.7-new");
        expect(isStaleShellCache(shellCacheName("0.11.6-old"), current)).toBe(
            true,
        );
    });

    it("never treats the current cache as stale", () => {
        const current = shellCacheName("0.11.7-new");
        expect(isStaleShellCache(current, current)).toBe(false);
    });

    it("never claims a cache it does not own", () => {
        const current = shellCacheName("0.11.7-new");
        expect(isStaleShellCache("matrix-sw", current)).toBe(false);
        expect(isStaleShellCache("workbox-precache-v2", current)).toBe(false);
        expect(isStaleShellCache(undefined, current)).toBe(false);
        expect(isStaleShellCache(123, current)).toBe(false);
    });
});

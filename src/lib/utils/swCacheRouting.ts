/**
 * Runtime half of the PWA offline shell (audit finding PWA-01).
 *
 * `static/sw.js` cannot import TypeScript, so it hand-mirrors everything in
 * this file inside a `// #region mirrored:swCacheRouting` block. Change one,
 * change both — `swOfflineShell.mirrors.test.ts` executes the worker's copy
 * against this file's case table and fails on drift.
 *
 * The rule that shapes all of it: the Cache API must only ever hold this
 * build's own immutable, non-credentialed assets. Anything under `/_matrix/`,
 * anything cross-origin, anything with an Authorization header and anything
 * that is not a GET is classified `bypass` and left to the worker's existing
 * media-auth handling (or to the network).
 */

export const SHELL_CACHE_PREFIX = "zam-shell-";
export const BUILD_ASSET_PREFIX = "/_app/immutable/";
export const NAVIGATION_FALLBACK_URL = "/index.html";

export type FetchKind = "navigate" | "asset" | "bypass";

export interface ClassifyInput {
    method: string;
    /** `Request.mode` */
    mode: string;
    /** `Request.destination` */
    destination: string;
    url: string;
    /** `self.location.origin` inside the worker. */
    appOrigin: string;
    hasAuthHeader: boolean;
}

/**
 * Which of the worker's three offline behaviours a request gets.
 *
 * `navigate` → network-first with the cached shell as the offline fallback.
 * `asset`    → cache-first (content-hashed filenames can never go stale).
 * `bypass`   → the offline layer does not touch it at all.
 */
export function classifyRequest(input: ClassifyInput): FetchKind {
    if (input.method !== "GET") return "bypass";
    if (input.hasAuthHeader) return "bypass";

    let parsed: URL;
    try {
        parsed = new URL(input.url);
    } catch {
        return "bypass";
    }
    if (parsed.origin !== input.appOrigin) return "bypass";

    // Before the navigate check, deliberately. `mode === "navigate"` is also
    // true for <iframe>/<frame>/<embed>/<object>, and the worker's media-auth
    // branch admits exactly those destinations — so against a same-origin
    // homeserver a sub-resource navigation to a `/_matrix/` URL would be
    // claimed as a document, lose its Authorization header (401) and, once the
    // network failed, be answered with the cached index.html. Nothing under
    // `/_matrix/` is ever ours, whatever shape the request arrives in.
    if (parsed.pathname.includes("/_matrix/")) return "bypass";

    // `mode` is the reliable signal; `destination` covers the browsers that
    // report a document fetch without navigate mode.
    if (input.mode === "navigate" || input.destination === "document")
        return "navigate";

    // `parsed.pathname` is already normalised by the URL parser, so a
    // `/_app/immutable/../_matrix/…` traversal has left the prefix by here.
    if (parsed.pathname.startsWith(BUILD_ASSET_PREFIX)) {
        // …but `new URL` normalises `..` segments only — it does NOT decode
        // `%2f`, so `/_app/immutable/..%2f..%2f_matrix/client/v3/sync` keeps
        // that pathname and still starts with the prefix. Servers that decode
        // `%2F` before resolving would then hand us a `/_matrix/` response
        // that we had classified cache-first and stored in the Cache API. A
        // real Vite build asset filename never contains a percent sign, so
        // requiring none closes the whole encoded-traversal class for free.
        if (parsed.pathname.indexOf("%") !== -1) return "bypass";
        return "asset";
    }

    return "bypass";
}

/**
 * Read the build-injected manifest. Returns `null` — meaning "offline support
 * is off" — for the un-injected placeholder (dev, where `static/sw.js` is
 * served verbatim) and for anything malformed. Entries must be absolute
 * same-origin paths: a `//host/x` entry would precache a third party.
 */
export function parsePrecacheManifest(raw: unknown): string[] | null {
    if (typeof raw !== "string") return null;
    if (raw.startsWith("__SW_")) return null;
    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!Array.isArray(value)) return null;
    const urls = value.filter(
        (u): u is string =>
            typeof u === "string" && u.startsWith("/") && !u.startsWith("//"),
    );
    return urls.length > 0 ? urls : null;
}

export function shellCacheName(version: string): string {
    return SHELL_CACHE_PREFIX + version;
}

/** Only ever true for a cache this module created for a different version. */
export function isStaleShellCache(name: unknown, currentName: string): boolean {
    return (
        typeof name === "string" &&
        name.startsWith(SHELL_CACHE_PREFIX) &&
        name !== currentName
    );
}

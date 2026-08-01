/**
 * Hand-written mirror of src/lib/utils/swPrecache.ts.
 *
 * The injection has to run AFTER adapter-static has written `build/`, which a
 * Vite plugin cannot do (see scripts/sw-precache.mjs for the measurement), so
 * it runs as a plain node post-build step — and node cannot import TypeScript.
 * Hence this copy. Change one, change both; swPrecacheScript.mirrors.test.ts
 * executes BOTH modules over one case table and fails on any divergence.
 *
 * Side-effect free on purpose: the runner is a separate file so that importing
 * these functions from a test can never touch the filesystem, and so the runner
 * has no "am I the main module?" guard that could silently skip the injection.
 */

/** Replaced, quotes and all, by the JSON manifest at build time. */
export const PRECACHE_MANIFEST_TOKEN = "__SW_PRECACHE_MANIFEST__";
/** Replaced, quotes and all, by the shell version at build time. */
export const SHELL_VERSION_TOKEN = "__SW_SHELL_VERSION__";

/**
 * Hard ceiling on the startup asset count. The point of this whole file is a
 * BOUNDED precache: today's shell is 11 files / ~140 KB, while the full build
 * is 48.7 MB (twemoji, ruffle, a 5.5 MB crypto wasm). If a SvelteKit change
 * ever starts inlining the whole app into the fallback document, the build
 * must break rather than quietly precache tens of megabytes on every install.
 */
export const MAX_STARTUP_ASSETS = 60;

/**
 * Same-origin paths that are part of the shell but are not referenced from
 * index.html as build assets. `/` and `/index.html` are both listed because
 * they are distinct Cache API keys and the manifest's `start_url` is `/`.
 * @type {readonly string[]}
 */
export const SHELL_EXTRA_URLS = [
    "/",
    "/index.html",
    "/manifest.webmanifest",
    "/favicon.png",
    "/favicon.svg",
    "/favicon_foreground.png",
];

// Deliberately anchored on the full `/_app/immutable/` prefix (with the
// trailing slash) so a decoy like `/_app/immutableX/` cannot match, and
// restricted to .js/.css so preloaded wasm/media never enters the manifest.
const STARTUP_ASSET_RE = /\/_app\/immutable\/[A-Za-z0-9._\-/]+\.(?:js|css)\b/g;

/**
 * Every `/_app/immutable/*.{js,css}` URL referenced by the shell document.
 * @param {string} html
 * @returns {string[]}
 */
export function extractStartupAssets(html) {
    if (typeof html !== "string") return [];
    /** @type {Set<string>} */
    const found = new Set();
    for (const match of html.matchAll(STARTUP_ASSET_RE)) found.add(match[0]);
    return [...found].sort();
}

/**
 * The full, bounded, sorted precache list for a built shell document.
 * @param {string} html
 * @returns {string[]}
 */
export function buildPrecacheManifest(html) {
    const assets = extractStartupAssets(html);
    if (assets.length === 0) {
        throw new Error(
            "sw precache: no /_app/immutable assets found in the built index.html — " +
                "the shell document's shape changed and the offline precache would be empty",
        );
    }
    if (assets.length > MAX_STARTUP_ASSETS) {
        throw new Error(
            `sw precache: ${assets.length} startup assets exceeds the bound of ${MAX_STARTUP_ASSETS}`,
        );
    }
    return [...new Set([...SHELL_EXTRA_URLS, ...assets])].sort();
}

/**
 * Deterministic short hash (FNV-1a, 32-bit) of the manifest, prefixed with the
 * app version. Injecting this into sw.js is what makes the worker's BYTES
 * differ between deploys — which is the only thing that makes the browser
 * re-install it and re-precache. Filenames are content-hashed, so the digest
 * moves iff the app actually changed.
 * @param {string} appVersion
 * @param {readonly string[]} urls
 * @returns {string}
 */
export function precacheVersion(appVersion, urls) {
    const input = [...urls].join("\n");
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    const safeVersion = String(appVersion).replace(/[^A-Za-z0-9.\-]/g, "");
    return `${safeVersion}-${hash.toString(36)}`;
}

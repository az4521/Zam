/**
 * Build-time half of the PWA offline shell (audit finding PWA-01).
 *
 * `static/sw.js` is a hand-written, un-bundled file, so it has no access to
 * SvelteKit's `$service-worker` asset manifest. Instead `scripts/sw-precache.mjs`
 * — a post-build node step that `npm run build` runs after `vite build`, NOT a
 * Vite plugin and nothing to do with `vite.config.ts` (see that file's header
 * for the measurement that ruled a plugin out) — reads the emitted
 * `build/index.html`, which adapter-static writes as the SPA fallback document
 * and which therefore lists exactly the assets a cold start needs, and injects
 * the result into `build/sw.js` in place of the two tokens below.
 *
 * Everything here is pure so the parts that silently rot — the extraction, when
 * SvelteKit changes its output shape, and the injection, whose failure mode is
 * a green build that ships zero offline support — are unit-testable without a
 * build. `scripts/sw-precache-lib.mjs` is a hand mirror of this file (node
 * cannot import TypeScript); `swPrecacheScript.mirrors.test.ts` pins the two
 * together.
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
 */
export const SHELL_EXTRA_URLS: readonly string[] = [
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

/** Every `/_app/immutable/*.{js,css}` URL referenced by the shell document. */
export function extractStartupAssets(html: string): string[] {
    if (typeof html !== "string") return [];
    const found = new Set<string>();
    for (const match of html.matchAll(STARTUP_ASSET_RE)) found.add(match[0]);
    return [...found].sort();
}

/** The full, bounded, sorted precache list for a built shell document. */
export function buildPrecacheManifest(html: string): string[] {
    const assets = extractStartupAssets(html);
    if (assets.length === 0) {
        throw new Error(
            "sw precache: no /_app/immutable assets found in the built index.html - " +
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
 * re-install it and re-precache.
 *
 * Deterministic in the INPUTS only: identical urls + version always give the
 * same digest. It is NOT a content digest of the app. Measured 2026-08-01: two
 * builds of byte-identical source produce different chunk hashes, because
 * SvelteKit bakes a per-build version stamp into the `start`/`app` entries — so
 * in practice this moves on EVERY build, not only on a real change. That is
 * harmless for correctness (it only ever strengthens the update story: the new
 * worker always installs), but it has a real cost: the cache is version-scoped,
 * so every build discards the warmed runtime asset cache and the next offline
 * start is cold again until the user browses online once.
 */
export function precacheVersion(
    appVersion: string,
    urls: readonly string[],
): string {
    const input = [...urls].join("\n");
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    const safeVersion = String(appVersion).replace(/[^A-Za-z0-9.\-]/g, "");
    return `${safeVersion}-${hash.toString(36)}`;
}

/**
 * The path, relative to the build directory, that a manifest URL is served
 * from. `/` is the SPA fallback document, i.e. `index.html`. Used by the
 * runner to prove every entry it is about to bake in actually exists — the
 * worker swallows per-URL precache failures by design, so without this a
 * deleted `static/` file would leave a green build quietly precaching 16 of 17
 * entries forever.
 */
export function precacheEntryPath(url: string): string {
    const path = url === "/" ? "/index.html" : String(url);
    return path.replace(/^\/+/, "");
}

/**
 * Replace the two placeholder constants in a `sw.js` source with the real
 * manifest and shell version. Pure — the runner does the file I/O — because
 * every interesting way this can fail is invisible from outside:
 *
 *  - Emitting the manifest as a bare ARRAY instead of a quoted JS STRING
 *    LITERAL leaves the build exiting 0 while the worker's
 *    `swParsePrecacheManifest` rejects the non-string and every offline path
 *    silently turns itself off. Hence the double `JSON.stringify`.
 *  - A token that appears zero times (already injected, or renamed) or more
 *    than once (a copy in a comment) means `String.replace` would inject a
 *    partial or wrong worker. Loudly fatal: an un-injected `sw.js` ships zero
 *    offline support and looks completely normal.
 */
export function injectPrecache(
    swSource: string,
    html: string,
    appVersion: string,
): string {
    for (const token of [PRECACHE_MANIFEST_TOKEN, SHELL_VERSION_TOKEN]) {
        const quoted = `"${token}"`;
        const count = swSource.split(quoted).length - 1;
        if (count !== 1) {
            throw new Error(
                `zam-sw-precache: expected exactly one ${quoted} in build/sw.js, found ${count}`,
            );
        }
    }
    const urls = buildPrecacheManifest(html);
    const shellVersion = precacheVersion(appVersion, urls);
    // Replacer FUNCTIONS, so a `$&`/`$1` sequence in a hashed filename could
    // never be interpreted as a substitution. The manifest is stringified
    // twice on purpose: once to JSON, once to a JS string literal.
    return swSource
        .replace(`"${PRECACHE_MANIFEST_TOKEN}"`, () =>
            JSON.stringify(JSON.stringify(urls)),
        )
        .replace(`"${SHELL_VERSION_TOKEN}"`, () =>
            JSON.stringify(shellVersion),
        );
}

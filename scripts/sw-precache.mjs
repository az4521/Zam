/**
 * Bake the offline-shell precache manifest into the built service worker.
 * Runs as the second half of `npm run build`, after `vite build`.
 *
 * `static/sw.js` is hand-written and copied verbatim by adapter-static, so it
 * has no access to SvelteKit's `$service-worker` asset manifest. This reads
 * the emitted `build/index.html` — the SPA fallback document, which lists
 * exactly what a cold start needs — and replaces the two placeholder
 * constants in `build/sw.js`.
 *
 * Why a post-build node script rather than a Vite plugin: a plugin's
 * `closeBundle` fires once per build environment, and the FIRST firing (the
 * `client` environment) happens long before adapter-static has written
 * `build/` — measured 2026-08-01, the client firing sees ENOENT for both
 * build/index.html and build/sw.js, and only the later `ssr` firing sees them.
 * `closeBundle` is a parallel hook, so `order: "post"` orders us within one
 * firing but cannot skip the early one. Depending on which environment happens
 * to be last is exactly the kind of silent-skip this file must not have.
 *
 * Injecting a per-build version is also what makes the worker's BYTES change
 * between deploys, which is the only thing that makes the browser re-install
 * it and re-precache. Silent on success so `npm run build` still ends with the
 * adapter's own "✔ done"; throws on anything unexpected, because an
 * un-injected worker ships zero offline support and looks completely normal.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
    buildPrecacheManifest,
    precacheVersion,
    PRECACHE_MANIFEST_TOKEN,
    SHELL_VERSION_TOKEN,
} from "./sw-precache-lib.mjs";

const rootDir = new URL("../", import.meta.url);
const buildDir = new URL("build/", rootDir);
const swUrl = new URL("sw.js", buildDir);

const pkg = JSON.parse(readFileSync(new URL("package.json", rootDir), "utf-8"));
const html = readFileSync(new URL("index.html", buildDir), "utf-8");
const sw = readFileSync(swUrl, "utf-8");

for (const token of [PRECACHE_MANIFEST_TOKEN, SHELL_VERSION_TOKEN]) {
    const count = sw.split(`"${token}"`).length - 1;
    if (count !== 1) {
        throw new Error(
            `zam-sw-precache: expected exactly one "${token}" in build/sw.js, found ${count}`,
        );
    }
}

const urls = buildPrecacheManifest(html);
const shellVersion = precacheVersion(pkg.version, urls);
// Replacer functions, so a `$&`/`$1` sequence in a hashed filename could never
// be interpreted as a substitution.
const injected = sw
    .replace(`"${PRECACHE_MANIFEST_TOKEN}"`, () =>
        JSON.stringify(JSON.stringify(urls)),
    )
    .replace(`"${SHELL_VERSION_TOKEN}"`, () => JSON.stringify(shellVersion));
writeFileSync(swUrl, injected);

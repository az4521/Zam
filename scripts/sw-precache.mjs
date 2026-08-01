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
 *
 * This file is deliberately nothing but I/O: read, check the files exist,
 * write. The whole transform lives in `sw-precache-lib.mjs` (pure, mirrored
 * from `src/lib/utils/swPrecache.ts`, unit-tested), because a build script is
 * the one place a silent mutation survives everything — a corrupt injection
 * still exits 0 and still ends with "✔ done".
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
    buildPrecacheManifest,
    injectPrecache,
    precacheEntryPath,
} from "./sw-precache-lib.mjs";

const rootDir = new URL("../", import.meta.url);
const buildDir = new URL("build/", rootDir);
const swUrl = new URL("sw.js", buildDir);

const pkg = JSON.parse(readFileSync(new URL("package.json", rootDir), "utf-8"));
const html = readFileSync(new URL("index.html", buildDir), "utf-8");
const sw = readFileSync(swUrl, "utf-8");

// SHELL_EXTRA_URLS is a hardcoded list and the worker swallows per-URL precache
// failures by design (one 404 must never fail install), so a deleted
// `static/favicon.svg` would otherwise leave a green build precaching 16 of 17
// entries — forever, and silently. This is the only check that can catch it,
// because it is the only step that can see the filesystem.
const missing = buildPrecacheManifest(html).filter(
    (url) => !existsSync(new URL(precacheEntryPath(url), buildDir)),
);
if (missing.length > 0) {
    throw new Error(
        `zam-sw-precache: ${missing.length} precache entr${
            missing.length === 1 ? "y is" : "ies are"
        } missing from build/: ${missing.join(", ")}`,
    );
}

writeFileSync(swUrl, injectPrecache(sw, html, pkg.version));

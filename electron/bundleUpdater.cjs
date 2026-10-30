// Updates the web UI without reinstalling the app. The desktop app serves the
// built site from a folder (main.cjs startServer); a release also publishes
// that site as a signed bundle, and this downloads, verifies and stages it. The
// shell (main process, preload, Electron, native helpers) cannot change this
// way, so a bundle only applies to a shell with the fingerprint it was built
// for (scripts/shell-hash-lib.mjs); any other shell takes the installer update.
//
// State lives in `dir` (userData/web-bundles):
//   <version>/        an unpacked bundle, with meta.json { version, shellHash }
//   active.json       { version } which one the server uses; absent = the one
//                     packed in the app
//   bad.json          [version] bundles that never finished loading
//   boot-attempt.json { version } written when an unproven bundle is applied,
//                     removed when the page says it loaded; found at the next
//                     start it means that bundle is broken, so it is dropped
//
// Everything outside (network, hashing of the download, the clock) comes in
// through `deps`, so the tests drive it without Electron.

const fs = require("fs");
const path = require("path");
const { unpackBundle, verifyManifest } = require("./bundleFormat.cjs");

const MANIFEST_ASSET = "zam-bundle.json";
const MAX_BUNDLE_BYTES = 300 * 1024 * 1024;

/** -1, 0 or 1. Numeric x.y.z; a pre-release sorts below its release. */
function compareVersions(a, b) {
    const parse = (v) => {
        const [core, pre] = String(v).split("-", 2);
        const n = core.split(".").map((x) => parseInt(x, 10) || 0);
        while (n.length < 3) n.push(0);
        return { n, pre: pre ?? null };
    };
    const x = parse(a);
    const y = parse(b);
    for (let i = 0; i < 3; i++) {
        if (x.n[i] !== y.n[i]) return x.n[i] < y.n[i] ? -1 : 1;
    }
    if (x.pre === y.pre) return 0;
    if (x.pre === null) return 1;
    if (y.pre === null) return -1;
    return x.pre < y.pre ? -1 : 1;
}

function readJson(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return fallback;
    }
}

// A crash between write and rename leaves the old file, never half a new one.
function writeJsonAtomic(file, value) {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, file);
}

const SAFE_VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/**
 * @param {{
 *   dir: string,
 *   shellVersion: string,
 *   shellHash: string,
 *   publicKey: string,
 *   releaseUrl: string,
 *   assetUrlPrefix: string,
 *   fetchJson: (url: string) => Promise<any>,
 *   download: (url: string, dest: string, opts: {
 *     maxBytes: number, onProgress: (fraction: number) => void,
 *   }) => Promise<{ sha512: string, size: number }>,
 *   log?: (...a: unknown[]) => void,
 * }} deps
 */
function createBundleUpdater(deps) {
    const { dir, shellVersion, shellHash } = deps;
    const log = deps.log ?? (() => {});
    const activeFile = path.join(dir, "active.json");
    const badFile = path.join(dir, "bad.json");
    const bootFile = path.join(dir, "boot-attempt.json");

    // The version the UI is running now: the applied bundle, else the shell's.
    let current = shellVersion;

    const bundleDir = (version) => path.join(dir, version);

    function stagedMeta(version) {
        if (!SAFE_VERSION.test(version)) return null;
        const meta = readJson(path.join(bundleDir(version), "meta.json"), null);
        if (
            !meta ||
            meta.version !== version ||
            meta.shellHash !== shellHash ||
            !fs.existsSync(path.join(bundleDir(version), "index.html"))
        )
            return null;
        return meta;
    }

    function bad() {
        const list = readJson(badFile, []);
        return Array.isArray(list) ? list : [];
    }

    function newestStaged() {
        let best = null;
        let names = [];
        try {
            names = fs.readdirSync(dir);
        } catch {
            return null;
        }
        const banned = bad();
        for (const name of names) {
            if (!stagedMeta(name) || banned.includes(name)) continue;
            if (best === null || compareVersions(name, best) > 0) best = name;
        }
        return best;
    }

    function prune(keep) {
        let names = [];
        try {
            names = fs.readdirSync(dir);
        } catch {
            return;
        }
        for (const name of names) {
            if (keep.includes(name) || !SAFE_VERSION.test(name)) continue;
            fs.rmSync(bundleDir(name), { recursive: true, force: true });
        }
        for (const name of names) {
            if (name.startsWith(".dl-") || name.startsWith(".tmp-"))
                fs.rmSync(path.join(dir, name), {
                    recursive: true,
                    force: true,
                });
        }
    }

    return {
        /**
         * The folder to serve, decided once at launch before the server starts;
         * null serves the one packed in the app. With `applyStaged`, a staged
         * newer bundle is taken now: nothing is on screen yet, so no reload.
         */
        activeRoot({ applyStaged }) {
            fs.mkdirSync(dir, { recursive: true });

            // Last time an unproven bundle never said it loaded: drop it.
            const attempt = readJson(bootFile, null);
            if (attempt) {
                const list = bad();
                if (attempt.version && !list.includes(attempt.version))
                    list.push(attempt.version);
                writeJsonAtomic(badFile, list);
                fs.rmSync(bootFile, { force: true });
                fs.rmSync(activeFile, { force: true });
                log("web bundle never loaded, dropped:", attempt.version);
            }

            let version = readJson(activeFile, {}).version;
            if (applyStaged) {
                const newest = newestStaged();
                if (
                    newest &&
                    compareVersions(newest, version ?? shellVersion) > 0
                ) {
                    version = newest;
                    writeJsonAtomic(activeFile, { version });
                    writeJsonAtomic(bootFile, { version });
                }
            }

            const usable =
                typeof version === "string" &&
                stagedMeta(version) &&
                !bad().includes(version) &&
                // A newer shell (reinstalled over us) carries a newer UI.
                compareVersions(version, shellVersion) > 0;
            if (!usable) {
                if (version !== undefined)
                    fs.rmSync(activeFile, { force: true });
                // A bundle staged for later stays; the rest is out of date.
                prune([newestStaged()].filter(Boolean));
                return null;
            }
            current = version;
            prune([version, newestStaged()].filter(Boolean));
            return bundleDir(version);
        },

        /** The page loaded: the bundle in use is good. */
        markReady() {
            fs.rmSync(bootFile, { force: true });
        },

        currentVersion: () => current,

        stagedVersion() {
            const v = newestStaged();
            return v && compareVersions(v, current) > 0 ? v : null;
        },

        /**
         * Ask the release feed. Resolves one of:
         *   { kind: "none" }                      nothing newer for this shell
         *   { kind: "shell", version }            newer, but needs the installer
         *   { kind: "bundle", version, staged }   a bundle this shell can take
         * Throws when the feed cannot be read or a manifest does not verify.
         */
        async check() {
            const release = await deps.fetchJson(deps.releaseUrl);
            const assets = Array.isArray(release?.assets) ? release.assets : [];
            const manifestAsset = assets.find(
                (a) => a?.name === MANIFEST_ASSET,
            );
            if (!manifestAsset) return { kind: "none" };
            const url = manifestAsset.browser_download_url;
            if (typeof url !== "string" || !url.startsWith(deps.assetUrlPrefix))
                throw new Error(
                    "web bundle manifest is not on the release host",
                );

            const manifest = await deps.fetchJson(url);
            if (!verifyManifest(manifest, deps.publicKey))
                throw new Error("web bundle manifest signature is invalid");
            if (!SAFE_VERSION.test(manifest.version))
                throw new Error("web bundle manifest has a bad version");
            // Never go back, however validly signed (a replayed old release).
            if (compareVersions(manifest.version, current) <= 0)
                return { kind: "none" };
            if (bad().includes(manifest.version)) return { kind: "none" };
            if (manifest.shellHash !== shellHash)
                return { kind: "shell", version: manifest.version };

            if (stagedMeta(manifest.version))
                return {
                    kind: "bundle",
                    version: manifest.version,
                    staged: true,
                };
            const asset = assets.find((a) => a?.name === manifest.file);
            const assetUrl = asset?.browser_download_url;
            if (
                typeof assetUrl !== "string" ||
                !assetUrl.startsWith(deps.assetUrlPrefix)
            )
                throw new Error("web bundle file is missing from the release");
            return {
                kind: "bundle",
                version: manifest.version,
                staged: false,
                manifest,
                assetUrl,
            };
        },

        /** Download, verify and unpack a bundle `check()` found, into staging. */
        async download(found, onProgress) {
            const { manifest, assetUrl, version } = found;
            fs.mkdirSync(dir, { recursive: true });
            const archive = path.join(dir, `.dl-${version}`);
            const unpacked = path.join(dir, `.tmp-${version}`);
            fs.rmSync(archive, { force: true });
            fs.rmSync(unpacked, { recursive: true, force: true });
            try {
                const maxBytes = Math.min(manifest.size, MAX_BUNDLE_BYTES);
                const got = await deps.download(assetUrl, archive, {
                    maxBytes,
                    onProgress,
                });
                if (
                    got.size !== manifest.size ||
                    got.sha512 !== manifest.sha512
                )
                    throw new Error("web bundle does not match its manifest");
                await unpackBundle(fs.readFileSync(archive), unpacked);
                writeJsonAtomic(path.join(unpacked, "meta.json"), {
                    version,
                    shellHash,
                });
                fs.rmSync(bundleDir(version), { recursive: true, force: true });
                fs.renameSync(unpacked, bundleDir(version));
            } finally {
                fs.rmSync(archive, { force: true });
                fs.rmSync(unpacked, { recursive: true, force: true });
            }
            prune([current, version]);
        },

        /**
         * Make the staged bundle the one served. The caller points its server
         * at the returned folder and reloads the page.
         */
        apply(version) {
            if (!stagedMeta(version)) throw new Error("no such staged bundle");
            writeJsonAtomic(activeFile, { version });
            writeJsonAtomic(bootFile, { version });
            current = version;
            return bundleDir(version);
        },
    };
}

module.exports = {
    createBundleUpdater,
    compareVersions,
    MANIFEST_ASSET,
    MAX_BUNDLE_BYTES,
};

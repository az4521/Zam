// OBS Studio's game-capture hook files, for the Windows native share helper.
// Downloaded on demand from OBS's own GitHub release: only the eight files
// the helper needs are taken out of the release zip (electron/zipRanges.cjs,
// HTTP Range requests), and each one must match its pinned SHA-256 before it
// is written. Any mismatch aborts the whole install and deletes the download.
// The files are OBS Studio's, GPL-2.0-or-later, see the links in Settings.

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const {
    TAIL_BYTES,
    LOCAL_SIZE,
    locateCentralDirectory,
    readZip64EndRecord,
    parseCentralDirectory,
    readLocalHeader,
    inflateEntry,
} = require("./zipRanges.cjs");

const OBS_VERSION = "33.0.3";
const ARCHIVE_URL =
    "https://github.com/obsproject/obs-studio/releases/download/33.0.3/OBS-Studio-33.0.3-Windows-x64.zip";
const ARCHIVE_SIZE = 235774237;
const LICENSE_URL =
    "https://github.com/obsproject/obs-studio/blob/33.0.3/COPYING";
const SOURCE_URL = "https://github.com/obsproject/obs-studio/tree/33.0.3";
const SOURCE_TARBALL_URL =
    "https://github.com/obsproject/obs-studio/releases/download/33.0.3/OBS-Studio-33.0.3-Sources.tar.gz";

const DIR_PREFIX = "core/win-capture/data/";
// Each file: its name in the install folder (the helper's --obs-hook-dir),
// and the SHA-256 of the extracted file. zipPath is its path in the archive.
const FILES = [
    {
        file: "graphics-hook32.dll",
        sha256: "e51b81645df3b06458547d9433eaa6b679b1e8feb214ec14ecdfeb23e2a34b66",
    },
    {
        file: "graphics-hook64.dll",
        sha256: "1261cf476829354a3831e97bc77b9af6a1340832e3ed4e079dc2b98b79857d2a",
    },
    {
        file: "inject-helper32.exe",
        sha256: "2bcd432d538ef4a9999ff9be5be1cd9079dff94eb60c7e1ad0886bf6a822d122",
    },
    {
        file: "inject-helper64.exe",
        sha256: "4ecc338f9232817f19a3f0228bd3de4fb8bddabffa65a94b9227c02a1545bb0d",
    },
    {
        file: "get-graphics-offsets32.exe",
        sha256: "d761a8abfc2afb8392d561766a06a7d44d072558c49996dc78952ca221b6ad13",
    },
    {
        file: "get-graphics-offsets64.exe",
        sha256: "46aa1bd9b246d5165a27b597b791b3b6d5e8bf6a1b4008f510bc9995cccebdac",
    },
    {
        file: "obs-vulkan32.json",
        sha256: "c16e0707ae66ad71e8a0720aeb6e6997a1017f19762333452aef692115a9ab41",
    },
    {
        file: "obs-vulkan64.json",
        sha256: "7b6b0813fb58b276847a8583eb5c3f94aee7d7ad0ae3a1ef6133d5d8771f20f4",
    },
].map((f) => ({ ...f, zipPath: DIR_PREFIX + f.file }));

// No single file is anywhere near this; a larger entry is a bad archive.
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

function sha256(buf) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}

function errorText(err) {
    return err instanceof Error ? err.message : String(err);
}

// The manager. `app` supplies userData; `fetchFn` is fetch-compatible
// (Electron's net.fetch in the app, the global fetch elsewhere).
function createObsHook({
    app,
    fetchFn,
    platform = process.platform,
    arch = process.arch,
}) {
    const supported = platform === "win32" && arch === "x64";
    const installDir = () =>
        path.join(app.getPath("userData"), "obs-hook", OBS_VERSION);

    // Hash result for the current install, keyed by each file's path, size
    // and mtime: hashing happens once unless a file changes.
    let verified = null;
    let busy = null;
    let lastError = null;

    function installedNow() {
        if (!supported) return false;
        const dir = installDir();
        const paths = FILES.map((f) => path.join(dir, f.file));
        const stats = [];
        for (const p of paths) {
            try {
                const st = fs.statSync(p);
                if (!st.isFile()) return false;
                stats.push(st);
            } catch {
                return false;
            }
        }
        const key = paths
            .map((p, i) => `${p}:${stats[i].size}:${stats[i].mtimeMs}`)
            .join("|");
        if (verified && verified.key === key) return verified.ok;
        const ok = paths.every((p, i) => {
            try {
                return sha256(fs.readFileSync(p)) === FILES[i].sha256;
            } catch {
                return false;
            }
        });
        verified = { key, ok };
        return ok;
    }

    function status() {
        const out = {
            supported,
            installed: installedNow(),
            version: OBS_VERSION,
            busy: busy !== null,
        };
        if (lastError) out.error = lastError;
        return out;
    }

    // The install folder when the files are present and verified, else null.
    // The native share helper is pointed here (--obs-hook-dir).
    function hookDir() {
        return installedNow() ? installDir() : null;
    }

    // Range-reads the archive. `state.url` is the URL after redirects, taken
    // from the first response and used for every later request.
    function makeReader(state) {
        return async function read(start, length) {
            if (length === 0) return Buffer.alloc(0);
            const end = start + length - 1;
            if (start < 0 || end >= ARCHIVE_SIZE) {
                throw new Error("archive range out of bounds");
            }
            const res = await fetchFn(state.url, {
                headers: { Range: `bytes=${start}-${end}` },
                redirect: "follow",
                cache: "no-store",
            });
            if (res.url) state.url = res.url;
            if (res.status !== 206) {
                throw new Error(`archive request failed (${res.status})`);
            }
            const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(
                res.headers.get("content-range") || "",
            );
            if (!m) throw new Error("archive did not answer a range request");
            if (
                Number(m[1]) !== start ||
                Number(m[2]) !== end ||
                Number(m[3]) !== ARCHIVE_SIZE
            ) {
                throw new Error("archive changed while downloading");
            }
            const data = Buffer.from(await res.arrayBuffer());
            if (data.length !== length) {
                throw new Error("archive range came back short");
            }
            return data;
        };
    }

    // Writes every wanted file into `dest`, each one only after its hash
    // matches. Throws on the first problem.
    async function downloadInto(dest) {
        const state = { url: ARCHIVE_URL };
        const read = makeReader(state);
        const tailStart = ARCHIVE_SIZE - TAIL_BYTES;
        const tail = await read(tailStart, TAIL_BYTES);
        let cd = locateCentralDirectory(tail, ARCHIVE_SIZE);
        if (cd.zip64Locator !== undefined) {
            cd = readZip64EndRecord(await read(cd.zip64Locator, 56));
        }
        const cdBuf = await read(cd.cdOffset, cd.cdSize);
        const entries = parseCentralDirectory(cdBuf, cd.count);
        const byName = new Map(entries.map((e) => [e.name, e]));

        for (const f of FILES) {
            const entry = byName.get(f.zipPath);
            if (!entry) throw new Error(`archive has no ${f.zipPath}`);
            if (entry.compSize > MAX_ENTRY_BYTES) {
                throw new Error(`${f.zipPath} is too large`);
            }
            const head = await read(entry.localOffset, LOCAL_SIZE);
            const { dataOffset } = readLocalHeader(head);
            const packed = await read(
                entry.localOffset + dataOffset,
                entry.compSize,
            );
            const data = inflateEntry(entry, packed);
            if (sha256(data) !== f.sha256) {
                throw new Error(`${f.file} does not match OBS ${OBS_VERSION}`);
            }
            await fs.promises.writeFile(path.join(dest, f.file), data, {
                flag: "wx",
            });
        }
    }

    async function runInstall() {
        const target = installDir();
        const parent = path.dirname(target);
        await fs.promises.mkdir(parent, { recursive: true });
        const staging = await fs.promises.mkdtemp(
            path.join(parent, ".download-"),
        );
        try {
            await downloadInto(staging);
            await fs.promises.rm(target, { recursive: true, force: true });
            await fs.promises.rename(staging, target);
            verified = null;
        } finally {
            await fs.promises
                .rm(staging, { recursive: true, force: true })
                .catch(() => {});
        }
    }

    // Downloads and verifies the files. Concurrent calls share one run.
    // Resolves with the status; rejects with the reason, leaving nothing
    // unverified on disk.
    function install() {
        if (!supported) {
            return Promise.reject(
                new Error("OBS game capture needs Windows x64"),
            );
        }
        if (busy) return busy.then(() => status());
        if (installedNow()) return Promise.resolve(status());
        const run = (async () => {
            try {
                await runInstall();
                lastError = null;
            } catch (err) {
                lastError = errorText(err);
                throw err;
            } finally {
                busy = null;
            }
        })();
        busy = run;
        return run.then(() => status());
    }

    // Deletes the install folder. Rejects while an install is running.
    async function remove() {
        if (busy) throw new Error("OBS game capture is downloading");
        verified = null;
        lastError = null;
        await fs.promises.rm(installDir(), { recursive: true, force: true });
        return status();
    }

    return { status, install, remove, hookDir, installDir };
}

module.exports = {
    createObsHook,
    OBS_VERSION,
    ARCHIVE_URL,
    ARCHIVE_SIZE,
    FILES,
    LICENSE_URL,
    SOURCE_URL,
    SOURCE_TARBALL_URL,
    sha256,
};

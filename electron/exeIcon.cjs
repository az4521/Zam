// Finds a real icon for a running game's executable on Linux.
//
// Electron's app.getFileIcon() asks the desktop's icon theme for the file's
// MIME type, so on Linux every executable comes back as the stock "executable"
// icon, and a game with no Discord icon ended up with that on its profile.
// Instead this looks for, in order:
//
//   1. a .desktop launcher whose Exec line runs the executable, and the icon
//      its Icon= names, PNG or SVG (native and Flatpak games, shortcuts),
//   2. Steam's own icon for the game, when the executable sits in a Steam
//      library (steamapps/common/<dir>), and
//   3. an icon stored in the resources of a Windows .exe (Wine and Proton
//      games), either PNG-compressed or an old-style bitmap, converted to PNG.
//
// Returns { type, data } like presenceImages expects (type may be
// image/svg+xml, which the page rasterizes), or null when nothing real is
// found, so the card shows no picture rather than a wrong one.

const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { execFile } = require("child_process");

const MAX_ICON_BYTES = 4 * 1024 * 1024;
const HOST_TIMEOUT_MS = 8000;
const HOST_MAX_BUFFER = 6 * 1024 * 1024;
const MAX_SVG_BYTES = 512 * 1024;
const MAX_RSRC_BYTES = 64 * 1024 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const RT_ICON = 3;
const SVG = "image/svg+xml";

// ── .desktop launchers ────────────────────────────────────────────────────

function dataDirs(env, home) {
    const dirs = [
        env.XDG_DATA_HOME || path.join(home, ".local/share"),
        ...(env.XDG_DATA_DIRS || "/usr/local/share:/usr/share").split(":"),
        "/var/lib/flatpak/exports/share",
        path.join(home, ".local/share/flatpak/exports/share"),
    ];
    return [...new Set(dirs.filter(Boolean))];
}

/** The key=value pairs of a .desktop file's [Desktop Entry] group. */
function parseDesktopEntry(text) {
    const out = {};
    let inEntry = false;
    for (const line of text.split(/\r?\n/)) {
        if (line.startsWith("[")) {
            inEntry = line.trim() === "[Desktop Entry]";
            continue;
        }
        if (!inEntry) continue;
        const eq = line.indexOf("=");
        if (eq > 0 && !line.startsWith("#") && !(line.slice(0, eq) in out))
            out[line.slice(0, eq)] = line.slice(eq + 1).trim();
    }
    return out;
}

/** Whether a desktop entry's Exec line launches this executable. */
function execRuns(exec, exe) {
    if (!exec) return false;
    const base = path.basename(exe).toLowerCase();
    const full = exe.toLowerCase();
    // Split on spaces, ignoring quotes: enough to spot the program and a
    // `wine game.exe` / `proton run game.exe` argument.
    for (const raw of exec.split(/\s+/)) {
        const word = raw.replace(/^["']|["']$/g, "").toLowerCase();
        if (!word || word.startsWith("%")) continue;
        if (word === full || path.basename(word) === base) return true;
    }
    return false;
}

function pngSize(file) {
    try {
        const fd = fs.openSync(file, "r");
        try {
            const head = Buffer.alloc(24);
            if (fs.readSync(fd, head, 0, 24, 0) < 24) return 0;
            if (!head.subarray(0, 8).equals(PNG_MAGIC)) return 0;
            return head.readUInt32BE(16);
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return 0;
    }
}

function svgOk(file) {
    try {
        const st = fs.statSync(file);
        return st.isFile() && st.size > 0 && st.size <= MAX_SVG_BYTES;
    } catch {
        return false;
    }
}

/**
 * { file, type } for an icon name: its largest PNG, or an SVG when there is no
 * PNG of a useful size.
 */
function resolveIconName(name, dirs, home) {
    if (path.isAbsolute(name)) {
        if (/\.svg$/i.test(name))
            return svgOk(name) ? { file: name, type: SVG } : null;
        return pngSize(name) ? { file: name, type: "image/png" } : null;
    }
    const roots = [
        ...dirs.map((d) => path.join(d, "icons")),
        path.join(home, ".icons"),
    ];
    let best = null;
    let bestSize = 0;
    let svg = null;
    const consider = (file) => {
        const size = pngSize(file);
        if (size > bestSize) {
            best = file;
            bestSize = size;
        }
    };
    for (const root of roots) {
        let sizes;
        try {
            sizes = fs.readdirSync(path.join(root, "hicolor"));
        } catch {
            continue;
        }
        for (const dir of sizes) {
            consider(path.join(root, "hicolor", dir, "apps", `${name}.png`));
            const vector = path.join(
                root,
                "hicolor",
                dir,
                "apps",
                `${name}.svg`,
            );
            if (!svg && svgOk(vector)) svg = vector;
        }
    }
    for (const d of dirs) {
        consider(path.join(d, "pixmaps", `${name}.png`));
        const vector = path.join(d, "pixmaps", `${name}.svg`);
        if (!svg && svgOk(vector)) svg = vector;
    }
    if (best && (bestSize >= 64 || !svg))
        return { file: best, type: "image/png" };
    return svg ? { file: svg, type: SVG } : null;
}

function desktopIcon(exe, env, home) {
    const dirs = dataDirs(env, home);
    for (const dir of dirs) {
        const appsDir = path.join(dir, "applications");
        let files;
        try {
            files = fs.readdirSync(appsDir);
        } catch {
            continue;
        }
        for (const file of files) {
            if (!file.endsWith(".desktop")) continue;
            try {
                const entry = parseDesktopEntry(
                    fs.readFileSync(path.join(appsDir, file), "utf8"),
                );
                if (!entry.Icon || !execRuns(entry.Exec, exe)) continue;
                const found = resolveIconName(entry.Icon, dirs, home);
                if (found) return found;
            } catch {
                // Unreadable launcher: try the next.
            }
        }
    }
    return null;
}

// ── Steam library icons ───────────────────────────────────────────────────

function steamRoots(home) {
    return [
        path.join(home, ".local/share/Steam"),
        path.join(home, ".steam/steam"),
        path.join(home, ".steam/root"),
        path.join(home, ".var/app/com.valvesoftware.Steam/.local/share/Steam"),
        path.join(home, "snap/steam/common/.local/share/Steam"),
    ];
}

/** The app id of the Steam game installed in <steamapps>/common/<dir>. */
function steamAppId(steamapps, dir) {
    let files;
    try {
        files = fs.readdirSync(steamapps);
    } catch {
        return null;
    }
    for (const f of files) {
        const m = /^appmanifest_(\d+)\.acf$/.exec(f);
        if (!m) continue;
        try {
            const text = fs.readFileSync(path.join(steamapps, f), "utf8");
            const install = /"installdir"\s+"([^"]*)"/i.exec(text);
            if (install && install[1].toLowerCase() === dir.toLowerCase())
                return m[1];
        } catch {
            // Unreadable manifest: try the next.
        }
    }
    return null;
}

/** The icon Steam cached for the game this executable belongs to. */
function steamIcon(exe, home) {
    const norm = exe.replaceAll("\\", "/");
    const m = /^(.*\/steamapps)\/common\/([^/]+)\//i.exec(norm);
    if (!m) return null;
    const appId = steamAppId(m[1], m[2]);
    if (!appId) return null;
    // Libraries on other drives share the Steam install's cache.
    for (const root of [path.dirname(m[1]), ...steamRoots(home)]) {
        const dir = path.join(root, "appcache/librarycache", appId);
        const old = path.join(dir, `${appId}_icon.jpg`);
        try {
            if (fs.statSync(old).isFile())
                return { file: old, type: "image/jpeg" };
        } catch {
            // Not the older layout.
        }
        // Newer Steam keeps the small icon under its 40-hex content hash,
        // directly in the app's folder or one folder down.
        const hit = findHashedIcon(dir);
        if (hit) return hit;
    }
    return null;
}

function findHashedIcon(dir, depth = 0) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return null;
    }
    for (const e of entries) {
        if (e.isFile() && /^[0-9a-f]{40}\.jpg$/i.test(e.name))
            return { file: path.join(dir, e.name), type: "image/jpeg" };
    }
    if (depth < 1)
        for (const e of entries) {
            if (!e.isDirectory()) continue;
            const hit = findHashedIcon(path.join(dir, e.name), depth + 1);
            if (hit) return hit;
        }
    return null;
}

// ── Bitmap icons ──────────────────────────────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(buf) {
    let c = 0xffffffff;
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
}

function encodePng(width, height, rgba) {
    const rows = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y++) {
        rgba.copy(
            rows,
            y * (width * 4 + 1) + 1,
            y * width * 4,
            (y + 1) * width * 4,
        );
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    return Buffer.concat([
        PNG_MAGIC,
        pngChunk("IHDR", ihdr),
        pngChunk("IDAT", zlib.deflateSync(rows)),
        pngChunk("IEND", Buffer.alloc(0)),
    ]);
}

/**
 * An RT_ICON that holds a bitmap (a DIB with the height doubled, the colours
 * first and a 1-bit transparency mask after) as PNG bytes, or null for formats
 * not handled (compressed bitmaps, odd depths).
 */
function dibToPng(dib) {
    if (dib.length < 40 || dib.readUInt32LE(0) !== 40) return null;
    const width = dib.readInt32LE(4);
    const height = dib.readInt32LE(8) / 2;
    const bpp = dib.readUInt16LE(14);
    if (dib.readUInt32LE(16) !== 0) return null; // BI_RGB only
    if (width < 1 || width > 512 || height < 1 || height > 512) return null;
    if (![1, 4, 8, 24, 32].includes(bpp) || !Number.isInteger(height))
        return null;

    let paletteAt = 40;
    let colours = 0;
    if (bpp <= 8) {
        colours = dib.readUInt32LE(32) || 1 << bpp;
        if (colours > 1 << bpp) return null;
    }
    const xorAt = paletteAt + colours * 4;
    const xorStride = ((width * bpp + 31) >> 5) * 4;
    const andAt = xorAt + xorStride * height;
    const andStride = ((width + 31) >> 5) * 4;
    if (andAt > dib.length) return null;
    const hasMask = andAt + andStride * height <= dib.length;

    const rgba = Buffer.alloc(width * height * 4);
    let anyAlpha = false;
    for (let y = 0; y < height; y++) {
        const src = xorAt + (height - 1 - y) * xorStride; // rows run bottom-up
        for (let x = 0; x < width; x++) {
            const o = (y * width + x) * 4;
            let r,
                g,
                b,
                a = 255;
            if (bpp === 32 || bpp === 24) {
                const p = src + x * (bpp / 8);
                b = dib[p];
                g = dib[p + 1];
                r = dib[p + 2];
                if (bpp === 32) {
                    a = dib[p + 3];
                    if (a) anyAlpha = true;
                }
            } else {
                const bit = x * bpp;
                const byte = dib[src + (bit >> 3)];
                const idx = (byte >> (8 - bpp - (bit & 7))) & ((1 << bpp) - 1);
                if (idx >= colours) return null;
                const p = paletteAt + idx * 4;
                b = dib[p];
                g = dib[p + 1];
                r = dib[p + 2];
            }
            rgba[o] = r;
            rgba[o + 1] = g;
            rgba[o + 2] = b;
            rgba[o + 3] = a;
        }
    }
    // Old-style icons say "transparent" in the mask; 32-bit ones with real
    // alpha already say it themselves.
    if (hasMask && !(bpp === 32 && anyAlpha)) {
        for (let y = 0; y < height; y++) {
            const row = andAt + (height - 1 - y) * andStride;
            for (let x = 0; x < width; x++) {
                if (dib[row + (x >> 3)] & (0x80 >> (x & 7)))
                    rgba[(y * width + x) * 4 + 3] = 0;
                else if (bpp === 32) rgba[(y * width + x) * 4 + 3] = 255;
            }
        }
    }
    return encodePng(width, height, rgba);
}

// ── Icons inside a Windows executable ─────────────────────────────────

/** The largest icon in a PE file's resources, as PNG bytes, or null. */
function peIcon(exe) {
    let fd;
    try {
        fd = fs.openSync(exe, "r");
        const read = (pos, len) => {
            const buf = Buffer.alloc(len);
            const n = fs.readSync(fd, buf, 0, len, pos);
            return n === len ? buf : null;
        };

        const dos = read(0, 64);
        if (!dos || dos.readUInt16LE(0) !== 0x5a4d) return null; // "MZ"
        const peAt = dos.readUInt32LE(0x3c);
        const nt = read(peAt, 24);
        if (!nt || nt.readUInt32LE(0) !== 0x00004550) return null; // "PE\0\0"
        const sectionCount = nt.readUInt16LE(6);
        const optSize = nt.readUInt16LE(20);
        const opt = read(peAt + 24, optSize);
        if (!opt || sectionCount === 0 || sectionCount > 96) return null;
        const magic = opt.readUInt16LE(0);
        const dirsAt = magic === 0x20b ? 112 : magic === 0x10b ? 96 : -1;
        if (dirsAt < 0 || opt.length < dirsAt + 24) return null;
        const rsrcRva = opt.readUInt32LE(dirsAt + 16); // data directory 2
        if (!rsrcRva) return null;

        const table = read(peAt + 24 + optSize, sectionCount * 40);
        if (!table) return null;
        let base = null;
        let length = 0;
        for (let i = 0; i < sectionCount; i++) {
            const va = table.readUInt32LE(i * 40 + 12);
            const rawSize = table.readUInt32LE(i * 40 + 16);
            const rawPtr = table.readUInt32LE(i * 40 + 20);
            if (rsrcRva >= va && rsrcRva < va + rawSize) {
                base = rawPtr + (rsrcRva - va);
                length = Math.min(rawSize - (rsrcRva - va), MAX_RSRC_BYTES);
                break;
            }
        }
        if (base === null || length < 16) return null;
        const rsrc = read(base, length);
        if (!rsrc) return null;

        const entriesAt = (off) => {
            if (off < 0 || off + 16 > rsrc.length) return [];
            const n = Math.min(
                rsrc.readUInt16LE(off + 12) + rsrc.readUInt16LE(off + 14),
                512,
            );
            const out = [];
            for (let i = 0; i < n; i++) {
                const at = off + 16 + i * 8;
                if (at + 8 > rsrc.length) break;
                const target = rsrc.readUInt32LE(at + 4);
                out.push({
                    id: rsrc.readUInt32LE(at),
                    sub: (target & 0x80000000) !== 0,
                    offset: target & 0x7fffffff,
                });
            }
            return out;
        };

        let best = null;
        for (const type of entriesAt(0)) {
            if (type.id !== RT_ICON || !type.sub) continue;
            for (const name of entriesAt(type.offset)) {
                if (!name.sub) continue;
                for (const lang of entriesAt(name.offset)) {
                    if (lang.sub || lang.offset + 8 > rsrc.length) continue;
                    const rva = rsrc.readUInt32LE(lang.offset);
                    const size = rsrc.readUInt32LE(lang.offset + 4);
                    const at = rva - rsrcRva;
                    if (at < 0 || size < 24 || at + size > rsrc.length)
                        continue;
                    if (size > MAX_ICON_BYTES) continue;
                    const data = rsrc.subarray(at, at + size);
                    let width;
                    let png = null;
                    if (data.subarray(0, 8).equals(PNG_MAGIC)) {
                        width = data.readUInt32BE(16);
                        png = data;
                    } else if (
                        data.length >= 40 &&
                        data.readUInt32LE(0) === 40
                    ) {
                        width = data.readInt32LE(4);
                    } else continue;
                    if (best && width <= best.width) continue;
                    png = png ?? dibToPng(data);
                    if (png) best = { width, data: png };
                }
            }
        }
        return best ? Buffer.from(best.data) : null;
    } catch {
        return null;
    } finally {
        if (fd !== undefined) {
            try {
                fs.closeSync(fd);
            } catch {
                // Nothing to do.
            }
        }
    }
}

function readIcon({ file, type }) {
    try {
        const data = fs.readFileSync(file);
        const cap = type === SVG ? MAX_SVG_BYTES : MAX_ICON_BYTES;
        if (data.length && data.length <= cap)
            return { type, data: new Uint8Array(data) };
    } catch {
        // Unreadable: try the next source.
    }
    return null;
}

/** { type, data } for an executable's real icon on Linux, or null. */
function linuxExeIcon(exe, { env = process.env, home = os.homedir() } = {}) {
    if (typeof exe !== "string" || !exe) return null;
    const launcher = desktopIcon(exe, env, home);
    const fromLauncher = launcher && readIcon(launcher);
    if (fromLauncher) return fromLauncher;
    const steam = steamIcon(exe, home);
    const fromSteam = steam && readIcon(steam);
    if (fromSteam) return fromSteam;
    if (/\.exe$/i.test(exe)) {
        const data = peIcon(exe);
        if (data) return { type: "image/png", data: new Uint8Array(data) };
    }
    return null;
}

// ── Steam icons on the host, from inside Flatpak ──────────────────────────

// Runs on the host through flatpak-spawn: $1 is the executable path. Prints
// the MIME type on one line and the icon as base64 on the next, or nothing.
const HOST_STEAM_SCRIPT = `
exe=$(printf '%s' "$1" | tr '\\134' '/')
lib=
dir=
case $exe in
*/steamapps/common/*/*)
    lib=\${exe%/steamapps/common/*}
    rest=\${exe##*/steamapps/common/}
    dir=\${rest%%/*}
    ;;
esac
want=$(printf '%s' "$dir" | tr 'A-Z' 'a-z')
id=
if [ -n "$dir" ]; then
    for f in "$lib"/steamapps/appmanifest_*.acf; do
        [ -f "$f" ] || continue
        got=$(tr -d '\\015' < "$f" | awk -F'"' 'tolower($2) == "installdir" { print tolower($4); exit }')
        if [ -n "$got" ] && [ "$got" = "$want" ]; then
            id=\${f##*appmanifest_}
            id=\${id%.acf}
            break
        fi
    done
fi
# Steam's running-app id only fits Windows executables (Proton); a native
# program that is not in a Steam library must not borrow the game's icon.
case $exe in
*.[eE][xX][eE]) ;;
*) [ -n "$id" ] || exit 0 ;;
esac
if [ -z "$id" ]; then
    for r in "$HOME/.steam/registry.vdf" "$HOME/.var/app/com.valvesoftware.Steam/.steam/registry.vdf"; do
        [ -f "$r" ] || continue
        got=$(tr -d '\\015' < "$r" | awk -F'"' 'tolower($2) == "runningappid" { print $4; exit }')
        case $got in
        '' | 0 | *[!0-9]*) ;;
        *) id=$got; break ;;
        esac
    done
fi
case $id in
'' | *[!0-9]*) exit 0 ;;
esac
emit() {
    printf '%s\\n' "$1"
    base64 -w0 < "$2"
    printf '\\n'
}
set -- "$lib" "$HOME/.local/share/Steam" "$HOME/.steam/steam" "$HOME/.steam/root" "$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam" "$HOME/snap/steam/common/.local/share/Steam"
for root in "$@"; do
    [ -n "$root" ] || continue
    d=$root/appcache/librarycache/$id
    if [ -f "$d/\${id}_icon.jpg" ]; then
        emit image/jpeg "$d/\${id}_icon.jpg"
        exit 0
    fi
    for f in "$d"/*.jpg "$d"/*/*.jpg; do
        [ -f "$f" ] || continue
        b=\${f##*/}
        b=\${b%.jpg}
        [ \${#b} -eq 40 ] || continue
        case $b in
        *[!0-9a-fA-F]*) continue ;;
        esac
        emit image/jpeg "$f"
        exit 0
    done
done
best=
bestsize=-1
for ic in "$HOME/.local/share/icons" "$HOME/.var/app/com.valvesoftware.Steam/.local/share/icons"; do
    for f in "$ic"/hicolor/*/apps/steam_icon_$id.png; do
        [ -f "$f" ] || continue
        s=\${f%/apps/*}
        s=\${s##*/}
        s=\${s%%x*}
        case $s in
        '' | *[!0-9]*) s=0 ;;
        esac
        if [ "$s" -gt "$bestsize" ]; then
            best=$f
            bestsize=$s
        fi
    done
done
if [ -n "$best" ]; then
    emit image/png "$best"
fi
exit 0
`;

/** { type, data } from the host script's output, or null. */
function parseHostIcon(out) {
    try {
        if (typeof out !== "string") return null;
        const [type = "", b64 = ""] = out.split("\n").map((l) => l.trim());
        if (type !== "image/jpeg" && type !== "image/png") return null;
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
        const buf = Buffer.from(b64, "base64");
        if (buf.length === 0 || buf.length > MAX_ICON_BYTES) return null;
        return { type, data: new Uint8Array(buf) };
    } catch {
        return null;
    }
}

function execHost(file, args) {
    return new Promise((resolve, reject) => {
        execFile(
            file,
            args,
            {
                windowsHide: true,
                timeout: HOST_TIMEOUT_MS,
                maxBuffer: HOST_MAX_BUFFER,
            },
            (err, stdout) => (err ? reject(err) : resolve(String(stdout))),
        );
    });
}

/**
 * The Steam icon for an executable, read on the host by running one shell
 * script through flatpak-spawn (the sandbox cannot see the host's Steam
 * files). `run(file, args)` resolves to the script's stdout. Never throws.
 */
async function hostSteamIcon(exe, run = execHost) {
    try {
        if (typeof exe !== "string" || !exe) return null;
        const out = await run("flatpak-spawn", [
            "--host",
            "sh",
            "-c",
            HOST_STEAM_SCRIPT,
            "sh",
            exe,
        ]);
        return parseHostIcon(out);
    } catch {
        return null;
    }
}

/**
 * linuxExeIcon, then, inside Flatpak only, the host's Steam icon. Never throws.
 */
async function linuxExeIconAsync(
    exe,
    { env = process.env, home = os.homedir(), run } = {},
) {
    const local = linuxExeIcon(exe, { env, home });
    if (local || !env.FLATPAK_ID) return local;
    return hostSteamIcon(exe, run);
}

module.exports = {
    linuxExeIcon,
    linuxExeIconAsync,
    hostSteamIcon,
    parseHostIcon,
    HOST_STEAM_SCRIPT,
    parseDesktopEntry,
    execRuns,
    peIcon,
    dibToPng,
    steamIcon,
};

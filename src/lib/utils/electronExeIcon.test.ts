import { describe, it, expect, afterEach } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const {
    linuxExeIcon,
    linuxExeIconAsync,
    hostSteamIcon,
    parseHostIcon,
    HOST_STEAM_SCRIPT,
    parseDesktopEntry,
    execRuns,
    peIcon,
    dibToPng,
} = require(join(__dirname, "../../../electron/exeIcon.cjs"));

type HostRun = (file: string, args: string[]) => Promise<string>;
const b64 = (s: string) => Buffer.from(s).toString("base64");

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true });
});
const tmp = () => {
    const d = mkdtempSync(join(tmpdir(), "zam-exeicon-"));
    dirs.push(d);
    return d;
};

/** A minimal PNG header (signature + IHDR width/height) with a payload. */
function fakePng(width: number): Buffer {
    const b = Buffer.alloc(40);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b);
    b.writeUInt32BE(13, 8);
    b.write("IHDR", 12, "ascii");
    b.writeUInt32BE(width, 16);
    b.writeUInt32BE(width, 20);
    return b;
}

/** A tiny PE32+ file whose .rsrc holds the given RT_ICON payloads. */
function fakeExe(icons: Buffer[]): Buffer {
    const rsrcRva = 0x1000;
    const rsrcRaw = 0x200;
    // Resource tree: root(type) -> RT_ICON dir(name ids) -> lang dir -> data
    const n = icons.length;
    const rootSize = 16 + 8;
    const typeDirSize = 16 + 8 * n;
    const langDirSize = 16 + 8;
    const entriesBase = rootSize + typeDirSize + langDirSize * n;
    const dataBase = entriesBase + 16 * n;
    const rsrc = Buffer.alloc(
        dataBase + icons.reduce((a, i) => a + i.length, 0),
    );
    rsrc.writeUInt16LE(1, 14); // root: one id entry
    rsrc.writeUInt32LE(3, 16); // RT_ICON
    rsrc.writeUInt32LE((0x80000000 | rootSize) >>> 0, 20);
    rsrc.writeUInt16LE(n, rootSize + 14);
    let dataAt = dataBase;
    icons.forEach((icon, i) => {
        const langAt = rootSize + typeDirSize + langDirSize * i;
        rsrc.writeUInt32LE(i + 1, rootSize + 16 + i * 8);
        rsrc.writeUInt32LE((0x80000000 | langAt) >>> 0, rootSize + 20 + i * 8);
        rsrc.writeUInt16LE(1, langAt + 14);
        rsrc.writeUInt32LE(0x409, langAt + 16);
        rsrc.writeUInt32LE(entriesBase + 16 * i, langAt + 20);
        rsrc.writeUInt32LE(rsrcRva + dataAt, entriesBase + 16 * i);
        rsrc.writeUInt32LE(icon.length, entriesBase + 16 * i + 4);
        icon.copy(rsrc, dataAt);
        dataAt += icon.length;
    });

    const optSize = 240;
    const head = Buffer.alloc(rsrcRaw);
    head.write("MZ", 0, "ascii");
    head.writeUInt32LE(0x80, 0x3c);
    head.writeUInt32LE(0x00004550, 0x80);
    head.writeUInt16LE(1, 0x80 + 6);
    head.writeUInt16LE(optSize, 0x80 + 20);
    const opt = 0x80 + 24;
    head.writeUInt16LE(0x20b, opt);
    head.writeUInt32LE(rsrcRva, opt + 112 + 16);
    head.writeUInt32LE(rsrc.length, opt + 112 + 20);
    const sec = opt + optSize;
    head.write(".rsrc", sec, "ascii");
    head.writeUInt32LE(rsrc.length, sec + 8);
    head.writeUInt32LE(rsrcRva, sec + 12);
    head.writeUInt32LE(rsrc.length, sec + 16);
    head.writeUInt32LE(rsrcRaw, sec + 20);
    return Buffer.concat([head, rsrc]);
}

describe("peIcon", () => {
    it("returns the largest PNG icon in the executable", () => {
        const dir = tmp();
        const exe = join(dir, "game.exe");
        writeFileSync(exe, fakeExe([fakePng(32), fakePng(256), fakePng(64)]));
        const icon = peIcon(exe);
        expect(icon).not.toBeNull();
        expect(icon.readUInt32BE(16)).toBe(256);
    });

    it("skips icons that are not PNG, and non-executables", () => {
        const dir = tmp();
        const exe = join(dir, "old.exe");
        writeFileSync(exe, fakeExe([Buffer.alloc(64, 1)]));
        expect(peIcon(exe)).toBeNull();
        const junk = join(dir, "junk.exe");
        writeFileSync(junk, "not an executable");
        expect(peIcon(junk)).toBeNull();
        expect(peIcon(join(dir, "missing.exe"))).toBeNull();
    });
});

describe("desktop launchers", () => {
    it("parses only the Desktop Entry group", () => {
        const e = parseDesktopEntry(
            "[Desktop Action x]\nExec=no\n[Desktop Entry]\nExec=/g/run %U\nIcon=game\n",
        );
        expect(e).toEqual({ Exec: "/g/run %U", Icon: "game" });
    });

    it("matches the executable by path or file name", () => {
        expect(execRuns("/games/foo/bar %U", "/games/foo/bar")).toBe(true);
        expect(execRuns('wine "C:/x/Game.exe"', "/p/game.exe")).toBe(true);
        expect(execRuns("other %f", "/games/foo/bar")).toBe(false);
    });

    it("uses the launcher's themed icon", () => {
        const home = tmp();
        const share = join(home, "share");
        mkdirSync(join(share, "applications"), { recursive: true });
        mkdirSync(join(share, "icons/hicolor/48x48/apps"), { recursive: true });
        mkdirSync(join(share, "icons/hicolor/256x256/apps"), {
            recursive: true,
        });
        writeFileSync(
            join(share, "applications/g.desktop"),
            "[Desktop Entry]\nExec=/games/foo/bar\nIcon=bar-icon\n",
        );
        writeFileSync(
            join(share, "icons/hicolor/48x48/apps/bar-icon.png"),
            fakePng(48),
        );
        writeFileSync(
            join(share, "icons/hicolor/256x256/apps/bar-icon.png"),
            fakePng(256),
        );
        const icon = linuxExeIcon("/games/foo/bar", {
            env: { XDG_DATA_HOME: share, XDG_DATA_DIRS: join(home, "none") },
            home,
        });
        expect(icon?.type).toBe("image/png");
        expect(Buffer.from(icon.data).readUInt32BE(16)).toBe(256);
    });

    it("returns null rather than a generic icon when nothing matches", () => {
        const home = tmp();
        expect(
            linuxExeIcon("/games/foo/bar", {
                env: { XDG_DATA_HOME: home, XDG_DATA_DIRS: home },
                home,
            }),
        ).toBeNull();
    });
});

/** A 2x2 32-bit DIB icon: opaque red, green / blue, transparent. */
function fakeDib(): Buffer {
    const b = Buffer.alloc(40 + 16 + 8);
    b.writeUInt32LE(40, 0);
    b.writeInt32LE(2, 4);
    b.writeInt32LE(4, 8); // height doubled
    b.writeUInt16LE(1, 12);
    b.writeUInt16LE(32, 14);
    // Rows are bottom-up, pixels BGRA: bottom row first.
    Buffer.from([255, 0, 0, 255, 0, 0, 0, 0]).copy(b, 40); // blue, clear
    Buffer.from([0, 0, 255, 255, 0, 255, 0, 255]).copy(b, 48); // red, green
    return b;
}

function decode(png: Buffer) {
    const zlib = require("zlib");
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    let pos = 8;
    const idat: Buffer[] = [];
    while (pos < png.length) {
        const len = png.readUInt32BE(pos);
        const type = png.subarray(pos + 4, pos + 8).toString();
        if (type === "IDAT") idat.push(png.subarray(pos + 8, pos + 8 + len));
        pos += len + 12;
    }
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const px: number[][] = [];
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            const o = y * (w * 4 + 1) + 1 + x * 4;
            px.push([...raw.subarray(o, o + 4)]);
        }
    return { w, h, px };
}

describe("bitmap icons", () => {
    it("converts a 32-bit DIB to a PNG with the right pixels", () => {
        const { w, h, px } = decode(dibToPng(fakeDib()));
        expect([w, h]).toEqual([2, 2]);
        expect(px).toEqual([
            [255, 0, 0, 255],
            [0, 255, 0, 255],
            [0, 0, 255, 255],
            [0, 0, 0, 0],
        ]);
    });

    it("rejects compressed or malformed bitmaps", () => {
        const bad = fakeDib();
        bad.writeUInt32LE(1, 16);
        expect(dibToPng(bad)).toBeNull();
        expect(dibToPng(Buffer.alloc(10))).toBeNull();
    });

    it("finds a bitmap icon inside an executable", () => {
        const dir = tmp();
        const exe = join(dir, "old.exe");
        writeFileSync(exe, fakeExe([fakeDib()]));
        const icon = peIcon(exe);
        expect(icon.readUInt32BE(16)).toBe(2);
    });
});

describe("Steam and SVG icons", () => {
    it("uses the library cache icon for a Steam game", () => {
        const home = tmp();
        const steamapps = join(home, "lib/steamapps");
        mkdirSync(join(steamapps, "common/Cool Game"), { recursive: true });
        writeFileSync(
            join(steamapps, "appmanifest_4242.acf"),
            '"AppState"\n{\n\t"installdir"\t\t"Cool Game"\n}\n',
        );
        const cache = join(
            home,
            ".local/share/Steam/appcache/librarycache/4242",
        );
        mkdirSync(cache, { recursive: true });
        const hash = "a".repeat(40);
        writeFileSync(join(cache, `${hash}.jpg`), "jpegbytes");
        writeFileSync(join(cache, "header.jpg"), "nope");
        const icon = linuxExeIcon(
            join(steamapps, "common/Cool Game/bin/game"),
            {
                env: { XDG_DATA_HOME: home, XDG_DATA_DIRS: home },
                home,
            },
        );
        expect(icon?.type).toBe("image/jpeg");
        expect(Buffer.from(icon.data).toString()).toBe("jpegbytes");
    });

    it("falls back to an SVG launcher icon when there is no PNG", () => {
        const home = tmp();
        const share = join(home, "share");
        mkdirSync(join(share, "applications"), { recursive: true });
        mkdirSync(join(share, "icons/hicolor/scalable/apps"), {
            recursive: true,
        });
        writeFileSync(
            join(share, "applications/g.desktop"),
            "[Desktop Entry]\nExec=/games/foo/bar\nIcon=bar-icon\n",
        );
        writeFileSync(
            join(share, "icons/hicolor/scalable/apps/bar-icon.svg"),
            "<svg xmlns='http://www.w3.org/2000/svg'/>",
        );
        const icon = linuxExeIcon("/games/foo/bar", {
            env: { XDG_DATA_HOME: share, XDG_DATA_DIRS: join(home, "none") },
            home,
        });
        expect(icon?.type).toBe("image/svg+xml");
    });
});

describe("host Steam icon (Flatpak)", () => {
    const exe = "/home/u/.local/share/Steam/steamapps/common/Sat/Game.exe";

    it("runs one flatpak-spawn --host sh command with the exe as $1", async () => {
        const calls: { file: string; args: string[] }[] = [];
        const run: HostRun = async (file, args) => {
            calls.push({ file, args });
            return `image/png\n${b64("PNG")}\n`;
        };
        await hostSteamIcon(exe, run);
        expect(calls).toHaveLength(1);
        expect(calls[0].file).toBe("flatpak-spawn");
        expect(calls[0].args.slice(0, 4)).toEqual([
            "--host",
            "sh",
            "-c",
            HOST_STEAM_SCRIPT,
        ]);
        expect(calls[0].args.slice(4)).toEqual(["sh", exe]);
    });

    it("parses JPEG and PNG output into { type, data }", async () => {
        const jpeg = await hostSteamIcon(
            exe,
            async () => `image/jpeg\n${b64("JPEGBYTES")}\n`,
        );
        expect(jpeg?.type).toBe("image/jpeg");
        expect(Buffer.from(jpeg!.data).toString()).toBe("JPEGBYTES");

        const png = await hostSteamIcon(
            exe,
            async () => `image/png\n${b64("PNGBYTES")}`,
        );
        expect(png?.type).toBe("image/png");
        expect(Buffer.from(png!.data).toString()).toBe("PNGBYTES");
    });

    it("returns null for empty output, unknown types and bad base64", () => {
        expect(parseHostIcon("")).toBeNull();
        expect(parseHostIcon("\n")).toBeNull();
        expect(parseHostIcon(`image/gif\n${b64("x")}\n`)).toBeNull();
        expect(parseHostIcon("image/png\nnot base64!\n")).toBeNull();
        expect(parseHostIcon("image/png\n")).toBeNull();
        expect(parseHostIcon(undefined as unknown as string)).toBeNull();
    });

    it("rejects an icon over the size limit", () => {
        const big = Buffer.alloc(4 * 1024 * 1024 + 1, 1).toString("base64");
        expect(parseHostIcon(`image/png\n${big}\n`)).toBeNull();
    });

    it("never throws when the host command fails", async () => {
        expect(
            await hostSteamIcon(exe, async () => {
                throw new Error("no flatpak-spawn");
            }),
        ).toBeNull();
        expect(
            await hostSteamIcon(exe, () => {
                throw new Error("sync failure");
            }),
        ).toBeNull();
        expect(
            await hostSteamIcon("", async () => "image/png\nAA==\n"),
        ).toBeNull();
    });
});

describe("linuxExeIconAsync", () => {
    const exe = "/games/foo/bar";
    let home: string;
    const noLocal = () => ({
        env: { XDG_DATA_HOME: home, XDG_DATA_DIRS: join(home, "none") },
        home,
    });

    it("uses the host Steam icon inside Flatpak when nothing local matches", async () => {
        home = tmp();
        let asked = 0;
        const icon = await linuxExeIconAsync(exe, {
            ...noLocal(),
            env: { ...noLocal().env, FLATPAK_ID: "moe.crafty.matrix" },
            run: async () => {
                asked++;
                return `image/jpeg\n${b64("HOSTJPEG")}\n`;
            },
        });
        expect(asked).toBe(1);
        expect(icon?.type).toBe("image/jpeg");
        expect(Buffer.from(icon!.data).toString()).toBe("HOSTJPEG");
    });

    it("does not run the host command outside Flatpak", async () => {
        home = tmp();
        let asked = 0;
        const icon = await linuxExeIconAsync(exe, {
            ...noLocal(),
            run: async () => {
                asked++;
                return `image/jpeg\n${b64("HOSTJPEG")}\n`;
            },
        });
        expect(asked).toBe(0);
        expect(icon).toBeNull();
    });

    it("prefers a local icon and skips the host command", async () => {
        home = tmp();
        const share = join(home, "share");
        mkdirSync(join(share, "applications"), { recursive: true });
        writeFileSync(
            join(share, "applications/g.desktop"),
            `[Desktop Entry]\nExec=/games/foo/bar\nIcon=${join(home, "i.png")}\n`,
        );
        // A PNG header with a 64px width, enough for pngSize to accept it.
        const png = Buffer.alloc(24);
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
        png.writeUInt32BE(64, 16);
        writeFileSync(join(home, "i.png"), png);
        let asked = 0;
        const icon = await linuxExeIconAsync(exe, {
            env: {
                XDG_DATA_HOME: share,
                XDG_DATA_DIRS: join(home, "none"),
                FLATPAK_ID: "moe.crafty.matrix",
            },
            home,
            run: async () => {
                asked++;
                return "";
            },
        });
        expect(asked).toBe(0);
        expect(icon).not.toBeNull();
    });
});

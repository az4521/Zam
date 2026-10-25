import { describe, it, expect } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const {
    windowSourceHwnd,
    resolveShareAudio,
    groupPipewireApps,
    parseWindowsSessions,
} = require(join(__dirname, "../../../electron/shareAudio.cjs"));

describe("windowSourceHwnd", () => {
    it("reads the HWND of a Windows window source", () => {
        expect(windowSourceHwnd("window:132456:0")).toBe("132456");
    });
    it("rejects screens, a zero handle and anything malformed", () => {
        expect(windowSourceHwnd("screen:0:0")).toBeNull();
        expect(windowSourceHwnd("window:0:0")).toBeNull();
        expect(windowSourceHwnd("window:12a:0")).toBeNull();
        expect(windowSourceHwnd("window:1 --include 4:0")).toBeNull();
        expect(windowSourceHwnd(undefined)).toBeNull();
    });
});

describe("resolveShareAudio", () => {
    const wasapi = {
        system: "exclude-self",
        systemTarget: { mode: "exclude", pid: 100 },
        windowTarget: (id: string) => {
            const hwnd = windowSourceHwnd(id);
            return hwnd ? { mode: "hwnd", hwnd } : null;
        },
    };
    const apps = new Map([["pid:42", { mode: "include", pid: 42 }]]);

    it("captures everything but Zam for system audio", () => {
        expect(resolveShareAudio("system", "screen:0:0", wasapi, apps)).toEqual(
            { kind: "capture", target: { mode: "exclude", pid: 100 } },
        );
    });
    it("auto takes a window's app, and all audio for a screen", () => {
        expect(resolveShareAudio("auto", "window:77:0", wasapi, apps)).toEqual({
            kind: "capture",
            target: { mode: "hwnd", hwnd: "77" },
        });
        expect(resolveShareAudio("auto", "screen:0:0", wasapi, apps)).toEqual({
            kind: "capture",
            target: { mode: "exclude", pid: 100 },
        });
    });
    it("only captures an app this request offered", () => {
        expect(
            resolveShareAudio("app:pid:42", "screen:0:0", wasapi, apps),
        ).toEqual({ kind: "capture", target: { mode: "include", pid: 42 } });
        expect(
            resolveShareAudio("app:pid:4", "screen:0:0", wasapi, apps),
        ).toEqual({ kind: "none" });
    });
    it("falls back to Electron's loopback, or nothing", () => {
        const loopback = { system: "loopback", systemTarget: null };
        expect(
            resolveShareAudio("auto", "window:77:0", loopback, apps),
        ).toEqual({ kind: "loopback" });
        const nothing = { system: null, systemTarget: null };
        expect(
            resolveShareAudio("system", "screen:0:0", nothing, apps),
        ).toEqual({ kind: "none" });
    });
    it("treats unknown or missing choices as no audio", () => {
        for (const choice of ["none", "", "everything", undefined, 5]) {
            expect(
                resolveShareAudio(choice, "screen:0:0", wasapi, apps),
            ).toEqual({ kind: "none" });
        }
    });
});

describe("groupPipewireApps", () => {
    it("lists each application once, without Zam or recording streams", () => {
        const apps = groupPipewireApps(
            [
                { "application.name": "Firefox", "node.name": "a" },
                { "application.name": "Firefox", "node.name": "b" },
                { "application.name": "Zam", "application.process.id": "9" },
                {
                    "application.name": "Chromium",
                    "application.process.id": "7",
                },
                {
                    "application.name": "OBS",
                    "media.class": "Stream/Input/Audio",
                },
                { "application.name": "mpv" },
                {
                    "node.name": "vencord-screen-share",
                    "application.name": "x",
                },
                { "node.name": "alsa_output.speakers" },
                null,
            ],
            new Set(["7"]),
            new Set(["Zam"]),
        );
        expect(apps.map((a: { name: string }) => a.name)).toEqual([
            "Firefox",
            "mpv",
        ]);
        expect(apps[0]).toEqual({
            id: "pw:Firefox",
            name: "Firefox",
            active: false,
            target: {
                mode: "pipewire",
                include: [{ "application.name": "Firefox" }],
            },
        });
    });
});

describe("parseWindowsSessions", () => {
    it("turns the helper's list into picker entries, playing first", () => {
        const apps = parseWindowsSessions(
            JSON.stringify({
                ok: true,
                sessions: [
                    {
                        pid: 5,
                        name: "Spotify",
                        exe: "Spotify.exe",
                        active: false,
                    },
                    { pid: 6, name: "", exe: "game.exe", active: true },
                    { pid: -1, name: "bad" },
                    { pid: "x", name: "bad" },
                ],
            }),
        );
        expect(apps).toEqual([
            {
                id: "pid:6",
                name: "game.exe",
                active: true,
                target: { mode: "include", pid: 6 },
            },
            {
                id: "pid:5",
                name: "Spotify",
                active: false,
                target: { mode: "include", pid: 5 },
            },
        ]);
    });
    it("gives nothing for a failure or garbage", () => {
        expect(
            parseWindowsSessions(JSON.stringify({ ok: false, error: "x" })),
        ).toEqual([]);
        expect(parseWindowsSessions("not json")).toEqual([]);
        expect(parseWindowsSessions("")).toEqual([]);
    });
});

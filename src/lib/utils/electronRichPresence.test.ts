import { describe, it, expect, afterEach, vi } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";
import net from "net";
import { mkdtempSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
const WebSocket = createRequire(import.meta.url)("ws");

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const electron = (name: string) =>
    require(join(__dirname, "../../../electron", name));

const { createCoverStore, createRichPresence, socketLocation } =
    electron("richPresence.cjs");
const { ipcBase } = electron("discordRpc.cjs");
const { createPresenceImages } = electron("presenceImages.cjs");
const { candidates, matchExecutables, parseHostPs } =
    electron("gameScanner.cjs");
const { createKnownGames } = electron("knownGames.cjs");

interface Event {
    source: string;
    app: { id: string; name: string };
    presenceId: string;
    presence: Record<string, unknown> | null;
}

const dirs: string[] = [];
const stops: Array<() => void> = [];
afterEach(() => {
    for (const stop of stops.splice(0)) stop();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true });
});

/** A Steam debug helper that does nothing; its state can be set by a test. */
function stubSteamDebug(
    initial: Partial<{
        supported: boolean;
        enabled: boolean;
        portOpen: boolean;
        steamRunning: boolean;
    }> = {},
) {
    const state = {
        supported: false,
        enabled: false,
        portOpen: false,
        steamRunning: false,
        ...initial,
    };
    const calls: string[] = [];
    const create = () => ({
        status: async () => {
            calls.push("status");
            return { ...state };
        },
        enable: async () => {
            calls.push("enable");
            state.enabled = true;
            return { ok: true };
        },
        disable: async () => {
            calls.push("disable");
            state.enabled = false;
            return { ok: true };
        },
        restartSteam: async () => {
            calls.push("restart");
            return { ok: true };
        },
    });
    return { state, calls, create };
}

/** A Steam source whose reports a test can drive. */
function stubSteamPresence() {
    const instances: Array<{
        onSteam: (s: unknown) => void;
        started: number;
        stopped: number;
        error: string | null;
    }> = [];
    const create = (opts: { onSteam: (s: unknown) => void }) => {
        const inst = {
            onSteam: opts.onSteam,
            started: 0,
            stopped: 0,
            error: null as string | null,
            start() {
                this.started++;
            },
            stop() {
                this.stopped++;
            },
            status() {
                return {
                    running: this.started > this.stopped,
                    portOpen: true,
                    connected: true,
                    error: this.error,
                };
            },
        };
        instances.push(inst);
        return inst;
    };
    return { instances, create };
}

function setup(extra: Record<string, unknown> = {}) {
    const dir = mkdtempSync(join(tmpdir(), "zam-rp-"));
    dirs.push(dir);
    const events: Event[] = [];
    const rp = createRichPresence({
        send: (e: Event) => events.push(e),
        userDataDir: dir,
        // Discord's game list, from a stand-in answer.
        fetch: okFetch(),
        createSteamDebug: stubSteamDebug().create,
        ...extra,
    });
    stops.push(() => rp.stop());
    return { rp, events };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function frame(op: number, data: unknown): Buffer {
    const body = Buffer.from(JSON.stringify(data));
    const out = Buffer.alloc(8 + body.length);
    out.writeInt32LE(op, 0);
    out.writeInt32LE(body.length, 4);
    body.copy(out, 8);
    return out;
}

describe("MSC4544 transport", () => {
    it("forwards add and remove, and clears a connection's presences when it closes", async () => {
        const { rp, events } = setup();
        const st = await rp.configure({ local: true });
        expect(st.msc4544.listening).toBe(true);
        const ws = new WebSocket(`ws://127.0.0.1:${st.msc4544.port}/presence`);
        await new Promise((r) => ws.on("open", r));
        const app = { id: "a", name: "App" };
        ws.send(
            JSON.stringify({
                type: "add_presence",
                app_id: app,
                data: { id: "p", type: "m.rpc.activity", name: "X" },
            }),
        );
        await wait(100);
        expect(events.at(-1)).toMatchObject({
            source: "msc4544",
            presenceId: "p",
            app,
        });
        expect(events.at(-1)!.presence).not.toBeNull();
        ws.close();
        await wait(150);
        expect(events.at(-1)!.presence).toBeNull();
    });

    it("refuses a connection that has an Origin (a web page)", async () => {
        const { rp } = setup();
        const st = await rp.configure({ local: true });
        const ws = new WebSocket(`ws://127.0.0.1:${st.msc4544.port}/presence`, {
            origin: "https://evil.example",
        });
        const outcome = await new Promise((r) => {
            ws.on("open", () => r("open"));
            ws.on("error", () => r("refused"));
        });
        expect(outcome).toBe("refused");
    });

    it("stops listening when switched off", async () => {
        const { rp } = setup();
        await rp.configure({ local: true });
        const st = await rp.configure({ local: false });
        expect(st.msc4544.listening).toBe(false);
    });

    it.skipIf(process.platform === "win32")(
        "also listens on a private Unix socket named by an opaque id",
        async () => {
            const { rp, events } = setup();
            const st = await rp.configure({
                local: true,
                userId: "@alice:example.org",
            });
            const sock = st.msc4544.socket as string;
            expect(sock).toMatch(/^\/tmp\/\.zam_[0-9a-f]{16}\/presence\.sock$/);
            expect(sock).not.toContain("alice");
            expect(statSync(dirname(sock)).mode & 0o777).toBe(0o700);

            const ws = new WebSocket(`ws+unix://${sock}:/`);
            await new Promise((r) => ws.on("open", r));
            ws.send(
                JSON.stringify({
                    type: "add_presence",
                    app_id: { id: "u", name: "Unix app" },
                    data: { id: "p", type: "m.rpc.activity", name: "X" },
                }),
            );
            await wait(100);
            expect(events.at(-1)!.app.name).toBe("Unix app");
            ws.close();

            await rp.configure({ local: false });
            expect(() => statSync(sock)).toThrow();
        },
    );
});

describe("Discord RPC", () => {
    it("takes activities over the WebSocket and clears them on close", async () => {
        const { rp, events } = setup();
        const st = await rp.configure({ local: true, arrpc: true });
        expect(st.arrpc.running).toBe(true);
        const ws = new WebSocket(
            `ws://127.0.0.1:${st.arrpc.wsPort}/?v=1&client_id=356875221078245376`,
        );
        const replies: Array<Record<string, unknown>> = [];
        ws.on("message", (m: unknown) => replies.push(JSON.parse(String(m))));
        await new Promise((r) => ws.on("open", r));
        ws.send(
            JSON.stringify({
                cmd: "SET_ACTIVITY",
                args: {
                    activity: {
                        details: "In menu",
                        timestamps: { start: Math.floor(Date.now() / 1000) },
                    },
                },
                nonce: "1",
            }),
        );
        await wait(150);
        expect(replies[0].evt).toBe("READY");
        const ev = events.find((e) => e.presence?.details === "In menu")!;
        // The game's name and icon come from Discord's list.
        expect(ev.app.name).toBe("Overwatch");
        expect(ev.presence!.application_id).toBe("356875221078245376");
        expect(
            String((ev.presence!.timestamps as { start: number }).start),
        ).toHaveLength(13);
        expect(
            (ev.presence!.assets as { large_image: string }).large_image,
        ).toMatch(/^icon:/);

        ws.close();
        await wait(150);
        expect(events.at(-1)!.presence).toBeNull();
    });

    it("rejects a web page's origin and a missing client id", async () => {
        const { rp } = setup();
        const st = await rp.configure({ local: true, arrpc: true });
        for (const [url, opts] of [
            [
                `ws://127.0.0.1:${st.arrpc.wsPort}/?v=1&client_id=1`,
                { origin: "https://evil.example" },
            ],
            [`ws://127.0.0.1:${st.arrpc.wsPort}/?v=1`, {}],
        ] as const) {
            const ws = new WebSocket(url, opts);
            const closed = await new Promise((r) => {
                ws.on("close", () => r("closed"));
                ws.on("error", () => r("closed"));
            });
            expect(closed).toBe("closed");
        }
    });

    it("speaks the IPC framing and answers unsupported commands", async () => {
        const { rp, events } = setup();
        const st = await rp.configure({ local: true, arrpc: true });
        const c = net.createConnection(st.arrpc.ipcPath as string);
        const replies: Array<Record<string, unknown>> = [];
        let buf = Buffer.alloc(0);
        c.on("data", (d: Buffer) => {
            buf = Buffer.concat([buf, d]);
            while (buf.length >= 8 && buf.length >= 8 + buf.readInt32LE(4)) {
                const len = buf.readInt32LE(4);
                replies.push(JSON.parse(buf.subarray(8, 8 + len).toString()));
                buf = buf.subarray(8 + len);
            }
        });
        await new Promise((r) => c.on("connect", r));
        // Split the handshake across two writes, as a slow client might.
        const hs = frame(0, { v: 1, client_id: "42" });
        c.write(hs.subarray(0, 5));
        await wait(20);
        c.write(hs.subarray(5));
        await wait(100);
        c.write(
            frame(1, {
                cmd: "SET_ACTIVITY",
                args: { activity: { name: "Mine", details: "d" } },
                nonce: "a",
            }),
        );
        c.write(frame(1, { cmd: "INVITE_BROWSER", nonce: "b" }));
        await wait(150);
        expect(replies.map((r) => `${r.cmd}:${r.evt}`)).toEqual([
            "DISPATCH:READY",
            "SET_ACTIVITY:null",
            "INVITE_BROWSER:ERROR",
        ]);
        expect(events.some((e) => e.app.name === "Mine")).toBe(true);
        c.destroy();
        await wait(150);
        expect(events.at(-1)!.presence).toBeNull();
    });

    it("does not start the Discord servers unless asked", async () => {
        const { rp } = setup();
        const st = await rp.configure({ local: true });
        expect(st.arrpc.running).toBe(false);
        expect(st.scan.running).toBe(false);
    });
});

// A stand-in for Discord's answer: Overwatch, a launcher-only entry, one with
// no executable, and filler up to the size a real answer has.
function detectable() {
    const filler = Array.from({ length: 1200 }, (_, i) => ({
        id: String(1000000 + i),
        name: `Filler ${i}`,
        icon_hash: null,
        executables: [{ os: "win32", name: `filler${i}.exe` }],
    }));
    return [
        {
            id: "356875221078245376",
            name: "Overwatch",
            icon_hash: "0123456789abcdef0123456789abcdef",
            executables: [
                { os: "win32", name: "overwatch.exe" },
                { os: "win32", name: "launcher.exe", is_launcher: true },
            ],
        },
        { id: "5", name: "No Executable", executables: [] },
        ...filler,
    ];
}

const okFetch = (body: unknown = detectable()) =>
    vi.fn(async (_url: string, _init?: unknown) => ({
        ok: true,
        status: 200,
        json: async () => body,
    }));

function listFile() {
    const dir = mkdtempSync(join(tmpdir(), "zam-kg-"));
    dirs.push(dir);
    return join(dir, "known-games.bin");
}

describe("game list and matching", () => {
    it("downloads the list on first use and keeps it on disk", async () => {
        const file = listFile();
        const fetch = okFetch();
        const known = createKnownGames({ file, fetch });
        // First look: nothing yet, and a download starts.
        expect((await known.load("win32")).byId.size).toBe(0);
        await known.refresh();
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(known.status()).toMatchObject({
            count: 1201,
            downloading: false,
            error: null,
        });
        const games = await known.load("win32");
        expect(games.byId.get("356875221078245376")).toEqual({
            name: "Overwatch",
            icon: "0123456789abcdef0123456789abcdef",
        });
        expect(games.byExe.has("launcher.exe")).toBe(false);
        expect(games.byId.has("5")).toBe(false);

        // A new session finds it on disk and does not download again.
        const again = createKnownGames({ file, fetch });
        expect((await again.load("win32")).byId.size).toBe(1201);
        await again.refresh();
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("downloads again once the saved list is a week old", async () => {
        const file = listFile();
        const fetch = okFetch();
        let clock = Date.now();
        const known = createKnownGames({ file, fetch, now: () => clock });
        await known.load();
        await known.refresh();
        clock += 8 * 24 * 3600 * 1000;
        await known.refresh();
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("keeps a good list when the answer is bad, and backs off", async () => {
        const file = listFile();
        let clock = Date.now();
        const good = createKnownGames({
            file,
            fetch: okFetch(),
            now: () => clock,
        });
        await good.refresh({ force: true });

        const bad = okFetch([{ id: "1", name: "x", executables: [] }]);
        const known = createKnownGames({ file, fetch: bad, now: () => clock });
        await known.refresh({ force: true });
        expect(known.status().error).toMatch(/too short/);
        expect((await known.load("win32")).byId.size).toBe(1201);

        // Not retried straight away, but is after the back-off.
        clock += 8 * 24 * 3600 * 1000;
        await known.refresh();
        expect(bad).toHaveBeenCalledTimes(2);
        await known.refresh();
        expect(bad).toHaveBeenCalledTimes(2);
    });

    it("never touches the network without a fetch function", async () => {
        const known = createKnownGames({ file: listFile() });
        expect((await known.load()).byId.size).toBe(0);
        await known.refresh({ force: true });
        expect(known.status().downloading).toBe(false);
    });

    it("loads names, icons and this platform's executables", async () => {
        const known = createKnownGames({ file: listFile(), fetch: okFetch() });
        await known.refresh({ force: true });
        const games = await known.load("win32");
        expect(games.byId.get("356875221078245376").name).toBe("Overwatch");
        expect(games.byExe.get("overwatch.exe")[0].id).toBe(
            "356875221078245376",
        );
    });

    it("builds trailing-path candidates, with 64-bit markers removed", () => {
        const win = ["C:", "Games", "Foo", "Foo64.exe"].join("\\");
        const got = candidates(win);
        for (const c of ["foo64.exe", "foo.exe", "foo/foo.exe"])
            expect(got.has(c)).toBe(true);
    });
});

describe("Wine and Proton games on Linux", () => {
    const bs = String.fromCharCode(92);
    const psLines = (rows: Array<[number, string]>) =>
        rows.map(([pid, args]) => `  ${pid} ${args}`).join("\n");
    // The game as the host's Windows-style path shows it, doubled separators
    // included (ps -ww output).
    const sakuyaWin = [
        `S:${bs}${bs}steamapps${bs}${bs}common${bs}${bs}Sakuya Izayoi Gives You Advice And Dabs`,
        `${bs}${bs}lib${bs}${bs}windows-i686${bs}${bs}SakuyaIzayoiGivesYouAdviceAndDabs.exe`,
    ].join("");
    const sakuyaProton =
        "python3 /home/user/steamapps/common/Proton - Experimental/proton waitforexitandrun " +
        "/home/user/steamapps/common/Sakuya Izayoi Gives You Advice And Dabs/SakuyaIzayoiGivesYouAdviceAndDabs.exe";
    const steamHelper = `c:${bs}windows${bs}system32${bs}steam.exe`;
    const system32Lines = [
        steamHelper,
        `C:${bs}windows${bs}system32${bs}services.exe`,
        `C:${bs}windows${bs}system32${bs}winedevice.exe`,
        `${steamHelper} /home/user/steamapps/common/Sakuya Izayoi Gives You Advice And Dabs/SakuyaIzayoiGivesYouAdviceAndDabs.exe`,
    ];

    const entry = (id: string, name: string, os: string, exe: string) => ({
        id,
        name,
        executables: [{ os, name: exe }],
    });
    const games = [
        entry(
            "1",
            "Sakuya Izayoi",
            "win32",
            "windows-i686/sakuyaizayoigivesyouadviceanddabs.exe",
        ),
        entry("2", "Hollow Knight", "linux", "hollow_knight.x86_64"),
        entry("3", "Clash Native", "linux", "clash.exe"),
        entry("4", "Clash Windows", "win32", "clash.exe"),
        entry(
            "5",
            "Satisfactory",
            "win32",
            "win64/factorygame-win64-shipping.exe",
        ),
        entry("6", "Steam Client", "win32", "steam.exe"),
        ...Array.from({ length: 1000 }, (_, i) =>
            entry(
                String(2000000 + i),
                `Filler ${i}`,
                "win32",
                `filler${i}.exe`,
            ),
        ),
    ];

    async function linuxIndex() {
        const known = createKnownGames({
            file: listFile(),
            fetch: okFetch(games),
        });
        await known.refresh({ force: true });
        return known.load("linux");
    }

    function matchOf(
        out: string,
        byExe: Parameters<typeof matchExecutables>[1],
    ) {
        const seen = new Map<string, string>();
        matchExecutables(parseHostPs(out), byExe, seen);
        return [...seen.keys()].sort();
    }

    it("indexes Windows executables on Linux, native ones first", async () => {
        const { byExe } = await linuxIndex();
        expect(
            byExe
                .get("windows-i686/sakuyaizayoigivesyouadviceanddabs.exe")
                ?.map((e: { id: string }) => e.id),
        ).toEqual(["1"]);
        expect(
            byExe.get("clash.exe")?.map((e: { id: string }) => e.id),
        ).toEqual(["3"]);
        expect(byExe.get("hollow_knight.x86_64")?.[0].wine).toBe(false);
        expect(
            byExe.get("windows-i686/sakuyaizayoigivesyouadviceanddabs.exe")?.[0]
                .wine,
        ).toBe(true);
    });

    it("leaves Windows executables out of the macOS index", async () => {
        const known = createKnownGames({
            file: listFile(),
            fetch: okFetch(games),
        });
        await known.refresh({ force: true });
        const { byExe } = await known.load("darwin");
        expect(
            byExe.has("windows-i686/sakuyaizayoigivesyouadviceanddabs.exe"),
        ).toBe(false);
        expect(byExe.has("hollow_knight.x86_64")).toBe(false);
    });

    it("finds a Steam game's Windows executable on the host", async () => {
        const { byExe } = await linuxIndex();
        expect(matchOf(psLines([[14383, sakuyaWin]]), byExe)).toEqual(["1"]);
    });

    it("finds a Proton game run by a python3 loader when its file name is listed", async () => {
        const { byExe } = await linuxIndex();
        byExe.set("sakuyaizayoigivesyouadviceanddabs.exe", [
            { id: "1", exact: false, wine: true },
        ]);
        expect(matchOf(psLines([[14285, sakuyaProton]]), byExe)).toEqual(["1"]);
    });

    it("does not match the Proton line to a list entry under lib/windows-i686", async () => {
        const { byExe } = await linuxIndex();
        expect(matchOf(psLines([[14285, sakuyaProton]]), byExe)).toEqual([]);
    });

    it("matches a native game whose path has spaces in it", () => {
        const byExe = new Map([
            ["hollow_knight.x86_64", [{ id: "2", exact: false, wine: false }]],
        ]);
        const out = psLines([
            [
                4242,
                "/home/user/Games/steamapps/common/Hollow Knight/hollow_knight.x86_64 -windowed",
            ],
        ]);
        expect(matchOf(out, byExe)).toEqual(["2"]);
    });

    it("does not match Wine's own system programs", async () => {
        const { byExe } = await linuxIndex();
        expect(
            matchOf(psLines(system32Lines.map((l, i) => [100 + i, l])), byExe),
        ).toEqual([]);
    });

    it("still matches a steam.exe that is not Wine's own", async () => {
        const { byExe } = await linuxIndex();
        const out = psLines([
            [
                500,
                `S:${bs}${bs}steamapps${bs}${bs}common${bs}${bs}Steam Client${bs}${bs}steam.exe`,
            ],
        ]);
        expect(matchOf(out, byExe)).toEqual(["6"]);
    });

    it("builds candidates through doubled separators", () => {
        const got = candidates(sakuyaWin);
        expect(
            got.has("windows-i686/sakuyaizayoigivesyouadviceanddabs.exe"),
        ).toBe(true);
    });
});

describe("presence pictures", () => {
    const calls: string[] = [];
    function stub(
        bytes: Uint8Array,
        type = "image/png",
        extra: Record<string, unknown> = {},
    ) {
        return async (url: string) => {
            calls.push(url);
            return {
                ok: true,
                url,
                headers: new Map([
                    ["content-type", type],
                ]) as unknown as Headers,
                arrayBuffer: async () => bytes.buffer,
                ...extra,
            };
        };
    }
    afterEach(() => (calls.length = 0));

    it("resolves only Discord and Spotify addresses", async () => {
        const img = createPresenceImages({ fetch: stub(new Uint8Array(1)) });
        expect(await img.resolve("1", "icon:abcdef1234")).toBe(
            "https://cdn.discordapp.com/app-icons/1/abcdef1234.png?size=256",
        );
        expect(
            await img.resolve("1", "mp:external/h/https/x.example/a.png"),
        ).toBe("https://media.discordapp.net/external/h/https/x.example/a.png");
        expect(await img.resolve("1", "spotify:ab67616d0000b273")).toBe(
            "https://i.scdn.co/image/ab67616d0000b273",
        );
        expect(await img.resolve("1", "123456789")).toBe(
            "https://cdn.discordapp.com/app-assets/1/123456789.png?size=256",
        );
        for (const bad of [
            "https://evil.example/x.png",
            "http://127.0.0.1/x.png",
            "mp:../../etc",
            "file:///etc/passwd",
            "youtube:abc",
        ])
            expect(await img.resolve("1", bad)).toBeNull();
        expect(await img.resolve("not-a-number", "icon:abcdef1234")).toBeNull();
        expect(calls).toEqual([]);
    });

    it("returns images, and refuses other content types and oversize bodies", async () => {
        const ok = createPresenceImages({
            fetch: stub(new Uint8Array([1, 2, 3])),
        });
        expect(await ok.fetchImage("1", "icon:abcdef1234")).toEqual({
            type: "image/png",
            data: new Uint8Array([1, 2, 3]),
        });
        const html = createPresenceImages({
            fetch: stub(new Uint8Array([1]), "text/html"),
        });
        expect(await html.fetchImage("1", "icon:abcdef1234")).toBeNull();
        const big = createPresenceImages({
            fetch: stub(new Uint8Array(5 * 1024 * 1024)),
        });
        expect(await big.fetchImage("1", "icon:abcdef1234")).toBeNull();
    });

    it("refuses a redirect to another host", async () => {
        const img = createPresenceImages({
            fetch: async () => ({
                ok: true,
                url: "https://evil.example/x.png",
                headers: new Map([["content-type", "image/png"]]),
                arrayBuffer: async () => new Uint8Array([1]).buffer,
            }),
        });
        expect(await img.fetchImage("1", "icon:abcdef1234")).toBeNull();
    });

    it("falls back to the game's executable icon when an app icon cannot be fetched", async () => {
        const exe = { type: "image/png", data: new Uint8Array([7]) };
        const asked: string[] = [];
        const img = createPresenceImages({
            fetch: async () => ({ ok: false }),
            exeIcon: async (id: string) => {
                asked.push(id);
                return id === "1" ? exe : null;
            },
        });
        expect(await img.fetchImage("1", "icon:abcdef1234")).toEqual(exe);
        // A game with no known executable gets no picture.
        expect(await img.fetchImage("2", "icon:abcdef1234")).toBeNull();
        // Other references do not fall back.
        expect(
            await img.fetchImage("1", "spotify:ab67616d0000b273"),
        ).toBeNull();
        expect(asked).toEqual(["1", "2"]);
    });

    it("serves media covers and player icons, only under the player's own app id", async () => {
        const store = createCoverStore();
        const cover = { type: "image/png", data: new Uint8Array([1, 2, 3]) };
        const ref = store.put("spotify.exe", cover) as string;
        const icon = { type: "image/png", data: new Uint8Array([9]) };
        const img = createPresenceImages({
            fetch: stub(new Uint8Array(1)),
            mediaCover: (r: string) => store.get(r),
            mediaIcon: async (p: string) => (p === "spotify.exe" ? icon : null),
        });
        expect(await img.fetchImage("media-spotify.exe", ref)).toEqual(cover);
        expect(
            await img.fetchImage("media-spotify.exe", "media-icon:spotify.exe"),
        ).toEqual(icon);
        expect(await img.fetchImage("media-vlc", "media-icon:vlc")).toBeNull();
        // Not the player's own app id.
        expect(await img.fetchImage("1", ref)).toBeNull();
        expect(
            await img.fetchImage("media-vlc", "media-icon:spotify.exe"),
        ).toBeNull();
        // A cover whose hash is no longer the player's.
        expect(
            await img.fetchImage(
                "media-spotify.exe",
                "media:spotify.exe:000000000000",
            ),
        ).toBeNull();
        expect(calls).toEqual([]);
    });
});

describe("media covers", () => {
    it("refers to a cover by a hash that changes with the picture", () => {
        const store = createCoverStore();
        const first = { type: "image/png", data: new Uint8Array([1, 2, 3]) };
        const ref = store.put("spotify.exe", first) as string;
        expect(ref).toMatch(/^media:spotify\.exe:[0-9a-f]{12}$/);
        expect(store.get(ref)).toEqual(first);

        // A new album is a new reference; the old one no longer resolves.
        const second = { type: "image/jpeg", data: new Uint8Array([4, 5, 6]) };
        const next = store.put("spotify.exe", second) as string;
        expect(next).not.toBe(ref);
        expect(store.get(ref)).toBeNull();
        expect(store.get(next)).toEqual(second);

        // Another player's reference with the same hash does not resolve.
        expect(store.get(`media:vlc:${next.slice(-12)}`)).toBeNull();
        expect(store.get("media:spotify.exe")).toBeNull();

        // Stopped (no cover) forgets it.
        expect(store.put("spotify.exe", undefined)).toBeNull();
        expect(store.get(next)).toBeNull();
    });
});

describe("Flatpak paths", () => {
    const posix = (p: string) => p.replaceAll("\\", "/");
    const posixAll = (o: { dir: string; sock: string; owned: boolean }) => ({
        ...o,
        dir: posix(o.dir),
        sock: posix(o.sock),
    });
    const env = {
        XDG_RUNTIME_DIR: "/run/user/1000",
        FLATPAK_ID: "moe.crafty.matrix",
    };

    it("puts discord-ipc in the folder shared with the host", () => {
        expect(
            posix(ipcBase({ platform: "linux", env, inFlatpak: true })),
        ).toBe("/run/user/1000/app/com.discordapp.Discord/discord-ipc");
        expect(
            posix(ipcBase({ platform: "linux", env, inFlatpak: false })),
        ).toBe("/run/user/1000/discord-ipc");
        expect(ipcBase({ platform: "win32", env, inFlatpak: false })).toContain(
            "pipe",
        );
    });

    it("puts the MSC4544 socket in the app's runtime folder", () => {
        expect(
            posixAll(socketLocation({ inFlatpak: true, env, id: "abc" })),
        ).toEqual({
            dir: "/run/user/1000/app/moe.crafty.matrix",
            sock: "/run/user/1000/app/moe.crafty.matrix/presence.sock",
            owned: false,
        });
        expect(
            posixAll(socketLocation({ inFlatpak: false, env, id: "abc" })),
        ).toEqual({
            dir: "/tmp/.zam_abc",
            sock: "/tmp/.zam_abc/presence.sock",
            owned: true,
        });
    });

    function flatpakRp(hostAccess: () => Promise<boolean>) {
        const dir = mkdtempSync(join(tmpdir(), "zam-rp-"));
        dirs.push(dir);
        const rp = createRichPresence({
            send: () => {},
            userDataDir: dir,
            inFlatpak: true,
            hostAccess,
            createSteamDebug: stubSteamDebug().create,
        });
        stops.push(() => rp.stop());
        return rp;
    }

    it("does not scan without permission to run commands on the host", async () => {
        const rp = flatpakRp(async () => false);
        const st = await rp.configure({ local: true, scan: true });
        expect(st.scan).toMatchObject({
            running: false,
            needsPermission: true,
        });
        // Turning scanning off clears the notice.
        const off = await rp.configure({ local: true, scan: false });
        expect(off.scan.needsPermission).toBe(false);
    });

    it("scans through the host once permission is granted, asking only once", async () => {
        let asked = 0;
        const rp = flatpakRp(async () => {
            asked++;
            return true;
        });
        const st = await rp.configure({ local: true, scan: true });
        expect(st.scan).toMatchObject({
            running: true,
            needsPermission: false,
        });
        await rp.configure({ local: true, scan: false });
        await rp.configure({ local: true, scan: true });
        expect(asked).toBe(1);
    });

    it("reads the host's process list from ps", () => {
        const bs = String.fromCharCode(92);
        const game = ["Z:", "games", "Some Game", "game.exe"].join(bs);
        const rows = parseHostPs(
            [
                "    1 /sbin/init splash",
                ` 4242 wine64 ${game} -windowed`,
                "garbage",
            ].join(String.fromCharCode(10)),
        );
        expect(rows.map((r: { pid: number }) => r.pid)).toEqual([1, 4242]);
        expect(rows[1].paths[0]).toBe("wine64");
        // A game's name with a space in it still matches by its last pieces.
        const tails = [...candidates(rows[1].paths[1])];
        expect(tails).toContain("some game/game.exe");
        expect(tails).toContain("game.exe");
    });
});

describe("Steam presence", () => {
    it("runs the Steam source only while it is wanted, locally", async () => {
        const sp = stubSteamPresence();
        const { rp } = setup({ createSteamPresence: sp.create });
        await rp.configure({ local: true, steam: false });
        expect(sp.instances).toHaveLength(0);

        await rp.configure({ local: true, steam: true });
        expect(sp.instances).toHaveLength(1);
        expect(sp.instances[0].started).toBe(1);
        // Asking again does not start a second one.
        await rp.configure({ local: true, steam: true });
        expect(sp.instances).toHaveLength(1);

        await rp.configure({ local: true, steam: false });
        expect(sp.instances[0].stopped).toBe(1);

        await rp.configure({ local: true, steam: true });
        expect(sp.instances).toHaveLength(2);
        await rp.configure({ local: false, steam: true });
        expect(sp.instances[1].stopped).toBe(1);
    });

    it("forwards a game as a Playing activity with Steam's header picture", async () => {
        const sp = stubSteamPresence();
        const { rp, events } = setup({ createSteamPresence: sp.create });
        await rp.configure({ local: true, steam: true });
        const onSteam = sp.instances[0].onSteam;

        onSteam({
            appId: "570",
            name: "Dota 2",
            status: "In Lobby",
            richPresence: {},
            startedAt: 1000,
        });
        expect(events).toEqual([
            {
                source: "arrpc",
                app: { id: "steam-570", name: "Dota 2" },
                presenceId: "steam-570",
                presence: {
                    application_id: "steam-570",
                    name: "Dota 2",
                    type: 0,
                    details: "In Lobby",
                    assets: { large_image: "steam:570" },
                    timestamps: { start: 1000 },
                },
            },
        ]);
    });

    it("uses the game's Steam icon when Steam gives its hash", async () => {
        const sp = stubSteamPresence();
        const { rp, events } = setup({ createSteamPresence: sp.create });
        await rp.configure({ local: true, steam: true });
        const icon = "d".repeat(40);
        sp.instances[0].onSteam({
            appId: "570",
            name: "Dota 2",
            status: "",
            icon,
            startedAt: 1,
        });
        expect(events[0].presence!.assets).toEqual({
            large_image: `steam:570:${icon}`,
        });
    });

    it("removes the previous game when the app changes or Steam reports none", async () => {
        const sp = stubSteamPresence();
        const { rp, events } = setup({ createSteamPresence: sp.create });
        await rp.configure({ local: true, steam: true });
        const onSteam = sp.instances[0].onSteam;

        onSteam({ appId: "570", name: "Dota 2", status: "", startedAt: 1 });
        events.length = 0;

        // Another game: the old one goes, then the new one comes.
        onSteam({ appId: "730", name: "CS2", status: "", startedAt: 2 });
        expect(events.map((e) => [e.app.id, e.presence === null])).toEqual([
            ["steam-570", true],
            ["steam-730", false],
        ]);
        events.length = 0;

        // Same game again: an update, no removal.
        onSteam({ appId: "730", name: "CS2", status: "Menu", startedAt: 2 });
        expect(events.map((e) => e.presence === null)).toEqual([false]);
        events.length = 0;

        // Steam reports nothing: the game goes, and nothing more is sent.
        onSteam(null);
        expect(events).toEqual([
            {
                source: "arrpc",
                app: { id: "steam-730", name: "CS2" },
                presenceId: "steam-730",
                presence: null,
            },
        ]);
        events.length = 0;
        onSteam(null);
        expect(events).toEqual([]);
    });

    it("removes the reported game when the source is switched off", async () => {
        const sp = stubSteamPresence();
        const { rp, events } = setup({ createSteamPresence: sp.create });
        await rp.configure({ local: true, steam: true });
        sp.instances[0].onSteam({ appId: "570", name: "Dota 2", status: "" });
        events.length = 0;

        await rp.configure({ local: true, steam: false });
        expect(events).toEqual([
            {
                source: "arrpc",
                app: { id: "steam-570", name: "Dota 2" },
                presenceId: "steam-570",
                presence: null,
            },
        ]);
    });

    it("ignores a report from a source that has been stopped", async () => {
        const sp = stubSteamPresence();
        const { rp, events } = setup({ createSteamPresence: sp.create });
        await rp.configure({ local: true, steam: true });
        const old = sp.instances[0];
        await rp.configure({ local: true, steam: false });
        events.length = 0;
        old.onSteam({ appId: "570", name: "Dota 2", status: "" });
        expect(events).toEqual([]);
    });

    it("reports the Steam source and its debug setting in the status", async () => {
        const sp = stubSteamPresence();
        const dbg = stubSteamDebug({
            supported: true,
            enabled: true,
            steamRunning: true,
            portOpen: true,
        });
        const { rp } = setup({
            createSteamPresence: sp.create,
            createSteamDebug: dbg.create,
        });
        const st = await rp.configure({ local: true, steam: true });
        expect(st.steam).toEqual({
            running: true,
            connected: true,
            portOpen: true,
            error: null,
            supported: true,
            enabled: true,
            steamRunning: true,
            needsPermission: false,
        });

        // A failure of the source shows up without another configure.
        sp.instances[0].error = "boom";
        expect(rp.getStatus().steam.error).toBe("boom");

        // Off: not running, but the debug setting is still known.
        await rp.configure({ local: true, steam: false });
        expect(rp.getStatus().steam).toMatchObject({
            running: false,
            connected: false,
            supported: true,
            enabled: true,
        });
    });

    it("says when a Flatpak needs permission to change Steam", async () => {
        const dir = mkdtempSync(join(tmpdir(), "zam-rp-"));
        dirs.push(dir);
        const rp = createRichPresence({
            send: () => {},
            userDataDir: dir,
            inFlatpak: true,
            hostAccess: async () => false,
            createSteamPresence: stubSteamPresence().create,
            createSteamDebug: stubSteamDebug().create,
        });
        stops.push(() => rp.stop());
        const st = await rp.configure({ local: true, steam: true });
        expect(st.steam.needsPermission).toBe(true);
        const off = await rp.configure({ local: true, steam: false });
        expect(off.steam.needsPermission).toBe(false);
    });

    it("turns Steam's debug setting on and off, and restarts Steam, then refreshes the status", async () => {
        const dbg = stubSteamDebug({ supported: true });
        const { rp } = setup({ createSteamDebug: dbg.create });
        expect(rp.getStatus().steam.enabled).toBe(false);

        expect(await rp.setSteamDebugging(true)).toEqual({ ok: true });
        expect(rp.getStatus().steam.enabled).toBe(true);
        expect(await rp.setSteamDebugging(false)).toEqual({ ok: true });
        expect(rp.getStatus().steam.enabled).toBe(false);
        expect(dbg.calls).toEqual(["enable", "status", "disable", "status"]);

        expect(await rp.restartSteam()).toEqual({ ok: true });
        expect(dbg.calls.slice(-2)).toEqual(["restart", "status"]);
    });
});

describe("Steam connect strings", () => {
    const report = (
        richPresence: Record<string, string>,
        ids: { steamId?: string; lobbyId?: string } = {},
    ) => ({
        appId: "570",
        name: "Dota 2",
        status: "",
        steamId: "",
        lobbyId: "",
        ...ids,
        richPresence,
        startedAt: 1,
    });

    it("forwards the Steam id and lobby as steam_id and steam_lobby, digits only", async () => {
        const sp = stubSteamPresence();
        const { rp, events } = setup({ createSteamPresence: sp.create });
        await rp.configure({ local: true, steam: true });
        const onSteam = sp.instances[0].onSteam;
        onSteam(
            report(
                {},
                { steamId: "76561198000000001", lobbyId: "109775240000000000" },
            ),
        );
        expect(events[0].presence).toMatchObject({
            steam_id: "76561198000000001",
            steam_lobby: "109775240000000000",
        });
        events.length = 0;
        onSteam(report({}, { steamId: "7656 ; x", lobbyId: "" }));
        expect(events[0].presence).not.toHaveProperty("steam_id");
        expect(events[0].presence).not.toHaveProperty("steam_lobby");
    });

    it("forwards a valid connect string as steam_connect", async () => {
        const sp = stubSteamPresence();
        const { rp, events } = setup({ createSteamPresence: sp.create });
        await rp.configure({ local: true, steam: true });
        sp.instances[0].onSteam(
            report({
                connect: "+connect 10.0.0.5:27015",
                steam_player_group: "x",
            }),
        );
        expect(events[0].presence!.steam_connect).toBe(
            "+connect 10.0.0.5:27015",
        );
        expect(events[0].presence).not.toHaveProperty("steam_player_group");
    });

    it("omits steam_connect when it has control characters or is too long", async () => {
        const sp = stubSteamPresence();
        const { rp, events } = setup({ createSteamPresence: sp.create });
        await rp.configure({ local: true, steam: true });
        const onSteam = sp.instances[0].onSteam;
        for (const connect of [
            "a\u0000b",
            "a\nb",
            "a\u007fb",
            "x".repeat(513),
            "",
        ]) {
            events.length = 0;
            onSteam(report({ connect }));
            expect(events[0].presence).not.toHaveProperty("steam_connect");
        }
    });
});

describe("Game invites (joinGame)", () => {
    it("reports invalid for bad input", async () => {
        const opened: string[] = [];
        const { rp } = setup({ openExternal: (u: string) => opened.push(u) });
        for (const req of [
            null,
            { kind: "other" },
            { kind: "discord", applicationId: "1", secret: "s" },
            { kind: "steam", appId: "570", connect: "a\u0001" },
            { kind: "steam", appId: "5x", connect: "+connect a" },
            { kind: "steam", appId: "570", connect: "" },
            { kind: "steam", appId: "570", steamId: "7656/x", connect: "c" },
            { kind: "steam", appId: "570", steamId: "76561198000000001" },
            {
                kind: "steam",
                appId: "570",
                steamId: "76561198000000001",
                lobbyId: "1 x",
            },
            { kind: "steam", appId: "570", lobbyId: "109775240000000000" },
        ]) {
            expect(await rp.joinGame(req as never)).toEqual({
                ok: false,
                error: "invalid",
            });
        }
        expect(opened).toEqual([]);
    });

    it("opens exactly the Steam run link for a valid Steam invite without a Steam id", async () => {
        const opened: string[] = [];
        const { rp } = setup({ openExternal: (u: string) => opened.push(u) });
        expect(
            await rp.joinGame({
                kind: "steam",
                appId: "570",
                connect: "+connect 10.0.0.5:27015 & x",
            }),
        ).toEqual({ ok: true });
        expect(opened).toEqual([
            "steam://run/570//%2Bconnect%2010.0.0.5%3A27015%20%26%20x/",
        ]);
    });

    it("opens Steam's join link for the friend's game, or the friend's lobby", async () => {
        const opened: string[] = [];
        const { rp } = setup({ openExternal: (u: string) => opened.push(u) });
        const steamId = "76561198000000001";
        expect(
            await rp.joinGame({
                kind: "steam",
                appId: "570",
                steamId,
                connect: "+connect 10.0.0.5:27015",
            }),
        ).toEqual({ ok: true });
        expect(
            await rp.joinGame({
                kind: "steam",
                appId: "570",
                steamId,
                lobbyId: "109775240000000000",
                connect: "+connect 10.0.0.5:27015",
            }),
        ).toEqual({ ok: true });
        expect(
            await rp.joinGame({
                kind: "steam",
                appId: "570",
                steamId,
                lobbyId: "109775240000000000",
            }),
        ).toEqual({ ok: true });
        expect(opened).toEqual([
            `steam://rungame/570/${steamId}/%2Bconnect%2010.0.0.5%3A27015`,
            `steam://joinlobby/570/109775240000000000/${steamId}`,
            `steam://joinlobby/570/109775240000000000/${steamId}`,
        ]);
    });

    it("reports unsupported when the link cannot be opened", async () => {
        const { rp } = setup({
            openExternal: async () => {
                throw new Error("no handler");
            },
        });
        expect(
            await rp.joinGame({ kind: "steam", appId: "570", connect: "c" }),
        ).toEqual({ ok: false, error: "unsupported" });
        const none = setup();
        expect(
            await none.rp.joinGame({
                kind: "steam",
                appId: "570",
                connect: "c",
            }),
        ).toEqual({ ok: false, error: "unsupported" });
    });
});

describe("Steam pictures", () => {
    it("resolves a Steam header only under the game's own steam app id", async () => {
        const img = createPresenceImages({
            fetch: async () => {
                throw new Error("not called");
            },
        });
        expect(await img.resolve("steam-570", "steam:570")).toBe(
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/570/header.jpg",
        );
        const hash = "c".repeat(40);
        expect(await img.resolve("steam-570", `steam:570:${hash}`)).toBe(
            `https://shared.fastly.steamstatic.com/community_assets/images/apps/570/${hash}_full.jpg`,
        );
        expect(await img.resolve("steam-730", `steam:570:${hash}`)).toBeNull();
        expect(await img.resolve("steam-570", "steam:570:zz")).toBeNull();
        expect(await img.resolve("steam-730", "steam:570")).toBeNull();
        expect(await img.resolve("570", "steam:570")).toBeNull();
        expect(await img.resolve("steam-abc", "steam:abc")).toBeNull();
        expect(await img.resolve("steam-570", "steam:570/../x")).toBeNull();
    });

    it("falls back from the full Steam icon to the small one, then the header", async () => {
        const hash = "e".repeat(40);
        const base = "https://shared.fastly.steamstatic.com";
        const full = `${base}/community_assets/images/apps/570/${hash}_full.jpg`;
        const small = `${base}/community_assets/images/apps/570/${hash}.jpg`;
        const header = `${base}/store_item_assets/steam/apps/570/header.jpg`;
        const run = async (available: string[]) => {
            const urls: string[] = [];
            const img = createPresenceImages({
                fetch: async (url: string) => {
                    urls.push(url);
                    return {
                        ok: available.includes(url),
                        url,
                        headers: new Map([["content-type", "image/jpeg"]]),
                        arrayBuffer: async () =>
                            new Uint8Array([urls.length]).buffer,
                    };
                },
            });
            const got = await img.fetchImage("steam-570", `steam:570:${hash}`);
            return { urls, got };
        };
        expect(await run([full, small, header])).toMatchObject({
            urls: [full],
            got: { data: new Uint8Array([1]) },
        });
        expect(await run([small, header])).toMatchObject({
            urls: [full, small],
            got: { data: new Uint8Array([2]) },
        });
        expect(await run([header])).toMatchObject({
            urls: [full, small, header],
            got: { data: new Uint8Array([3]) },
        });
        expect((await run([])).got).toBeNull();
    });

    it("fetches the header picture, and refuses it if it redirects elsewhere", async () => {
        const urls: string[] = [];
        const img = createPresenceImages({
            fetch: async (url: string) => {
                urls.push(url);
                return {
                    ok: true,
                    url,
                    headers: new Map([["content-type", "image/jpeg"]]),
                    arrayBuffer: async () => new Uint8Array([1, 2]).buffer,
                };
            },
        });
        expect(await img.fetchImage("steam-570", "steam:570")).toEqual({
            type: "image/jpeg",
            data: new Uint8Array([1, 2]),
        });
        expect(urls).toEqual([
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/570/header.jpg",
        ]);

        const moved = createPresenceImages({
            fetch: async () => ({
                ok: true,
                url: "https://evil.example/x.jpg",
                headers: new Map([["content-type", "image/jpeg"]]),
                arrayBuffer: async () => new Uint8Array([1]).buffer,
            }),
        });
        expect(await moved.fetchImage("steam-570", "steam:570")).toBeNull();
    });
});

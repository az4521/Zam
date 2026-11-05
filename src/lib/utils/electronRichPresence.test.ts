import { describe, it, expect, afterEach } from "vitest";
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

const { createRichPresence, socketLocation } = electron("richPresence.cjs");
const { ipcBase } = electron("discordRpc.cjs");
const { createPresenceImages } = electron("presenceImages.cjs");
const { candidates } = electron("gameScanner.cjs");
const { loadGames } = electron("discordGames.cjs");

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

function setup() {
    const dir = mkdtempSync(join(tmpdir(), "zam-rp-"));
    dirs.push(dir);
    const events: Event[] = [];
    const rp = createRichPresence({
        send: (e: Event) => events.push(e),
        userDataDir: dir,
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

describe("game list and matching", () => {
    it("loads names, icons and this platform's executables", async () => {
        const games = await loadGames("win32");
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

    it("never starts the game scanner in a Flatpak", async () => {
        const dir = mkdtempSync(join(tmpdir(), "zam-rp-"));
        dirs.push(dir);
        const rp = createRichPresence({
            send: () => {},
            userDataDir: dir,
            inFlatpak: true,
        });
        stops.push(() => rp.stop());
        const st = await rp.configure({ local: true, scan: true });
        expect(st.scan).toMatchObject({ running: false, unsupported: true });
    });
});

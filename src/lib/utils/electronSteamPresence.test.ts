import { describe, it, expect, afterEach } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";
import http from "http";
import vm from "vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const electron = (name: string) =>
    require(join(__dirname, "../../../electron", name));

const { createSteamPresence, EXPRESSION } = electron("steamPresence.cjs");
const { WebSocketServer } = require("ws");

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(cond: () => boolean, ms = 3000) {
    const end = Date.now() + ms;
    while (!cond()) {
        if (Date.now() > end) throw new Error("timed out waiting");
        await wait(5);
    }
}

interface Target {
    id: string;
    title: string;
    type: string;
}

interface FakeSteam {
    port: number;
    targets: Target[];
    // What each target's Runtime.evaluate answers; undefined means no value.
    answers: Map<string, unknown>;
    connections: number;
    origins: unknown[];
    evaluations: number;
    sockets: Set<{ terminate(): void }>;
    stop(): Promise<void>;
}

// A stand-in for Steam's debugging port: /json/list plus a CDP WebSocket per
// target, answering Runtime.evaluate from `answers`.
async function fakeSteam(targets: Target[]): Promise<FakeSteam> {
    const server = http.createServer((req, res) => {
        if (req.url !== "/json/list") {
            res.writeHead(404);
            res.end();
            return;
        }
        const list = fake.targets.map((t) => ({
            ...t,
            webSocketDebuggerUrl: `ws://127.0.0.1:${fake.port}/devtools/page/${t.id}`,
        }));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(list));
    });
    const wss = new WebSocketServer({ server });
    const fake: FakeSteam = {
        port: 0,
        targets,
        answers: new Map(),
        connections: 0,
        origins: [],
        evaluations: 0,
        sockets: new Set(),
        async stop() {
            for (const s of fake.sockets) s.terminate();
            wss.close();
            server.closeAllConnections?.();
            await new Promise<void>((r) => server.close(() => r()));
        },
    };
    wss.on("connection", (sock: any, req: any) => {
        const id = (req.url ?? "").split("/").pop() ?? "";
        fake.connections++;
        fake.origins.push(req.headers.origin);
        fake.sockets.add(sock);
        sock.on("close", () => fake.sockets.delete(sock));
        sock.on("message", (raw: Buffer) => {
            const msg = JSON.parse(String(raw));
            if (msg.method !== "Runtime.evaluate") return;
            fake.evaluations++;
            const v = fake.answers.get(id);
            const result =
                v === undefined
                    ? { type: "undefined" }
                    : { type: "object", value: v };
            sock.send(JSON.stringify({ id: msg.id, result: { result } }));
        });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    fake.port = (server.address() as { port: number }).port;
    fakes.push(fake);
    return fake;
}

// A port with nothing listening on it.
async function closedPort(): Promise<number> {
    const server = http.createServer();
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const port = (server.address() as { port: number }).port;
    await new Promise<void>((r) => server.close(() => r()));
    return port;
}

const CS2 = {
    inGame: true,
    appId: "730",
    name: "Counter-Strike 2",
    status: "Competitive - Dust II",
    icon: "a".repeat(40),
    steamId: "76561198000000001",
    lobbyId: "",
    richPresence: { steam_display: "#StatusCS", score: "3:4" },
};
const SHARED: Target = { id: "shared", title: "SharedJSContext", type: "page" };

const stops: Array<() => Promise<void> | void> = [];
const fakes: FakeSteam[] = [];
afterEach(async () => {
    for (const stop of stops.splice(0)) await stop();
    for (const fake of fakes.splice(0)) await fake.stop();
});

function source(port: number, extra: Record<string, unknown> = {}) {
    const calls: Array<Record<string, unknown> | null> = [];
    const s = createSteamPresence({
        onSteam: (st: Record<string, unknown> | null) => calls.push(st),
        port,
        pollMs: 10,
        retryMs: 10,
        ...extra,
    });
    stops.push(() => s.stop());
    return { s, calls };
}

describe("Steam presence source", () => {
    it("treats a closed port as no game, not an error", async () => {
        const { s, calls } = source(await closedPort());
        s.start();
        await wait(100);
        expect(s.status()).toEqual({
            running: true,
            portOpen: false,
            connected: false,
            error: null,
        });
        expect(calls).toEqual([]);
    });

    it("reports a game once, over one kept socket, with no origin", async () => {
        const fake = await fakeSteam([SHARED]);
        fake.answers.set("shared", CS2);
        const { s, calls } = source(fake.port);
        s.start();
        await waitFor(() => calls.length === 1);
        await waitFor(() => fake.evaluations >= 5);
        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual({
            appId: CS2.appId,
            name: CS2.name,
            status: CS2.status,
            icon: CS2.icon,
            steamId: CS2.steamId,
            lobbyId: "",
            richPresence: CS2.richPresence,
            startedAt: expect.any(Number),
        });
        expect(fake.connections).toBe(1);
        expect(fake.origins).toEqual([undefined]);
        expect(s.status()).toEqual({
            running: true,
            portOpen: true,
            connected: true,
            error: null,
        });
    });

    it("keeps the Steam id and lobby only as digits, and re-reports a lobby change", async () => {
        const fake = await fakeSteam([SHARED]);
        fake.answers.set("shared", { ...CS2, lobbyId: "109775240000000000" });
        const { s, calls } = source(fake.port);
        s.start();
        await waitFor(() => calls.length === 1);
        expect(calls[0]).toMatchObject({
            steamId: CS2.steamId,
            lobbyId: "109775240000000000",
        });
        const startedAt = calls[0]!.startedAt;

        // Lobby left: the same game, re-reported without the lobby.
        fake.answers.set("shared", { ...CS2, lobbyId: "" });
        await waitFor(() => calls.length === 2);
        expect(calls[1]).toMatchObject({ lobbyId: "", startedAt });

        // Junk ids read as no id at all.
        fake.answers.set("shared", {
            ...CS2,
            steamId: "7656 ; x",
            lobbyId: "1".repeat(21),
        });
        await waitFor(() => calls.length === 3);
        expect(calls[2]).toMatchObject({ steamId: "", lobbyId: "" });
    });

    it("re-reports a status or rich presence change with the same startedAt", async () => {
        const fake = await fakeSteam([SHARED]);
        fake.answers.set("shared", CS2);
        const { s, calls } = source(fake.port);
        s.start();
        await waitFor(() => calls.length === 1);
        const startedAt = calls[0]!.startedAt;

        fake.answers.set("shared", { ...CS2, status: "Competitive - Mirage" });
        await waitFor(() => calls.length === 2);
        expect(calls[1]).toMatchObject({
            status: "Competitive - Mirage",
            startedAt,
        });

        fake.answers.set("shared", {
            ...CS2,
            status: "Competitive - Mirage",
            richPresence: { steam_display: "#StatusCS", score: "5:4" },
        });
        await waitFor(() => calls.length === 3);
        expect(calls[2]).toMatchObject({
            richPresence: { score: "5:4" },
            startedAt,
        });
    });

    it("reports null when the game exits, and a new start gets a new startedAt", async () => {
        const fake = await fakeSteam([SHARED]);
        fake.answers.set("shared", CS2);
        const { s, calls } = source(fake.port);
        s.start();
        await waitFor(() => calls.length === 1);
        const first = calls[0]!.startedAt as number;

        fake.answers.set("shared", { inGame: false });
        await waitFor(() => calls.at(-1) === null);
        expect(s.status().connected).toBe(true);

        await wait(20);
        fake.answers.set("shared", CS2);
        await waitFor(() => calls.length === 3);
        expect(calls[2]!.startedAt).toBeGreaterThanOrEqual(first);
    });

    it("reports null when the port closes while in a game", async () => {
        const fake = await fakeSteam([SHARED]);
        fake.answers.set("shared", CS2);
        const { s, calls } = source(fake.port);
        s.start();
        await waitFor(() => calls.length === 1);

        await fake.stop();
        fakes.splice(fakes.indexOf(fake), 1);
        await waitFor(() => calls.at(-1) === null);
        expect(s.status()).toEqual({
            running: true,
            portOpen: false,
            connected: false,
            error: null,
        });
    });

    it("ignores answers that are null, junk, or not a report", async () => {
        const fake = await fakeSteam([SHARED]);
        const { s, calls } = source(fake.port);
        s.start();
        for (const junk of [null, "junk", {}, [1, 2], { inGame: "yes" }]) {
            fake.answers.set("shared", junk);
            await waitFor(() => fake.evaluations >= 2);
            fake.evaluations = 0;
        }
        expect(calls).toEqual([]);
        expect(s.status().error).toBeNull();

        fake.answers.set("shared", CS2);
        await waitFor(() => calls.length === 1);
    });

    it("keeps looking when the SharedJSContext page is not the right one", async () => {
        const other: Target = { id: "other", title: "Steam", type: "page" };
        const fake = await fakeSteam([SHARED, other]);
        fake.answers.set("other", CS2);
        const { s, calls } = source(fake.port);
        s.start();
        await waitFor(() => calls.length === 1);
        expect(calls[0]).toMatchObject({ appId: "730" });
        expect(s.status().connected).toBe(true);
    });

    it("clips long text and falls back to a name from the app id", async () => {
        const fake = await fakeSteam([SHARED]);
        fake.answers.set("shared", {
            inGame: true,
            appId: "440",
            name: "",
            status: "x".repeat(300),
            richPresence: { k: "v".repeat(300) },
        });
        const { s, calls } = source(fake.port);
        s.start();
        await waitFor(() => calls.length === 1);
        expect(calls[0]!.name).toBe("Steam game 440");
        expect((calls[0]!.status as string).length).toBe(256);
        const rp = calls[0]!.richPresence as Record<string, string>;
        expect(rp.k!.length).toBe(256);
    });

    it("stop() reports null, closes the socket and stops polling", async () => {
        const fake = await fakeSteam([SHARED]);
        fake.answers.set("shared", CS2);
        const { s, calls } = source(fake.port);
        s.start();
        await waitFor(() => calls.length === 1);

        s.stop();
        expect(calls.at(-1)).toBeNull();
        expect(s.status()).toEqual({
            running: false,
            portOpen: false,
            connected: false,
            error: null,
        });
        await waitFor(() => fake.sockets.size === 0);
        const seen = fake.evaluations;
        const count = calls.length;
        await wait(60);
        expect(fake.evaluations).toBe(seen);
        expect(calls.length).toBe(count);
    });

    it("stop() with nothing reported does not call onSteam", async () => {
        const fake = await fakeSteam([SHARED]);
        const { s, calls } = source(fake.port);
        s.start();
        await wait(30);
        s.stop();
        expect(calls).toEqual([]);
    });
});

describe("Steam join links", () => {
    const { steamJoinUrl, steamRunUrl, isConnectString } =
        electron("steamUrl.cjs");
    const FRIEND = "76561198000000001";
    const LOBBY = "109775240000000000";

    it("opens the friend's lobby when there is one, as Steam's Join Game does", () => {
        expect(
            steamJoinUrl({
                appId: "730",
                steamId: FRIEND,
                lobbyId: LOBBY,
                connect: "+connect 1.2.3.4:27015",
            }),
        ).toBe(`steam://joinlobby/730/${LOBBY}/${FRIEND}`);
        // No connect string is needed for a lobby.
        expect(
            steamJoinUrl({ appId: "730", steamId: FRIEND, lobbyId: LOBBY }),
        ).toBe(`steam://joinlobby/730/${LOBBY}/${FRIEND}`);
    });

    it("joins the friend's game with the encoded connect string otherwise", () => {
        expect(
            steamJoinUrl({
                appId: "730",
                steamId: FRIEND,
                connect: "+connect 1.2.3.4:27015",
            }),
        ).toBe(`steam://rungame/730/${FRIEND}/%2Bconnect%201.2.3.4%3A27015`);
        // A lobby id that is not digits is not used; the game is joined instead.
        expect(
            steamJoinUrl({
                appId: "730",
                steamId: FRIEND,
                lobbyId: "1x",
                connect: "c",
            }),
        ).toBe(`steam://rungame/730/${FRIEND}/c`);
    });

    it("gives null when the parts do not allow a join", () => {
        const connect = "+connect 1.2.3.4:27015";
        for (const req of [
            { appId: "x", steamId: FRIEND, lobbyId: LOBBY },
            { appId: "730", steamId: "", lobbyId: LOBBY, connect },
            { appId: "730", steamId: "7656/../x", connect },
            { appId: "730", steamId: FRIEND },
            { appId: "730", steamId: FRIEND, connect: "" },
            { appId: "730", steamId: FRIEND, connect: "a\nb" },
            { appId: "730", connect },
            { appId: "730", lobbyId: LOBBY, connect },
        ]) {
            expect(steamJoinUrl(req)).toBeNull();
        }
    });

    it("builds the run-with-arguments link, encoding the connect string", () => {
        expect(
            steamRunUrl({ appId: "730", connect: "+connect 1.2.3.4:27015" }),
        ).toBe("steam://run/730//%2Bconnect%201.2.3.4%3A27015/");
        // TF2's own party string lacks the argument its handler needs.
        const party = "+tf_party_request_join_user 76561198047388312";
        expect(
            steamJoinUrl({ appId: "440", connect: party, steamId: FRIEND }),
        ).toBe(
            `steam://rungame/440/${FRIEND}/${encodeURIComponent(party + " 0")}`,
        );
        expect(
            steamJoinUrl({
                appId: "440",
                connect: party + " 1",
                steamId: FRIEND,
            }),
        ).toBe(
            `steam://rungame/440/${FRIEND}/${encodeURIComponent(party + " 1")}`,
        );
        expect(
            steamJoinUrl({ appId: "730", connect: party, steamId: FRIEND }),
        ).toBe(`steam://rungame/730/${FRIEND}/${encodeURIComponent(party)}`);
        expect(steamRunUrl({ appId: "1", connect: "é/?#" })).toBe(
            `steam://run/1//${encodeURIComponent("é/?#")}/`,
        );
    });

    it("rejects an app id that is not digits", () => {
        for (const appId of [
            "",
            "abc",
            "12a",
            "-1",
            "1.5",
            "1/../x",
            "1".repeat(21),
        ]) {
            expect(steamRunUrl({ appId, connect: "c" })).toBeNull();
        }
    });

    it("rejects connect strings with control characters, empty or too long", () => {
        for (const connect of [
            "",
            "a\u0000",
            "a\tb",
            "a\nb",
            "a\u007f",
            "x".repeat(513),
        ]) {
            expect(steamRunUrl({ appId: "730", connect })).toBeNull();
            expect(isConnectString(connect)).toBe(false);
        }
        expect(
            steamRunUrl({ appId: "730", connect: "x".repeat(512) }),
        ).not.toBeNull();
    });
});

describe("Steam presence expression", () => {
    const run = (window: unknown) => vm.runInNewContext(EXPRESSION, { window });

    const persona = {
        m_unGamePlayedAppID: 730,
        m_strGameExtraInfo: "CS2",
        m_mapRichPresence: new Map([["steam_display", "#x"]]),
        GetCurrentGameStatus: () => "Dust II",
    };

    it("reads the local player's game, rich presence and icon", () => {
        const window = {
            friendStore: {
                m_FriendsUIFriendStore: {
                    self: { steamid64: "76561198000000001", persona },
                },
            },
            appStore: {
                GetAppOverviewByAppID: (id: number) =>
                    id === 730 ? { icon_hash: "b".repeat(40) } : null,
            },
        };
        expect(run(window)).toEqual({
            inGame: true,
            appId: "730",
            name: "CS2",
            status: "Dust II",
            icon: "b".repeat(40),
            steamId: "76561198000000001",
            lobbyId: "",
            richPresence: { steam_display: "#x" },
        });
    });

    it("reads the lobby only when Steam says it is a valid one", () => {
        const lobby = { m_game_lobby_id: "109775240000000000" };
        const read = (extra: Record<string, unknown>) =>
            run({
                friendStore: {
                    self: {
                        steamid64: "76561198000000001",
                        persona: { ...persona, ...extra },
                    },
                },
            });
        expect(read({ is_in_valid_lobby: true, ...lobby })).toMatchObject({
            lobbyId: "109775240000000000",
        });
        expect(read({ is_in_valid_lobby: false, ...lobby })).toMatchObject({
            lobbyId: "",
        });
        expect(
            read({ is_in_valid_lobby: true, m_game_lobby_id: "0" }),
        ).toMatchObject({ lobbyId: "" });
        expect(read({ is_in_valid_lobby: true })).toMatchObject({
            lobbyId: "",
        });
    });

    it("answers an empty Steam id when the self object has none", () => {
        expect(run({ friendStore: { self: { persona } } })).toMatchObject({
            steamId: "",
        });
    });

    it("still reads the game when Steam has no app store or icon", () => {
        const window = { friendStore: { self: { persona } } };
        expect(run(window)).toMatchObject({ appId: "730", icon: "" });
    });

    it("answers null without a friend store and inGame false when idle", () => {
        expect(run({})).toBeNull();
        expect(
            run({
                friendStore: { self: { persona: { m_unGamePlayedAppID: 0 } } },
            }),
        ).toEqual({ inGame: false });
    });
});

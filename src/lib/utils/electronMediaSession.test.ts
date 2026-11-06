import { describe, it, expect, afterEach } from "vitest";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const electron = (name: string) =>
    require(join(__dirname, "../../../electron", name));

const {
    createTrackDiffer,
    friendlyName,
    mprisId,
    parseMacosErrors,
    parseMacosOutput,
    parseMprisProps,
    parseSmtcLine,
    readArt,
} = electron("mediaSession.cjs");

// The first bytes of a PNG and of a JPEG, enough for the type check.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]);

describe("Windows media lines", () => {
    it("reads a session line and the end of a poll", () => {
        const line = JSON.stringify({
            SourceAppUserModelId: "Spotify.exe",
            title: " Song ",
            artist: "Band",
            albumTitle: "Album",
            playbackStatus: "Playing",
            positionMs: 12000.4,
            endTimeMs: 200000,
        });
        expect(parseSmtcLine(line)).toEqual({
            end: false,
            playerId: "spotify.exe",
            playerName: "Spotify",
            playing: true,
            title: "Song",
            artist: "Band",
            album: "Album",
            durationMs: 200000,
            positionMs: 12000,
        });
        expect(parseSmtcLine('{"end":true}')).toEqual({ end: true });
        // A byte order mark from the console is ignored.
        expect(parseSmtcLine("\uFEFF" + line)).not.toBeNull();
        expect(parseSmtcLine("not json")).toBeNull();
        expect(parseSmtcLine('{"title":"no id"}')).toBeNull();
    });

    it("names players from their app ids", () => {
        expect(friendlyName("Spotify.exe")).toBe("Spotify");
        expect(friendlyName("Chrome")).toBe("Chrome");
        expect(
            friendlyName(
                "Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic",
            ),
        ).toBe("ZuneMusic");
        expect(friendlyName("AppleInc.AppleMusic_nzyj56d3rj3mt!App")).toBe(
            "AppleMusic",
        );
        expect(friendlyName("C:\\Program Files\\VLC\\vlc.exe")).toBe("vlc");
    });
});

describe("Linux media players", () => {
    it("reads a playing player's properties", () => {
        const props = {
            PlaybackStatus: "Playing",
            Metadata: {
                "xesam:title": "Track",
                "xesam:artist": ["One", "Two"],
                "xesam:album": "Record",
                "mpris:length": 180_000_000,
            },
            Position: 5_000_000,
        };
        expect(
            parseMprisProps(
                "org.mpris.MediaPlayer2.chromium.instance9",
                props,
                "Chromium",
            ),
        ).toEqual({
            end: false,
            playerId: "chromium",
            playerName: "Chromium",
            playing: true,
            title: "Track",
            artist: "One, Two",
            album: "Record",
            durationMs: 180000,
            positionMs: 5000,
        });
    });

    it("reads the pairs that D-Bus gives for Metadata", () => {
        const props = {
            PlaybackStatus: "Paused",
            Metadata: [
                ["xesam:title", ["s", ["Quiet"]]],
                ["xesam:artist", ["as", [["Someone"]]]],
            ],
        };
        const s = parseMprisProps("org.mpris.MediaPlayer2.vlc", props);
        expect(s).toMatchObject({
            playerId: "vlc",
            playerName: "vlc",
            playing: false,
            title: "Quiet",
            artist: "Someone",
        });
    });

    it("drops the bus name's prefix and instance suffix", () => {
        expect(mprisId("org.mpris.MediaPlayer2.Spotify")).toBe("spotify");
        expect(mprisId("org.mpris.MediaPlayer2.vlc.instance42")).toBe("vlc");
    });
});

describe("track diffing", () => {
    const sess = (over: Record<string, unknown> = {}) => ({
        end: false,
        playerId: "spotify",
        playerName: "Spotify",
        playing: true,
        title: "Song",
        artist: "Band",
        album: "Album",
        durationMs: 200000,
        positionMs: 10000,
        ...over,
    });

    it("reports a track once, then only changes, seeks and stops", () => {
        const got: unknown[] = [];
        const d = createTrackDiffer((e: unknown) => got.push(e));
        const t0 = 1_000_000;

        d.update([sess()], t0);
        expect(got).toHaveLength(1);
        expect(got[0]).toMatchObject({
            playerId: "spotify",
            track: { title: "Song", positionMs: 10000, startedAt: t0 - 10000 },
        });

        // Two seconds later, on time: nothing new.
        d.update([sess({ positionMs: 12000 })], t0 + 2000);
        expect(got).toHaveLength(1);

        // A seek of more than 3 seconds is reported again.
        d.update([sess({ positionMs: 60000 })], t0 + 4000);
        expect(got).toHaveLength(2);

        // A new title is reported.
        d.update([sess({ title: "Next", positionMs: 0 })], t0 + 6000);
        expect(got).toHaveLength(3);

        // Paused counts as nothing playing.
        d.update([sess({ title: "Next", playing: false })], t0 + 8000);
        expect(got[3]).toEqual({
            playerId: "spotify",
            playerName: "Spotify",
            track: null,
        });

        // A player that vanishes from the snapshot is cleared once.
        d.update([sess()], t0 + 9000);
        d.update([], t0 + 10000);
        d.update([], t0 + 11000);
        expect(
            got.filter((e) => (e as { track: unknown }).track === null),
        ).toHaveLength(2);
    });

    it("keeps players apart", () => {
        const got: Array<{ playerId: string }> = [];
        const d = createTrackDiffer((e: { playerId: string }) => got.push(e));
        d.update(
            [sess(), sess({ playerId: "vlc", playerName: "vlc", title: "X" })],
            0,
        );
        expect(got.map((e) => e.playerId)).toEqual(["spotify", "vlc"]);
    });
});

describe("macOS media players", () => {
    it("reads the sessions the script prints", () => {
        const out = JSON.stringify([
            {
                playerId: "spotify",
                playerName: "Spotify",
                playing: true,
                title: " Song ",
                artist: "Band",
                album: "Album",
                durationMs: 200000,
                positionMs: 12000,
            },
            {
                playerId: "music",
                playerName: "Music",
                playing: true,
                title: "Other",
                artist: "Someone",
                album: "Record",
                durationMs: 180000,
                positionMs: 5000.6,
            },
        ]);
        expect(parseMacosOutput(out + "\n")).toEqual([
            {
                playerId: "spotify",
                playerName: "Spotify",
                playing: true,
                title: "Song",
                artist: "Band",
                album: "Album",
                durationMs: 200000,
                positionMs: 12000,
            },
            {
                playerId: "music",
                playerName: "Music",
                playing: true,
                title: "Other",
                artist: "Someone",
                album: "Record",
                durationMs: 180000,
                positionMs: 5001,
            },
        ]);
    });

    it("gives nothing for empty or garbage output", () => {
        expect(parseMacosOutput("")).toEqual([]);
        expect(parseMacosOutput("  \n")).toEqual([]);
        expect(parseMacosOutput("not json")).toEqual([]);
        expect(parseMacosOutput('{"playerId":"spotify"}')).toEqual([]);
        expect(parseMacosOutput('[1, null, "x", {"title":"no id"}]')).toEqual(
            [],
        );
        expect(parseMacosOutput(undefined as unknown as string)).toEqual([]);
    });

    it("keeps a paused session, and fills in missing fields", () => {
        const out = JSON.stringify([
            {
                playerId: "music",
                playerName: "Music",
                playing: false,
                title: "Paused",
            },
        ]);
        expect(parseMacosOutput(out)).toEqual([
            {
                playerId: "music",
                playerName: "Music",
                playing: false,
                title: "Paused",
                artist: "",
                album: "",
                durationMs: 0,
                positionMs: 0,
            },
        ]);
    });

    it("reads failures apart from sessions", () => {
        const out = JSON.stringify([
            {
                error: true,
                app: "Spotify",
                denied: true,
                message:
                    "Not authorized to send Apple events to Spotify. (-1743)",
            },
            { error: true, app: "Music", denied: false, message: "boom" },
        ]);
        expect(parseMacosOutput(out)).toEqual([]);
        expect(parseMacosErrors(out)).toEqual([
            {
                app: "Spotify",
                denied: true,
                message:
                    "Not authorized to send Apple events to Spotify. (-1743)",
            },
            { app: "Music", denied: false, message: "boom" },
        ]);
        expect(parseMacosErrors("")).toEqual([]);
    });
});

describe("cover art", () => {
    it("reads a PNG or JPEG cover from a session line and drops anything else", () => {
        const line = (extra: Record<string, unknown>) =>
            JSON.stringify({
                SourceAppUserModelId: "Spotify.exe",
                title: "Song",
                playbackStatus: "Playing",
                ...extra,
            });
        expect(
            parseSmtcLine(
                line({ cover: PNG.toString("base64"), coverType: "image/png" }),
            ).cover,
        ).toEqual({ type: "image/png", data: new Uint8Array(PNG) });
        expect(
            parseSmtcLine(line({ cover: JPG.toString("base64") })).cover,
        ).toEqual({ type: "image/jpeg", data: new Uint8Array(JPG) });
        expect(
            parseSmtcLine(
                line({ cover: Buffer.from("hello").toString("base64") }),
            ).cover,
        ).toBeUndefined();
        expect(parseSmtcLine(line({ cover: 42 })).cover).toBeUndefined();
        expect(parseSmtcLine(line({})).cover).toBeUndefined();
        // Over 1.5 MB is dropped.
        const big = Buffer.concat([PNG, Buffer.alloc(1600 * 1024)]);
        expect(
            parseSmtcLine(line({ cover: big.toString("base64") })).cover,
        ).toBeUndefined();
    });

    it("carries a track's cover through seeks and pauses, and clears it with a new track", () => {
        const got: Array<{ track: { cover?: unknown } | null }> = [];
        const d = createTrackDiffer((e: unknown) =>
            got.push(e as (typeof got)[number]),
        );
        const sess = (over: Record<string, unknown> = {}) => ({
            end: false,
            playerId: "spotify",
            playerName: "Spotify",
            playing: true,
            title: "Song",
            artist: "Band",
            album: "Album",
            durationMs: 200000,
            positionMs: 10000,
            ...over,
        });
        const cover = { type: "image/png", data: new Uint8Array(PNG) };
        const t0 = 1_000_000;

        d.update([sess({ cover })], t0);
        expect(got[0].track?.cover).toEqual(cover);

        // On time, with no cover in this poll: nothing sent.
        d.update([sess({ positionMs: 12000 })], t0 + 2000);
        expect(got).toHaveLength(1);

        // A seek is sent again, still with the cover.
        d.update([sess({ positionMs: 60000 })], t0 + 4000);
        expect(got[1].track?.cover).toEqual(cover);

        // Paused, then resumed on the same track: the cover comes back.
        d.update([sess({ playing: false })], t0 + 6000);
        d.update([sess({ positionMs: 60000 })], t0 + 8000);
        expect(got[3].track?.cover).toEqual(cover);

        // A new track with no cover of its own has none.
        d.update([sess({ title: "Next", positionMs: 0 })], t0 + 10000);
        expect(got[4].track?.cover).toBeUndefined();
    });
});

describe("cover art from URLs", () => {
    const calls: string[] = [];
    afterEach(() => (calls.length = 0));
    const fetchStub =
        (bytes: Buffer = PNG) =>
        async (url: string) => {
            calls.push(url);
            return {
                ok: true,
                url,
                headers: new Map([["content-length", String(bytes.length)]]),
                arrayBuffer: async () => new Uint8Array(bytes).buffer,
            };
        };

    it("fetches only from i.scdn.co, and maps open.spotify.com images to it", async () => {
        const f = fetchStub();
        expect(
            await readArt("https://i.scdn.co/image/ab67616d0000b273", f),
        ).toEqual({ type: "image/png", data: new Uint8Array(PNG) });
        expect(calls).toEqual(["https://i.scdn.co/image/ab67616d0000b273"]);
        calls.length = 0;

        expect(
            await readArt("https://open.spotify.com/image/ab67616d0000b273", f),
        ).toEqual({ type: "image/png", data: new Uint8Array(PNG) });
        expect(calls).toEqual(["https://i.scdn.co/image/ab67616d0000b273"]);
        calls.length = 0;

        for (const bad of [
            "http://192.168.1.5/x",
            "https://192.168.1.5/x.png",
            "https://evil.example/x.png",
            "https://i.scdn.co.evil.example/x.png",
            "https://i.scdn.co:8443/image/x",
            "https://open.spotify.com/track/abc",
            "javascript:alert(1)",
            "not a url",
        ])
            expect(await readArt(bad, f)).toBeUndefined();
        expect(calls).toEqual([]);
    });

    it("refuses a redirect off i.scdn.co, and bytes that are not an image", async () => {
        const redirected = async (url: string) => ({
            ok: true,
            url: "https://evil.example/x.png",
            headers: new Map(),
            arrayBuffer: async () => new Uint8Array(PNG).buffer,
        });
        expect(
            await readArt(
                "https://i.scdn.co/image/ab67616d0000b273",
                redirected,
            ),
        ).toBeUndefined();
        expect(
            await readArt(
                "https://i.scdn.co/image/ab67616d0000b273",
                fetchStub(Buffer.from("<html>")),
            ),
        ).toBeUndefined();
        // Without a fetch function, https art is not read at all.
        expect(
            await readArt(
                "https://i.scdn.co/image/ab67616d0000b273",
                undefined,
            ),
        ).toBeUndefined();
    });

    it("reads a file:// art file, and refuses one that is not an image", async () => {
        const dir = mkdtempSync(join(tmpdir(), "zam-art-"));
        try {
            const png = join(dir, "cover.png");
            const text = join(dir, "notes.png");
            writeFileSync(png, PNG);
            writeFileSync(text, "hello");
            expect(await readArt(pathToFileURL(png).href)).toEqual({
                type: "image/png",
                data: new Uint8Array(PNG),
            });
            expect(await readArt(pathToFileURL(text).href)).toBeUndefined();
            expect(calls).toEqual([]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("refuses a file:// image outside the cache and temp folders", async () => {
        // The working directory is the project, not a place players keep covers.
        const outside = join(process.cwd(), "zam-art-outside.png");
        writeFileSync(outside, PNG);
        try {
            expect(await readArt(pathToFileURL(outside).href)).toBeUndefined();
        } finally {
            rmSync(outside, { force: true });
        }
    });

    it("takes the MPRIS art URL from Metadata", () => {
        const player = parseMprisProps(
            "org.mpris.MediaPlayer2.spotify",
            {
                PlaybackStatus: "Playing",
                Metadata: {
                    "xesam:title": "Track",
                    "mpris:artUrl": "https://i.scdn.co/image/ab67616d0000b273",
                },
            },
            "Spotify",
        );
        expect(player.artUrl).toBe("https://i.scdn.co/image/ab67616d0000b273");
    });
});

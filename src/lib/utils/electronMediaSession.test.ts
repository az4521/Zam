import { describe, it, expect } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const electron = (name: string) =>
    require(join(__dirname, "../../../electron", name));

const {
    createTrackDiffer,
    friendlyName,
    mprisId,
    parseMprisProps,
    parseSmtcLine,
} = electron("mediaSession.cjs");

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

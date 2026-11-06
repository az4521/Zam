import { describe, it, expect } from "vitest";
import {
    discordActivityToEntry,
    fillOpenidPlaceholder,
    nextRpcExpiry,
    parseRpcEntry,
    parseRpcField,
    pickPublishable,
    serializeRpcEntry,
    type RpcEntry,
} from "./richPresence";

const NOW = 1_700_000_000_000;
const activity = (extra: Record<string, unknown> = {}) => ({
    id: "a",
    type: "m.rpc.activity",
    name: "Game",
    expiry: NOW + 60_000,
    ...extra,
});

describe("parseRpcEntry", () => {
    it("reads stable and unstable type ids", () => {
        expect(parseRpcEntry(activity())?.kind).toBe("activity");
        expect(
            parseRpcEntry(activity({ type: "xyz.extera.msc4544.rpc.activity" }))
                ?.kind,
        ).toBe("activity");
        expect(
            parseRpcEntry({
                id: "m",
                type: "m.rpc.music",
                track: "Song",
                expiry: NOW + 1,
            })?.kind,
        ).toBe("music");
    });

    it("rejects entries missing id, expiry, or the required name/track", () => {
        expect(parseRpcEntry(activity({ id: "" }))).toBeNull();
        expect(parseRpcEntry(activity({ expiry: "soon" }))).toBeNull();
        expect(parseRpcEntry(activity({ name: " " }))).toBeNull();
        expect(parseRpcEntry({ ...activity(), type: "m.other" })).toBeNull();
        expect(
            parseRpcEntry({ id: "m", type: "m.rpc.music", expiry: NOW + 1 }),
        ).toBeNull();
    });

    it("keeps only mxc icons, and a small icon only with a large one", () => {
        const e = parseRpcEntry(
            activity({
                large_icon_url: "https://evil.example/x.png",
                small_icon_url: "mxc://s/small",
            }),
        ) as Extract<RpcEntry, { kind: "activity" }>;
        expect(e.largeIconUrl).toBeUndefined();
        expect(e.smallIconUrl).toBeUndefined();
        const ok = parseRpcEntry(
            activity({
                large_icon_url: "mxc://s/large",
                small_icon_url: "mxc://s/small",
            }),
        ) as Extract<RpcEntry, { kind: "activity" }>;
        expect(ok.largeIconUrl).toBe("mxc://s/large");
        expect(ok.smallIconUrl).toBe("mxc://s/small");
    });

    it("drops buttons with non-web URLs and caps them at three", () => {
        const e = parseRpcEntry(
            activity({
                buttons: [
                    { label: "bad", url: "javascript:alert(1)" },
                    { label: "file", url: "file:///etc/passwd" },
                    { label: "1", url: "https://a.example" },
                    { label: "2", url: "https://b.example" },
                    { label: "3", url: "https://c.example/{openid_data}" },
                    { label: "4", url: "https://d.example" },
                ],
            }),
        )!;
        expect(e.buttons.map((b) => b.label)).toEqual(["1", "2", "3"]);
    });

    it("needs both music progress bounds or none", () => {
        const base = {
            id: "m",
            type: "m.rpc.music",
            track: "T",
            expiry: NOW + 1,
        };
        expect(
            (
                parseRpcEntry({ ...base, progress: { since: 5 } }) as Extract<
                    RpcEntry,
                    { kind: "music" }
                >
            ).progress,
        ).toBeUndefined();
        expect(
            (
                parseRpcEntry({
                    ...base,
                    progress: { since: 5, until: 10 },
                }) as Extract<RpcEntry, { kind: "music" }>
            ).progress,
        ).toEqual({ since: 5, until: 10 });
    });
});

describe("parseRpcField", () => {
    it("filters expired and malformed entries and caps at four", () => {
        const value = [
            activity({ id: "old", expiry: NOW - 1 }),
            "junk",
            ...[1, 2, 3, 4, 5].map((n) => activity({ id: `n${n}` })),
        ];
        const out = parseRpcField(value, NOW);
        expect(out.map((e) => e.id)).toEqual(["n1", "n2", "n3", "n4"]);
        expect(parseRpcField("nope", NOW)).toEqual([]);
    });

    it("finds the soonest expiry", () => {
        const out = parseRpcField(
            [
                activity({ id: "a", expiry: NOW + 90_000 }),
                activity({ id: "b", expiry: NOW + 30_000 }),
            ],
            NOW,
        );
        expect(nextRpcExpiry(out)).toBe(NOW + 30_000);
        expect(nextRpcExpiry([])).toBeNull();
    });
});

describe("serializeRpcEntry", () => {
    it("round-trips under the unstable type id", () => {
        const entry = parseRpcEntry(
            activity({
                details: "d",
                since: NOW,
                buttons: [
                    {
                        label: "Go",
                        url: "https://x.example",
                        request_openid: true,
                    },
                ],
            }),
        )!;
        const wire = serializeRpcEntry(entry);
        expect(wire.type).toBe("xyz.extera.msc4544.rpc.activity");
        expect(parseRpcEntry(wire)).toEqual(entry);
    });
});

describe("discordActivityToEntry", () => {
    it("maps a game with timestamps and buttons", () => {
        const e = discordActivityToEntry(
            {
                name: "",
                details: "In menu",
                state: "Lobby",
                timestamps: { start: NOW },
                buttons: ["Join", "Bad"],
                metadata: {
                    button_urls: ["https://join.example", "javascript:x"],
                },
            },
            "arrpc-1",
            "Overwatch 2",
            NOW + 1000,
        ) as Extract<RpcEntry, { kind: "activity" }>;
        expect(e.kind).toBe("activity");
        expect(e.name).toBe("Overwatch 2");
        expect(e.details).toBe("In menu");
        expect(e.since).toBe(NOW);
        expect(e.buttons).toEqual([
            {
                label: "Join",
                url: "https://join.example",
                requestOpenid: false,
            },
        ]);
    });

    it("maps Listening activities to music", () => {
        const e = discordActivityToEntry(
            {
                type: 2,
                name: "Spotify",
                details: "Song",
                state: "by Artist",
                timestamps: { start: NOW, end: NOW + 1000 },
            },
            "arrpc-2",
            "Spotify",
            NOW + 1000,
        ) as Extract<RpcEntry, { kind: "music" }>;
        expect(e.kind).toBe("music");
        expect(e.track).toBe("Song");
        expect(e.artist).toBe("Artist");
        expect(e.progress).toEqual({ since: NOW, until: NOW + 1000 });
    });

    it("puts the party size after the state, as Discord does", () => {
        const e = discordActivityToEntry(
            { state: "Lobby", party: { id: "p", size: [3, 4] } },
            "arrpc-3",
            "App",
            NOW,
        ) as Extract<RpcEntry, { kind: "activity" }>;
        expect(e.state).toBe("Lobby (3 of 4)");
        const bare = discordActivityToEntry(
            { party: { size: [1, 2] } },
            "arrpc-4",
            "App",
            NOW,
        ) as Extract<RpcEntry, { kind: "activity" }>;
        expect(bare.state).toBe("(1 of 2)");
        const bad = discordActivityToEntry(
            { state: "Lobby", party: { size: [5, 4] } },
            "arrpc-5",
            "App",
            NOW,
        ) as Extract<RpcEntry, { kind: "activity" }>;
        expect(bad.state).toBe("Lobby");
    });

    it("names watching, competing and streaming in the state", () => {
        const state = (extra: Record<string, unknown>) =>
            (
                discordActivityToEntry(extra, "x", "App", NOW) as Extract<
                    RpcEntry,
                    { kind: "activity" }
                >
            ).state;
        expect(state({ type: 3, state: "Ep 2" })).toBe("Watching · Ep 2");
        expect(state({ type: 5 })).toBe("Competing");
        expect(state({ type: 1, state: "Live", party: { size: [1, 2] } })).toBe(
            "Streaming · Live (1 of 2)",
        );
        expect(state({ type: 0, state: "Lobby" })).toBe("Lobby");
    });

    it("returns null for nothing", () => {
        expect(discordActivityToEntry(null, "x", "", NOW)).toBeNull();
    });
});

describe("pickPublishable", () => {
    it("keeps current entries, newest first, at most four", () => {
        const mk = (id: string, expiry: number) =>
            parseRpcEntry(activity({ id, expiry }))!;
        const out = pickPublishable(
            [
                { entry: mk("gone", NOW - 1), updated: 9 },
                ...[1, 2, 3, 4, 5].map((n) => ({
                    entry: mk(`e${n}`, NOW + 1000),
                    updated: n,
                })),
            ],
            NOW,
        );
        expect(out.map((e) => e.id)).toEqual(["e5", "e4", "e3", "e2"]);
    });
});

describe("fillOpenidPlaceholder", () => {
    it("substitutes the URL-encoded token JSON", () => {
        const url = fillOpenidPlaceholder(
            "https://x.example/?t={openid_data}",
            {
                access_token: "a b",
            },
        );
        expect(url).toBe(
            `https://x.example/?t=${encodeURIComponent('{"access_token":"a b"}')}`,
        );
    });
});

import { describe, it, expect, afterEach, vi } from "vitest";
import {
    buildVideoTiles,
    nextFocus,
    newRemoteShares,
    pickPipTile,
    snapPipToEdge,
    canScreenShare,
    screenShareSupportedHere,
    type VideoPublicationInput,
} from "./videoTiles";

const pub = (
    over: Partial<VideoPublicationInput> & { identity: string },
): VideoPublicationInput => ({
    userId: over.identity.slice(0, over.identity.lastIndexOf(":")),
    source: "camera",
    isLocal: false,
    track: {},
    ...over,
});

describe("buildVideoTiles", () => {
    it("keys tiles by identity+source and derives userId", () => {
        const [t] = buildVideoTiles([pub({ identity: "@a:x:D1" })]);
        expect(t.key).toBe("@a:x:D1:camera");
        expect(t.userId).toBe("@a:x");
    });

    it("lets one user occupy a camera AND a screenshare tile", () => {
        const tiles = buildVideoTiles([
            pub({ identity: "@a:x:D1", source: "camera" }),
            pub({ identity: "@a:x:D1", source: "screenshare" }),
        ]);
        expect(tiles.map((t) => t.key)).toEqual([
            "@a:x:D1:screenshare",
            "@a:x:D1:camera",
        ]);
    });

    it("orders screenshares before cameras, stable by identity", () => {
        const tiles = buildVideoTiles([
            pub({
                identity: "@b:x:D:camera".replace(":camera", ""),
                source: "camera",
            }),
            pub({ identity: "@a:x:D", source: "camera" }),
            pub({ identity: "@c:x:D", source: "screenshare" }),
        ]);
        expect(tiles.map((t) => t.source)).toEqual([
            "screenshare",
            "camera",
            "camera",
        ]);
        expect(tiles[1].identity).toBe("@a:x:D");
        expect(tiles[2].identity).toBe("@b:x:D");
    });

    it("dedupes a repeated identity+source", () => {
        const tiles = buildVideoTiles([
            pub({ identity: "@a:x:D1" }),
            pub({ identity: "@a:x:D1" }),
        ]);
        expect(tiles).toHaveLength(1);
    });
});

describe("nextFocus", () => {
    const tiles = (keys: string[]): ReturnType<typeof buildVideoTiles> =>
        keys.map((k) => {
            const [source] = k.endsWith("screenshare")
                ? ["screenshare" as const]
                : ["camera" as const];
            return {
                key: k,
                identity: k.replace(/:(camera|screenshare)$/, ""),
                userId: "@u:x",
                source,
                isLocal: false,
                track: {},
            };
        });

    it("keeps a still-present current focus", () => {
        expect(
            nextFocus(
                ["@a:x:D:screenshare"],
                tiles(["@a:x:D:screenshare"]),
                "@a:x:D:screenshare",
            ),
        ).toBe("@a:x:D:screenshare");
    });

    it("clears focus when the focused tile leaves", () => {
        expect(
            nextFocus(["@a:x:D:screenshare"], tiles([]), "@a:x:D:screenshare"),
        ).toBeNull();
    });

    it("auto-focuses a newly appeared screenshare when nothing is focused", () => {
        expect(nextFocus([], tiles(["@a:x:D:screenshare"]), null)).toBe(
            "@a:x:D:screenshare",
        );
    });

    it("does not auto-focus our own new screenshare", () => {
        const own = tiles(["@me:x:D:screenshare"]).map((t) => ({
            ...t,
            isLocal: true,
        }));
        expect(nextFocus([], own, null)).toBeNull();
    });

    it("does not auto-focus a screenshare that was already present", () => {
        expect(
            nextFocus(
                ["@a:x:D:screenshare"],
                tiles(["@a:x:D:screenshare"]),
                null,
            ),
        ).toBeNull();
    });

    it("does not steal a manual camera focus when a new screenshare arrives", () => {
        expect(
            nextFocus(
                ["@a:x:D:camera"],
                tiles(["@b:x:D:screenshare", "@a:x:D:camera"]),
                "@a:x:D:camera",
            ),
        ).toBe("@a:x:D:camera");
    });
});

describe("newRemoteShares", () => {
    it("lists only other people's shares that just appeared", () => {
        const tiles = buildVideoTiles([
            pub({ identity: "@a:x:D", source: "screenshare" }),
            pub({ identity: "@b:x:D", source: "screenshare" }),
            pub({ identity: "@c:x:D", source: "camera" }),
            pub({ identity: "@me:x:D", source: "screenshare", isLocal: true }),
        ]);
        expect(
            newRemoteShares(["@a:x:D:screenshare"], tiles).map((t) => t.key),
        ).toEqual(["@b:x:D:screenshare"]);
    });
});

describe("canScreenShare", () => {
    it("is true when getDisplayMedia is a function", () => {
        expect(canScreenShare({ getDisplayMedia: () => {} })).toBe(true);
    });
    it("is false when absent (mobile WebView)", () => {
        expect(canScreenShare({})).toBe(false);
    });
});

describe("screenShareSupportedHere", () => {
    const original = Object.getOwnPropertyDescriptor(
        globalThis.navigator,
        "mediaDevices",
    );
    const setMediaDevices = (value: unknown) =>
        Object.defineProperty(globalThis.navigator, "mediaDevices", {
            value,
            configurable: true,
        });
    afterEach(() => {
        // First — a failing expect() skips any cleanup left in a test body,
        // and every line below dereferences globalThis.navigator.
        vi.unstubAllGlobals();
        if (original)
            Object.defineProperty(
                globalThis.navigator,
                "mediaDevices",
                original,
            );
        else
            Reflect.deleteProperty(
                globalThis.navigator as unknown as object,
                "mediaDevices",
            );
    });

    it("reads getDisplayMedia off navigator.mediaDevices", () => {
        setMediaDevices({ getDisplayMedia: () => {} });
        expect(screenShareSupportedHere()).toBe(true);
    });

    it("is false when mediaDevices exists without getDisplayMedia", () => {
        setMediaDevices({});
        expect(screenShareSupportedHere()).toBe(false);
    });

    it("is false when navigator.mediaDevices is undefined", () => {
        setMediaDevices(undefined);
        expect(screenShareSupportedHere()).toBe(false);
    });

    it("survives there being no navigator at all (SSR/prerender)", () => {
        // `typeof x` is "undefined" for a bound-but-undefined global too, so
        // this really does take the typeof arm rather than the optional chain.
        vi.stubGlobal("navigator", undefined);
        expect(typeof navigator).toBe("undefined"); // prove the stub landed
        expect(screenShareSupportedHere()).toBe(false);
    });
});

describe("pickPipTile", () => {
    const local = pub({ identity: "@me:x:D1", isLocal: true });
    const localShare = pub({
        identity: "@me:x:D1",
        isLocal: true,
        source: "screenshare",
    });
    const alice = pub({ identity: "@alice:x:D1" });
    const bob = pub({ identity: "@bob:x:D1" });
    const aliceShare = pub({ identity: "@alice:x:D1", source: "screenshare" });
    const none = {
        pinned: null,
        focused: null,
        current: null,
        speakingUserIds: new Set<string>(),
    };
    const key = (t: { key: string } | null) => t?.key ?? null;

    it("floats nothing when only our own video exists", () => {
        const tiles = buildVideoTiles([local, localShare]);
        expect(pickPipTile(tiles, none)).toBeNull();
    });

    it("prefers a remote screen over a talking camera", () => {
        const tiles = buildVideoTiles([alice, bob, aliceShare, localShare]);
        expect(
            key(
                pickPipTile(tiles, {
                    ...none,
                    speakingUserIds: new Set(["@bob:x"]),
                }),
            ),
        ).toBe("@alice:x:D1:screenshare");
    });

    it("follows whoever is talking, and holds through the silence", () => {
        const tiles = buildVideoTiles([alice, bob]);
        const talking = pickPipTile(tiles, {
            ...none,
            speakingUserIds: new Set(["@bob:x"]),
        });
        expect(key(talking)).toBe("@bob:x:D1:camera");
        expect(
            key(pickPipTile(tiles, { ...none, current: key(talking) })),
        ).toBe("@bob:x:D1:camera");
    });

    it("skips a speaker with no camera", () => {
        const tiles = buildVideoTiles([alice]);
        expect(
            key(
                pickPipTile(tiles, {
                    ...none,
                    speakingUserIds: new Set(["@carol:x"]),
                }),
            ),
        ).toBe("@alice:x:D1:camera");
    });

    it("lets the user's own choice win, even their own video", () => {
        const tiles = buildVideoTiles([local, aliceShare]);
        expect(
            key(pickPipTile(tiles, { ...none, focused: "@me:x:D1:camera" })),
        ).toBe("@me:x:D1:camera");
        expect(
            key(
                pickPipTile(tiles, {
                    ...none,
                    pinned: "@me:x:D1:camera",
                    focused: "@alice:x:D1:screenshare",
                }),
            ),
        ).toBe("@me:x:D1:camera");
    });

    it("falls back when the chosen tile has gone", () => {
        const tiles = buildVideoTiles([alice]);
        expect(
            key(pickPipTile(tiles, { ...none, pinned: "@gone:x:D1:camera" })),
        ).toBe("@alice:x:D1:camera");
    });
});

describe("snapPipToEdge", () => {
    const bounds = { minX: 0, maxX: 400, minY: 100, maxY: 500 };

    it("snaps to the closest side and keeps its place along it", () => {
        expect(snapPipToEdge(100, 120, bounds)).toEqual({
            side: "top",
            at: 0.25,
        });
        expect(snapPipToEdge(300, 480, bounds)).toEqual({
            side: "bottom",
            at: 0.75,
        });
        expect(snapPipToEdge(20, 300, bounds)).toEqual({
            side: "left",
            at: 0.5,
        });
        expect(snapPipToEdge(390, 200, bounds)).toEqual({
            side: "right",
            at: 0.25,
        });
    });

    it("stays in range when dropped outside the bounds", () => {
        expect(snapPipToEdge(-50, 40, bounds)).toEqual({ side: "top", at: 0 });
        expect(snapPipToEdge(450, 300, bounds)).toEqual({
            side: "right",
            at: 0.5,
        });
    });

    it("copes with a window too small to move in", () => {
        const flat = { minX: 0, maxX: 0, minY: 100, maxY: 50 };
        expect(snapPipToEdge(0, 80, flat).at).toBe(0);
    });
});

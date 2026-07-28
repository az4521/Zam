import { describe, it, expect, afterEach, vi } from "vitest";
import {
    buildVideoTiles,
    nextFocus,
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
        expect(screenShareSupportedHere()).toBe(false);
        vi.unstubAllGlobals();
    });
});

import { describe, it, expect } from "vitest";
import {
    sourceKind,
    shapeDisplaySources,
    groupDisplaySources,
    shareAudioOptions,
    defaultShareAudioChoice,
} from "./displaySources";

describe("sourceKind", () => {
    it("reads a screen id", () => {
        expect(sourceKind("screen:0:0")).toBe("screen");
    });
    it("treats anything else as a window", () => {
        expect(sourceKind("window:12345:1")).toBe("window");
        expect(sourceKind("")).toBe("window");
    });
});

describe("shapeDisplaySources", () => {
    it("returns an empty list for null/undefined/empty input", () => {
        expect(shapeDisplaySources(null)).toEqual([]);
        expect(shapeDisplaySources(undefined)).toEqual([]);
        expect(shapeDisplaySources([])).toEqual([]);
    });

    it("orders screens before windows, preserving order within a group", () => {
        const out = shapeDisplaySources([
            { id: "window:2:0", name: "Editor" },
            { id: "screen:1:0", name: "Screen 2" },
            { id: "window:1:0", name: "Browser" },
            { id: "screen:0:0", name: "Entire Screen" },
        ]);
        expect(out.map((s) => s.id)).toEqual([
            "screen:1:0",
            "screen:0:0",
            "window:2:0",
            "window:1:0",
        ]);
    });

    it("drops entries with a missing or blank id", () => {
        const out = shapeDisplaySources([
            { id: "" },
            { id: "   " },
            { id: "screen:0:0", name: "Entire Screen" },
        ]);
        expect(out.map((s) => s.id)).toEqual(["screen:0:0"]);
    });

    it("dedupes by id, first wins", () => {
        const out = shapeDisplaySources([
            { id: "screen:0:0", name: "First" },
            { id: "screen:0:0", name: "Second" },
        ]);
        expect(out).toHaveLength(1);
        expect(out[0].name).toBe("First");
    });

    it("falls back to a kind-appropriate name when the name is blank", () => {
        const out = shapeDisplaySources([
            { id: "screen:0:0", name: "  " },
            { id: "window:1:0" },
        ]);
        expect(out[0].name).toBe("Screen");
        expect(out[1].name).toBe("Untitled window");
    });

    it("keeps only data:image thumbnails and nulls anything else", () => {
        const out = shapeDisplaySources([
            { id: "screen:0:0", thumbnailDataUrl: "data:image/png;base64,AAA" },
            {
                id: "screen:1:0",
                thumbnailDataUrl: "https://evil.example/x.png",
            },
            { id: "screen:2:0", thumbnailDataUrl: "" },
            { id: "screen:3:0", thumbnailDataUrl: null },
            { id: "screen:4:0" },
        ]);
        expect(out.map((s) => s.thumbnailDataUrl)).toEqual([
            "data:image/png;base64,AAA",
            null,
            null,
            null,
            null,
        ]);
    });
});

describe("groupDisplaySources", () => {
    it("splits shaped sources into screens and windows", () => {
        const shaped = shapeDisplaySources([
            { id: "screen:0:0", name: "Entire Screen" },
            { id: "window:1:0", name: "Browser" },
        ]);
        const { screens, windows } = groupDisplaySources(shaped);
        expect(screens.map((s) => s.id)).toEqual(["screen:0:0"]);
        expect(windows.map((s) => s.id)).toEqual(["window:1:0"]);
    });

    it("returns empty arrays for an empty list", () => {
        expect(groupDisplaySources([])).toEqual({ screens: [], windows: [] });
    });
});

describe("shareAudioOptions", () => {
    it("offers automatic, all audio, each app and none, in that order", () => {
        const options = shareAudioOptions({
            system: "exclude-self",
            windowApp: true,
            apps: [
                { id: "pid:5", name: "Spotify", active: true },
                { id: "pid:5", name: "Spotify again", active: true },
                { id: "pid:6", name: "  ", active: false },
            ],
        });
        expect(options.map((o) => [o.value, o.app])).toEqual([
            ["auto", false],
            ["system", false],
            ["app:pid:5", true],
            ["none", false],
        ]);
    });

    it("offers nothing when there is nothing to choose", () => {
        expect(shareAudioOptions(null)).toEqual([]);
        expect(
            shareAudioOptions({ system: null, windowApp: false, apps: [] }),
        ).toEqual([]);
    });

    it("starts from the broadest choice, or none when audio is off", () => {
        const full = shareAudioOptions({
            system: "exclude-self",
            windowApp: true,
            apps: [],
        });
        expect(defaultShareAudioChoice(full, true)).toBe("auto");
        expect(defaultShareAudioChoice(full, false)).toBe("none");
        const loopback = shareAudioOptions({
            system: "loopback",
            windowApp: false,
            apps: [],
        });
        expect(defaultShareAudioChoice(loopback, true)).toBe("system");
        const appsOnly = shareAudioOptions({
            system: null,
            windowApp: false,
            apps: [{ id: "pw:mpv", name: "mpv", active: false }],
        });
        expect(defaultShareAudioChoice(appsOnly, true)).toBe("none");
    });
});

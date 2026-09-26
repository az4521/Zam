import { describe, it, expect } from "vitest";
import {
    searchSettings,
    settingsSearchKeyAction,
    SETTINGS_SEARCH_INDEX,
    type SettingsSearchEntry,
} from "./settingsSearch";
import { SETTINGS_TABS } from "./settingsNav";

const FIXTURE: readonly SettingsSearchEntry[] = [
    { tab: "voice", label: "Noise suppression", keywords: ["denoise"] },
    { tab: "voice", label: "Input device", keywords: ["microphone", "mic"] },
    { tab: "appearance", label: "Reduce motion", keywords: ["animations"] },
    { tab: "appearance", label: "Text size", keywords: ["font size"] },
];

describe("searchSettings", () => {
    it("returns [] for an empty query", () => {
        expect(searchSettings("", FIXTURE)).toEqual([]);
    });

    it("returns [] for a whitespace-only query", () => {
        expect(searchSettings("   ", FIXTURE)).toEqual([]);
    });

    it("returns [] when nothing matches", () => {
        expect(searchSettings("zzzznomatch", FIXTURE)).toEqual([]);
    });

    it("matches a label case-insensitively", () => {
        const r = searchSettings("noise", FIXTURE);
        expect(r.map((e) => e.label)).toEqual(["Noise suppression"]);
    });

    it("matches a keyword the label does not contain", () => {
        const r = searchSettings("microphone", FIXTURE);
        expect(r.map((e) => e.label)).toEqual(["Input device"]);
    });

    it("matches by tab id", () => {
        const r = searchSettings("voice", FIXTURE);
        expect(r.map((e) => e.label)).toEqual([
            "Noise suppression",
            "Input device",
        ]);
    });

    it("ranks a label prefix match above a mere contains match", () => {
        const idx: readonly SettingsSearchEntry[] = [
            { tab: "voice", label: "Advanced input options" }, // contains "input"
            { tab: "voice", label: "Input device" }, // starts with "input"
        ];
        const r = searchSettings("input", idx);
        expect(r.map((e) => e.label)).toEqual([
            "Input device",
            "Advanced input options",
        ]);
    });

    it("keeps declaration order for equal scores (stable sort)", () => {
        const idx: readonly SettingsSearchEntry[] = [
            { tab: "voice", label: "Alpha", keywords: ["shared"] },
            { tab: "voice", label: "Beta", keywords: ["shared"] },
        ];
        const r = searchSettings("shared", idx);
        expect(r.map((e) => e.label)).toEqual(["Alpha", "Beta"]);
    });

    it("caps results at 20", () => {
        const idx: SettingsSearchEntry[] = Array.from(
            { length: 30 },
            (_, i) => ({
                tab: "voice" as const,
                label: `Item ${i} match`,
            }),
        );
        expect(searchSettings("match", idx)).toHaveLength(20);
    });

    it("defaults to the real index and finds a known setting", () => {
        const r = searchSettings("reduce motion");
        expect(r.some((e) => e.tab === "appearance")).toBe(true);
    });

    it("every real index entry has a non-empty label and a valid tab", () => {
        for (const e of SETTINGS_SEARCH_INDEX) {
            expect(e.label.trim().length).toBeGreaterThan(0);
            expect(typeof e.tab).toBe("string");
        }
    });

    it("every real index entry's tab is a valid SettingsTab", () => {
        const validTabs = new Set(SETTINGS_TABS.map((t) => t.id));
        for (const e of SETTINGS_SEARCH_INDEX) {
            expect(validTabs.has(e.tab)).toBe(true);
        }
    });

    it("routes 'Keep room list open' to the Appearance tab with the keepsidebar anchor", () => {
        const entry = SETTINGS_SEARCH_INDEX.find(
            (e) => e.label === "Keep room list open",
        );
        expect(entry?.tab).toBe("appearance");
        expect(entry?.anchor).toBe("appearance-keepsidebar");
    });

    it("routes 'Hold to open message menu' to the Messages & Media tab", () => {
        const entry = SETTINGS_SEARCH_INDEX.find(
            (e) => e.label === "Hold to open message menu",
        );
        expect(entry?.tab).toBe("messages-media");
        expect(entry?.anchor).toBe("cust-messages");
    });

    it("keeps 'Minimise to tray on close' in the General tab", () => {
        const entry = SETTINGS_SEARCH_INDEX.find(
            (e) => e.label === "Minimise to tray on close",
        );
        expect(entry?.tab).toBe("general");
        expect(entry?.anchor).toBe("cust-behavior");
    });
});

describe("settingsSearchKeyAction", () => {
    const key = (k: string, isComposing = false) => ({ key: k, isComposing });

    it("Escape with a query clears it instead of closing", () => {
        expect(settingsSearchKeyAction(key("Escape"), "font", 1)).toBe("clear");
    });

    it("Escape with an empty or blank query is left to close the dialog", () => {
        expect(settingsSearchKeyAction(key("Escape"), "", 0)).toBeNull();
        expect(settingsSearchKeyAction(key("Escape"), "   ", 0)).toBeNull();
    });

    it("Escape clears even when nothing matches", () => {
        expect(settingsSearchKeyAction(key("Escape"), "zzz", 0)).toBe("clear");
    });

    it("Enter opens the first result when there is one", () => {
        expect(settingsSearchKeyAction(key("Enter"), "font", 3)).toBe(
            "open-first",
        );
    });

    it("Enter does nothing with no results or no query", () => {
        expect(settingsSearchKeyAction(key("Enter"), "zzz", 0)).toBeNull();
        expect(settingsSearchKeyAction(key("Enter"), "", 0)).toBeNull();
    });

    it("ignores keys pressed while an IME composition is active", () => {
        expect(
            settingsSearchKeyAction(key("Enter", true), "font", 3),
        ).toBeNull();
        expect(
            settingsSearchKeyAction(key("Escape", true), "font", 3),
        ).toBeNull();
    });

    it("ignores other keys", () => {
        expect(settingsSearchKeyAction(key("a"), "font", 3)).toBeNull();
        expect(settingsSearchKeyAction(key("ArrowDown"), "font", 3)).toBeNull();
    });
});

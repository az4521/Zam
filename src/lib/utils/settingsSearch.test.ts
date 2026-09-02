import { describe, it, expect } from "vitest";
import {
    searchSettings,
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
});

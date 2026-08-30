import { describe, it, expect, beforeEach } from "vitest";
import {
    settingsStorageKey,
    readPluginSettings,
    writePluginSettings,
} from "./pluginSettingsStore";
import type { SettingsSchema } from "./settingsSchema";

const schema: SettingsSchema = [
    { key: "greeting", type: "text", label: "Greeting", default: "hi" },
    {
        key: "count",
        type: "number",
        label: "Count",
        default: 2,
        min: 0,
        max: 5,
    },
];

beforeEach(() => localStorage.clear());

describe("settingsStorageKey", () => {
    it("is the stable per-plugin key", () => {
        expect(settingsStorageKey("zam.slash-fun")).toBe(
            "zam.plugin.zam.slash-fun.settings",
        );
    });
});

describe("readPluginSettings", () => {
    it("returns coerced defaults when nothing is stored", () => {
        expect(readPluginSettings("p", schema)).toEqual({
            greeting: "hi",
            count: 2,
        });
    });
    it("returns coerced defaults when the stored value is corrupt", () => {
        localStorage.setItem(settingsStorageKey("p"), "not json{");
        expect(readPluginSettings("p", schema)).toEqual({
            greeting: "hi",
            count: 2,
        });
    });
    it("reads and coerces stored values (clamps out-of-range number)", () => {
        localStorage.setItem(
            settingsStorageKey("p"),
            JSON.stringify({ greeting: "yo", count: 99 }),
        );
        expect(readPluginSettings("p", schema)).toEqual({
            greeting: "yo",
            count: 5, // clamped to max
        });
    });
});

describe("writePluginSettings", () => {
    it("coerces, persists, and returns the coerced object", () => {
        const out = writePluginSettings("p", schema, {
            greeting: "yo",
            count: "4",
        });
        expect(out).toEqual({ greeting: "yo", count: 4 });
        expect(readPluginSettings("p", schema)).toEqual({
            greeting: "yo",
            count: 4,
        });
    });
    it("round-trips through the same key hostApi uses", () => {
        writePluginSettings("zam.slash-fun", schema, {
            greeting: "x",
            count: 1,
        });
        const raw = localStorage.getItem(settingsStorageKey("zam.slash-fun"));
        expect(JSON.parse(raw!)).toEqual({ greeting: "x", count: 1 });
    });
});

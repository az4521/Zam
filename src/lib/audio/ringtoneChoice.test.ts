import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
    ringtoneProblem,
    ringtoneKey,
    parseRingtoneKey,
    findPluginRingtone,
    pluginRingtoneOptions,
    startRingtoneFor,
    previewRingtone,
    stopPluginRingtonesOf,
    RING_START_TIMEOUT_MS,
    RING_PREVIEW_MS,
} from "./ringtoneChoice";
import { RING_MAX_MS, type RingHandle } from "./soundEffects";
import type { RegistryEntry } from "$lib/plugins/registry";
import type { PluginRingtone } from "$lib/plugins/types";

const cbTone = (
    overrides: Partial<{
        id: string;
        name: string;
        start: () => void | Promise<void>;
        stop: () => void;
    }> = {},
) => ({
    id: "tune",
    name: "Tune",
    start: vi.fn(),
    stop: vi.fn(),
    ...overrides,
});

const entry = (
    pluginId: string,
    value: PluginRingtone,
): RegistryEntry<PluginRingtone> => ({ pluginId, entryId: 1, value });

/** The built-in ring: a fresh handle per call, so tests can see who rang. */
function makeBuiltin() {
    const handles: { stop: ReturnType<typeof vi.fn> }[] = [];
    const builtin = vi.fn((): RingHandle => {
        const h = { stop: vi.fn() };
        handles.push(h);
        return h;
    });
    return { builtin, handles };
}

const ENABLED = { enabled: true, volume: 1 };

beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("ringtoneProblem", () => {
    it("accepts a callback ringtone and an https, blob or data audio source", () => {
        expect(ringtoneProblem(cbTone() as PluginRingtone)).toBeNull();
        expect(
            ringtoneProblem({
                id: "a",
                name: "A",
                src: "https://example.com/a.ogg",
            }),
        ).toBeNull();
        expect(
            ringtoneProblem({ id: "a", name: "A", src: "blob:x" }),
        ).toBeNull();
        expect(
            ringtoneProblem({
                id: "a",
                name: "A",
                src: "data:audio/ogg;base64,AA",
            }),
        ).toBeNull();
    });
    it("refuses bad ids, empty names, and colons in ids", () => {
        expect(
            ringtoneProblem(cbTone({ id: "" }) as PluginRingtone),
        ).not.toBeNull();
        expect(
            ringtoneProblem(cbTone({ id: "a:b" }) as PluginRingtone),
        ).not.toBeNull();
        expect(
            ringtoneProblem(cbTone({ id: "x".repeat(65) }) as PluginRingtone),
        ).not.toBeNull();
        expect(
            ringtoneProblem(cbTone({ name: "  " }) as PluginRingtone),
        ).not.toBeNull();
    });
    it("refuses an unsafe scheme or an ambiguous shape", () => {
        expect(
            ringtoneProblem({
                id: "a",
                name: "A",
                src: "http://example.com/a.ogg",
            }),
        ).not.toBeNull();
        expect(
            ringtoneProblem({
                id: "a",
                name: "A",
                src: "https://example.com/a.ogg",
                start: () => {},
                stop: () => {},
            } as unknown as PluginRingtone),
        ).not.toBeNull();
        expect(
            ringtoneProblem({
                id: "a",
                name: "A",
            } as unknown as PluginRingtone),
        ).not.toBeNull();
    });
});

describe("ringtone keys", () => {
    it("round-trips a dotted plugin id", () => {
        const key = ringtoneKey("com.zam.whisper", "bell-2");
        expect(key).toBe("plugin:com.zam.whisper:bell-2");
        expect(parseRingtoneKey(key)).toEqual({
            pluginId: "com.zam.whisper",
            id: "bell-2",
        });
    });
    it("rejects the built-in choice and malformed keys", () => {
        expect(parseRingtoneKey("")).toBeNull();
        expect(parseRingtoneKey("plugin:onlyplugin")).toBeNull();
        expect(parseRingtoneKey("plugin::x")).toBeNull();
        expect(parseRingtoneKey("plugin:p:")).toBeNull();
        expect(parseRingtoneKey("other:p:x")).toBeNull();
    });
    it("finds the registered ringtone a key names, or null", () => {
        const entries = [entry("p.one", cbTone({ id: "a" }) as PluginRingtone)];
        expect(findPluginRingtone(entries, "plugin:p.one:a")?.value.id).toBe(
            "a",
        );
        expect(findPluginRingtone(entries, "plugin:p.one:b")).toBeNull();
        expect(findPluginRingtone(entries, "plugin:gone:a")).toBeNull();
        expect(findPluginRingtone(entries, "")).toBeNull();
    });
    it("lists picker options with their keys", () => {
        const entries = [entry("p.one", cbTone({ id: "a" }) as PluginRingtone)];
        expect(pluginRingtoneOptions(entries)).toEqual([
            { key: "plugin:p.one:a", name: "Tune", pluginId: "p.one" },
        ]);
    });
});

describe("startRingtoneFor: selection", () => {
    it("rings the built-in tone for the built-in choice", () => {
        const { builtin } = makeBuiltin();
        startRingtoneFor("", [], builtin, ENABLED);
        expect(builtin).toHaveBeenCalledTimes(1);
    });
    it("falls back to the built-in tone when the plugin is not loaded", () => {
        const { builtin } = makeBuiltin();
        startRingtoneFor("plugin:gone:a", [], builtin, ENABLED);
        expect(builtin).toHaveBeenCalledTimes(1);
    });
    it("does not touch the plugin when ringing is disabled", () => {
        const { builtin } = makeBuiltin();
        const tone = cbTone();
        startRingtoneFor(
            "plugin:p:tune",
            [entry("p", tone as PluginRingtone)],
            builtin,
            { enabled: false, volume: 1 },
        );
        expect(tone.start).not.toHaveBeenCalled();
        expect(builtin).toHaveBeenCalledTimes(1);
    });
});

describe("startRingtoneFor: plugin ringtone", () => {
    it("starts the plugin's ring, and stops it once", () => {
        const { builtin } = makeBuiltin();
        const tone = cbTone();
        const h = startRingtoneFor(
            "plugin:p:tune",
            [entry("p", tone as PluginRingtone)],
            builtin,
            ENABLED,
        );
        expect(tone.start).toHaveBeenCalledTimes(1);
        expect(builtin).not.toHaveBeenCalled();
        h.stop();
        h.stop();
        expect(tone.stop).toHaveBeenCalledTimes(1);
        expect(builtin).not.toHaveBeenCalled();
    });
    it("falls back when start throws, and silences the half-started sound", () => {
        const { builtin, handles } = makeBuiltin();
        const tone = cbTone({
            start: () => {
                throw new Error("boom");
            },
        });
        const h = startRingtoneFor(
            "plugin:p:tune",
            [entry("p", tone as PluginRingtone)],
            builtin,
            ENABLED,
        );
        expect(builtin).toHaveBeenCalledTimes(1);
        expect(tone.stop).toHaveBeenCalled();
        h.stop();
        expect(handles[0].stop).toHaveBeenCalledTimes(1);
    });
    it("falls back when start rejects", async () => {
        const { builtin } = makeBuiltin();
        const tone = cbTone({
            start: () => Promise.reject(new Error("no audio")),
        });
        startRingtoneFor(
            "plugin:p:tune",
            [entry("p", tone as PluginRingtone)],
            builtin,
            ENABLED,
        );
        await Promise.resolve();
        await Promise.resolve();
        expect(builtin).toHaveBeenCalledTimes(1);
    });
    it("falls back when start hangs past the timeout", () => {
        vi.useFakeTimers();
        const { builtin } = makeBuiltin();
        const tone = cbTone({ start: () => new Promise<void>(() => {}) });
        startRingtoneFor(
            "plugin:p:tune",
            [entry("p", tone as PluginRingtone)],
            builtin,
            ENABLED,
        );
        vi.advanceTimersByTime(RING_START_TIMEOUT_MS - 1);
        expect(builtin).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(builtin).toHaveBeenCalledTimes(1);
    });
    it("silences a start that only resolves after the fallback took over", async () => {
        vi.useFakeTimers();
        const { builtin } = makeBuiltin();
        let resolve!: () => void;
        const tone = cbTone({
            start: () =>
                new Promise<void>((r) => {
                    resolve = r;
                }),
        });
        startRingtoneFor(
            "plugin:p:tune",
            [entry("p", tone as PluginRingtone)],
            builtin,
            ENABLED,
        );
        vi.advanceTimersByTime(RING_START_TIMEOUT_MS);
        expect(builtin).toHaveBeenCalledTimes(1);
        resolve();
        await Promise.resolve();
        await Promise.resolve();
        // The late sound is stopped, not left playing over the built-in ring.
        expect(tone.stop).toHaveBeenCalled();
    });
    it("stops the plugin's ring when the ring window ends", () => {
        vi.useFakeTimers();
        const { builtin } = makeBuiltin();
        const tone = cbTone();
        startRingtoneFor(
            "plugin:p:tune",
            [entry("p", tone as PluginRingtone)],
            builtin,
            ENABLED,
        );
        vi.advanceTimersByTime(RING_MAX_MS);
        expect(tone.stop).toHaveBeenCalledTimes(1);
    });
});

describe("unload", () => {
    it("hands a sounding plugin ring back to the built-in tone", () => {
        const { builtin, handles } = makeBuiltin();
        const tone = cbTone();
        const other = cbTone({ id: "other" });
        const h = startRingtoneFor(
            "plugin:p:tune",
            [
                entry("p", tone as PluginRingtone),
                entry("q", other as PluginRingtone),
            ],
            builtin,
            ENABLED,
        );
        stopPluginRingtonesOf("p");
        expect(tone.stop).toHaveBeenCalledTimes(1);
        expect(builtin).toHaveBeenCalledTimes(1);
        // The built-in ring is the one the caller now holds, and it stops with it.
        h.stop();
        expect(handles[0].stop).toHaveBeenCalledTimes(1);
        expect(other.stop).not.toHaveBeenCalled();
    });
    it("leaves a finished ring alone", () => {
        const { builtin } = makeBuiltin();
        const tone = cbTone();
        const h = startRingtoneFor(
            "plugin:p:tune",
            [entry("p", tone as PluginRingtone)],
            builtin,
            ENABLED,
        );
        h.stop();
        stopPluginRingtonesOf("p");
        expect(builtin).not.toHaveBeenCalled();
        expect(tone.stop).toHaveBeenCalledTimes(1);
    });
});

describe("previewRingtone", () => {
    it("plays the built-in preview for the built-in choice", () => {
        const preview = vi.fn();
        previewRingtone("", [], ENABLED, preview);
        expect(preview).toHaveBeenCalledTimes(1);
    });
    it("plays a short pass of the plugin's ringtone", () => {
        vi.useFakeTimers();
        const preview = vi.fn();
        const tone = cbTone();
        previewRingtone(
            "plugin:p:tune",
            [entry("p", tone as PluginRingtone)],
            ENABLED,
            preview,
        );
        expect(tone.start).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(RING_PREVIEW_MS);
        expect(tone.stop).toHaveBeenCalledTimes(1);
        expect(preview).not.toHaveBeenCalled();
    });
});

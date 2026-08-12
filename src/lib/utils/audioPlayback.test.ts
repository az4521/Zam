// src/lib/utils/audioPlayback.test.ts
import { describe, it, expect } from "vitest";
import { audioPlaybackMode, audioStatusLabel } from "./audioPlayback";

describe("audioPlaybackMode", () => {
    it("returns idle when nothing has happened", () => {
        expect(
            audioPlaybackMode({
                hasBlob: false,
                loading: false,
                failed: false,
            }),
        ).toBe("idle");
    });
    it("returns loading while fetching", () => {
        expect(
            audioPlaybackMode({ hasBlob: false, loading: true, failed: false }),
        ).toBe("loading");
    });
    it("returns failed after a load error", () => {
        expect(
            audioPlaybackMode({ hasBlob: false, loading: false, failed: true }),
        ).toBe("failed");
    });
    it("returns ready once a blob exists", () => {
        expect(
            audioPlaybackMode({ hasBlob: true, loading: false, failed: false }),
        ).toBe("ready");
    });
    it("ready wins even if a stale failed flag is still set", () => {
        expect(
            audioPlaybackMode({ hasBlob: true, loading: false, failed: true }),
        ).toBe("ready");
    });
    it("loading outranks a stale failed flag during a retry", () => {
        expect(
            audioPlaybackMode({ hasBlob: false, loading: true, failed: true }),
        ).toBe("loading");
    });
});

describe("audioStatusLabel", () => {
    it("labels each non-ready mode", () => {
        expect(audioStatusLabel("idle")).toBe("Click to play");
        expect(audioStatusLabel("loading")).toBe("Loading…");
        expect(audioStatusLabel("failed")).toBe("Failed to load · Retry");
    });
    it("has no caption when ready (the <audio> element replaces it)", () => {
        expect(audioStatusLabel("ready")).toBe("");
    });
});

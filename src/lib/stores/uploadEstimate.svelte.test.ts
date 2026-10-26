import { describe, it, expect, beforeEach, vi } from "vitest";

async function freshStore() {
    vi.resetModules();
    return import("./uploadEstimate.svelte");
}

describe("uploadEstimate", () => {
    beforeEach(() => localStorage.clear());

    it("starts unmeasured, with the unmeasured ceiling", async () => {
        const s = await freshStore();
        expect(s.measuredUpload()).toBeNull();
        expect(s.screenShareBitrateCeiling()).toBe(10_000_000);
    });

    it("measures against the higher of this call's sample and the device peak", async () => {
        const s = await freshStore();
        s.noteUploadEstimate(20_000_000);
        expect(s.screenShareBitrateCeiling()).toBe(18_000_000);
        s.noteUploadEstimate(5_000_000);
        expect(s.uploadEstimate.live).toBe(5_000_000);
        expect(s.measuredUpload()).toBe(20_000_000);
    });

    it("keeps the peak across reloads and drops the live sample when the call ends", async () => {
        let s = await freshStore();
        s.noteUploadEstimate(12_000_000);
        s.clearLiveUploadEstimate();
        expect(s.uploadEstimate.live).toBeNull();
        s = await freshStore();
        expect(s.uploadEstimate.peak).toBe(12_000_000);
        expect(s.measuredUpload()).toBe(12_000_000);
    });

    it("ignores samples that aren't positive numbers", async () => {
        const s = await freshStore();
        s.noteUploadEstimate(0);
        s.noteUploadEstimate(Number.NaN);
        s.noteUploadEstimate(-5);
        expect(s.measuredUpload()).toBeNull();
    });
});

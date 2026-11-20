import { describe, it, expect, beforeEach, vi } from "vitest";

async function freshStore() {
    vi.resetModules();
    return import("./uploadEstimate.svelte");
}

describe("uploadEstimate", () => {
    beforeEach(() => localStorage.clear());

    it("starts unknown", async () => {
        const s = await freshStore();
        expect(s.uploadEstimate.live).toBeNull();
    });

    it("follows the live estimate down as well as up", async () => {
        const s = await freshStore();
        s.noteUploadEstimate(20_000_000);
        s.noteUploadEstimate(5_000_000);
        expect(s.uploadEstimate.live).toBe(5_000_000);
        s.noteUploadEstimate(null);
        expect(s.uploadEstimate.live).toBeNull();
    });

    it("keeps nothing across reloads and removes the old stored peak", async () => {
        localStorage.setItem("uploadEstimate:peak", "90000000");
        let s = await freshStore();
        expect(localStorage.getItem("uploadEstimate:peak")).toBeNull();
        s.noteUploadEstimate(12_000_000);
        s.clearLiveUploadEstimate();
        expect(s.uploadEstimate.live).toBeNull();
        s = await freshStore();
        expect(s.uploadEstimate.live).toBeNull();
    });
});

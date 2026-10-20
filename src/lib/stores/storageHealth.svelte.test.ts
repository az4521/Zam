import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

let mod: typeof import("./storageHealth.svelte");

beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mod = await import("./storageHealth.svelte");
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("reportStorageError", () => {
    it("marks storage full for a storage-full error", () => {
        expect(
            mod.reportStorageError(new DOMException("x", "QuotaExceededError")),
        ).toBe(true);
        expect(mod.storageHealthState.full).toBe(true);
    });

    it("leaves other errors alone", () => {
        expect(mod.reportStorageError(new Error("network down"))).toBe(false);
        expect(mod.storageHealthState.full).toBe(false);
    });

    it("needs IndexedDB context for a bare UnknownError", () => {
        const err = new DOMException("Internal error", "UnknownError");
        expect(mod.reportStorageError(err)).toBe(false);
        expect(mod.reportStorageError(err, { fromIndexedDB: true })).toBe(true);
    });
});

describe("checkStorage", () => {
    it("flags low space from the estimate", async () => {
        const estimate = vi.fn(async () => ({ quota: 1e9, usage: 1e9 - 1e6 }));
        vi.stubGlobal("navigator", { ...navigator, storage: { estimate } });
        try {
            await mod.checkStorage();
            expect(mod.storageHealthState.low).toBe(true);
            expect(mod.storageHealthState.freeBytes).toBe(1e6);
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it("stays out of space while the quota has no room", async () => {
        mod.reportStorageError(new DOMException("x", "QuotaExceededError"));
        const estimate = vi.fn(async () => ({ quota: 1e9, usage: 1e9 }));
        vi.stubGlobal("navigator", { ...navigator, storage: { estimate } });
        try {
            await mod.checkStorage();
            expect(mod.storageHealthState.full).toBe(true);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

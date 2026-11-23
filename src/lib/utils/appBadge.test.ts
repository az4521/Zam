import { describe, it, expect, vi } from "vitest";
import { syncAppBadge } from "./appBadge";

function fakeNav() {
    return {
        setAppBadge: vi.fn(async (_count?: number) => {}),
        clearAppBadge: vi.fn(async () => {}),
    };
}

describe("syncAppBadge", () => {
    it("sets the badge for a positive count", () => {
        const nav = fakeNav();
        syncAppBadge(3, nav);
        expect(nav.setAppBadge).toHaveBeenCalledWith(3);
        expect(nav.clearAppBadge).not.toHaveBeenCalled();
    });

    it("clears the badge for zero", () => {
        const nav = fakeNav();
        syncAppBadge(0, nav);
        expect(nav.clearAppBadge).toHaveBeenCalledTimes(1);
        expect(nav.setAppBadge).not.toHaveBeenCalled();
    });

    it("treats negative and non-finite counts as zero", () => {
        const nav = fakeNav();
        syncAppBadge(-4, nav);
        syncAppBadge(Number.NaN, nav);
        expect(nav.setAppBadge).not.toHaveBeenCalled();
        expect(nav.clearAppBadge).toHaveBeenCalledTimes(1);
    });

    it("does not call again with the same value", () => {
        const nav = fakeNav();
        syncAppBadge(5, nav);
        syncAppBadge(5, nav);
        syncAppBadge(5.4, nav);
        expect(nav.setAppBadge).toHaveBeenCalledTimes(1);
        syncAppBadge(6, nav);
        expect(nav.setAppBadge).toHaveBeenCalledTimes(2);
        expect(nav.setAppBadge).toHaveBeenLastCalledWith(6);
    });

    it("de-duplicates clears too", () => {
        const nav = fakeNav();
        syncAppBadge(2, nav);
        syncAppBadge(0, nav);
        syncAppBadge(0, nav);
        expect(nav.clearAppBadge).toHaveBeenCalledTimes(1);
    });

    it("does nothing when the API is missing", () => {
        expect(() => syncAppBadge(3, {})).not.toThrow();
        expect(() => syncAppBadge(0, {})).not.toThrow();
    });

    it("swallows synchronous throws", () => {
        const nav = {
            setAppBadge: () => {
                throw new Error("boom");
            },
        };
        expect(() => syncAppBadge(3, nav)).not.toThrow();
    });

    it("swallows rejected promises and retries on the next sync", async () => {
        const nav = {
            setAppBadge: vi
                .fn<(count?: number) => Promise<void>>()
                .mockRejectedValueOnce(new Error("denied"))
                .mockResolvedValueOnce(undefined),
            clearAppBadge: vi.fn(async () => {}),
        };
        syncAppBadge(4, nav);
        await new Promise((r) => setTimeout(r, 0));
        syncAppBadge(4, nav);
        expect(nav.setAppBadge).toHaveBeenCalledTimes(2);
    });

    it("tracks the last value per navigator", () => {
        const a = fakeNav();
        const b = fakeNav();
        syncAppBadge(1, a);
        syncAppBadge(1, b);
        expect(a.setAppBadge).toHaveBeenCalledTimes(1);
        expect(b.setAppBadge).toHaveBeenCalledTimes(1);
    });
});

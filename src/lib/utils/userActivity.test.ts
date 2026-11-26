import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    getLastInputTs,
    noteUserInput,
    onReturnFromIdle,
    resetUserActivityForTests,
} from "./userActivity";
import { IDLE_LIMIT_MS } from "./activeSession";

describe("userActivity", () => {
    beforeEach(() => resetUserActivityForTests());

    it("stamps the last input", () => {
        expect(getLastInputTs()).toBeNull();
        noteUserInput(5_000);
        expect(getLastInputTs()).toBe(5_000);
    });

    it("reports and announces the end of an idle spell only", () => {
        const listener = vi.fn();
        onReturnFromIdle(listener);
        expect(noteUserInput(1_000)).toBe(true); // first input ever
        expect(noteUserInput(2_000)).toBe(false); // still active
        expect(listener).toHaveBeenCalledTimes(1);
        expect(noteUserInput(2_000 + IDLE_LIMIT_MS)).toBe(true); // back from idle
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it("updates the stamp before listeners run, so their gate passes", () => {
        let seen: number | null = null;
        onReturnFromIdle(() => (seen = getLastInputTs()));
        noteUserInput(42);
        expect(seen).toBe(42);
    });

    it("treats a clock that jumped back as a fresh return", () => {
        noteUserInput(10_000);
        expect(noteUserInput(5_000)).toBe(true);
    });

    it("unsubscribes, and one throwing listener does not block the rest", () => {
        const good = vi.fn();
        onReturnFromIdle(() => {
            throw new Error("boom");
        });
        const off = onReturnFromIdle(good);
        noteUserInput(1);
        expect(good).toHaveBeenCalledTimes(1);
        off();
        noteUserInput(1 + IDLE_LIMIT_MS);
        expect(good).toHaveBeenCalledTimes(1);
    });
});

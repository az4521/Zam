import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// bootTiming keeps module-level state, so each test loads a fresh copy.
async function loadFresh() {
    vi.resetModules();
    return import("./bootTiming");
}

describe("bootTiming", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(console, "info").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("keeps marks in order with deltas from the previous mark", async () => {
        const boot = await loadFresh();
        boot.bootMark("restore-start", 10);
        boot.bootMark("reconnect-start", 25);
        boot.bootMark("sync-start", 25.5);

        expect(boot.bootTimeline()).toEqual([
            { name: "restore-start", t: 10, dt: 10 },
            { name: "reconnect-start", t: 25, dt: 15 },
            { name: "sync-start", t: 25.5, dt: 0.5 },
        ]);
    });

    it("pure timelineFrom computes deltas for an arbitrary list", async () => {
        const { timelineFrom } = await loadFresh();
        expect(
            timelineFrom([
                { name: "a", t: 4 },
                { name: "b", t: 4 },
                { name: "c", t: 9 },
            ]),
        ).toEqual([
            { name: "a", t: 4, dt: 4 },
            { name: "b", t: 4, dt: 0 },
            { name: "c", t: 9, dt: 5 },
        ]);
        expect(timelineFrom([])).toEqual([]);
    });

    it("logs once, from the first call, and reports the total", async () => {
        const boot = await loadFresh();
        boot.bootMark("restore-start", 1);
        boot.bootMark("first-sync", 101);

        boot.logBootTimeline();
        boot.logBootTimeline();

        expect(console.info).toHaveBeenCalledTimes(1);
        const text = vi.mocked(console.info).mock.calls[0][0] as string;
        expect(text).toContain("[boot] restore-start +1.0ms (at 1.0ms)");
        expect(text).toContain("[boot] first-sync +100.0ms (at 101.0ms)");
        expect(text).toContain("[boot] total 101.0ms (2 marks)");
    });

    it("falls back to a timed log when the first sync never lands", async () => {
        const boot = await loadFresh();
        boot.bootMark("shell-committed", 50);
        boot.scheduleBootLog();

        vi.advanceTimersByTime(boot.BOOT_LOG_DELAY_MS - 1);
        expect(console.info).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(console.info).toHaveBeenCalledTimes(1);
    });

    it("does not schedule a fallback log after the first log ran", async () => {
        const boot = await loadFresh();
        boot.bootMark("first-sync", 20);
        boot.logBootTimeline();
        boot.scheduleBootLog();

        vi.advanceTimersByTime(boot.BOOT_LOG_DELAY_MS * 2);
        expect(console.info).toHaveBeenCalledTimes(1);
    });

    it("stays silent when nothing was recorded", async () => {
        const boot = await loadFresh();
        boot.logBootTimeline();
        expect(console.info).not.toHaveBeenCalled();
    });
});

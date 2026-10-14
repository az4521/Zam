import { describe, it, expect } from "vitest";
import {
    createOverloadMonitor,
    fastEnough,
    readVerdict,
    slackFor,
    type VerdictStore,
    type WorkletStats,
} from "./backend";

/** zam.storage stand-in. */
function store(v: unknown): VerdictStore {
    return {
        get: <T>(_k: string, fb?: T) => (v === undefined ? fb : v) as T,
        set: () => {},
    };
}

function stats(over: Partial<WorkletStats>): WorkletStats {
    return {
        type: "stats",
        frames: 0,
        sent: 0,
        received: 0,
        misses: 0,
        skipped: 0,
        slack: 2,
        ...over,
    };
}

describe("fastEnough", () => {
    it("needs both the median and the tail under budget", () => {
        expect(fastEnough({ medianMs: 3.2, p90Ms: 4 })).toBe(true);
        expect(fastEnough({ medianMs: 7, p90Ms: 8 })).toBe(false);
        expect(fastEnough({ medianMs: 3, p90Ms: 12 })).toBe(false);
    });
});

describe("slackFor", () => {
    it("covers one render burst plus a frame, at least two", () => {
        expect(slackFor(0.01)).toEqual({ slack: 2, maxSlack: 10 });
        expect(slackFor(0)).toEqual({ slack: 2, maxSlack: 10 });
        expect(slackFor(0.0267)).toEqual({ slack: 4, maxSlack: 12 });
        // The emulator that needed 14.
        expect(slackFor(0.0908).slack).toBe(11);
        expect(slackFor(0.0908).maxSlack).toBeGreaterThanOrEqual(14);
    });
});

describe("createOverloadMonitor", () => {
    it("stays quiet while the backend keeps up", () => {
        const fails: string[] = [];
        const m = createOverloadMonitor(8, (r) => fails.push(r));
        for (let i = 0; i <= 10; i++)
            m(stats({ frames: i * 100, sent: i * 100, received: i * 100 - 2 }));
        expect(fails).toEqual([]);
    });

    it("reports a stalled backend after three silent seconds", () => {
        const fails: string[] = [];
        const m = createOverloadMonitor(8, (r) => fails.push(r));
        m(stats({ frames: 100, sent: 100, received: 98 }));
        for (let i = 2; i <= 4; i++)
            m(stats({ frames: i * 100, sent: i * 100, received: 98 }));
        expect(fails).toEqual(["stalled"]);
        // Once only.
        m(stats({ frames: 600, sent: 600, received: 98 }));
        expect(fails).toEqual(["stalled"]);
    });

    it("reports overload only at the widest slack", () => {
        const fails: string[] = [];
        const m = createOverloadMonitor(8, (r) => fails.push(r));
        // Missing 10% while the worklet can still widen: not yet.
        for (let i = 0; i <= 4; i++)
            m(
                stats({
                    frames: i * 100,
                    sent: i * 100,
                    received: i * 100,
                    misses: i * 10,
                    slack: 6,
                }),
            );
        expect(fails).toEqual([]);
        for (let i = 5; i <= 8; i++)
            m(
                stats({
                    frames: i * 100,
                    sent: i * 100,
                    received: i * 100,
                    misses: i * 10,
                    slack: 8,
                }),
            );
        expect(fails).toEqual(["overload"]);
    });

    it("forgives an isolated bad second", () => {
        const fails: string[] = [];
        const m = createOverloadMonitor(8, (r) => fails.push(r));
        const seq = [0, 0, 20, 20, 20, 40, 40, 40];
        seq.forEach((miss, i) =>
            m(
                stats({
                    frames: i * 100,
                    sent: i * 100,
                    received: i * 100,
                    misses: miss,
                    slack: 8,
                }),
            ),
        );
        expect(fails).toEqual([]);
    });
});

describe("verdict", () => {
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    const v = (reason: string, ageMs: number) => ({
        ok: false,
        backend: "worker",
        medianMs: 9,
        reason,
        at: now - ageMs,
    });

    it("remembers a slow device for two weeks", () => {
        expect(readVerdict(store(v("benchmark", 13 * day)), now)?.ok).toBe(
            false,
        );
        expect(readVerdict(store(v("benchmark", 15 * day)), now)).toBeNull();
    });

    it("gives a crashed backend another go after an hour", () => {
        expect(readVerdict(store(v("stalled", 30 * 60e3)), now)?.ok).toBe(
            false,
        );
        expect(readVerdict(store(v("stalled", 61 * 60e3)), now)).toBeNull();
    });

    it("ignores garbage", () => {
        expect(readVerdict(store(undefined), now)).toBeNull();
        expect(readVerdict(store({ ok: "yes" }), now)).toBeNull();
    });
});

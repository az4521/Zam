import { describe, it, expect } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const {
    createUpdateSchedule,
    FIRST_CHECK_DELAY_MS,
    CHECK_INTERVAL_MS,
    RESUME_MIN_GAP_MS,
    RESUME_CHECK_DELAY_MS,
} = require(join(__dirname, "../../../electron/updateSchedule.cjs"));

/** A fake clock with timers that fire when time is advanced past them. */
function fakeTime() {
    let t = 0;
    let nextId = 1;
    const timers = new Map<number, { at: number; fn: () => void }>();
    return {
        now: () => t,
        setTimer: (fn: () => void, ms: number) => {
            const id = nextId++;
            timers.set(id, { at: t + ms, fn });
            return id;
        },
        clearTimer: (id: number) => {
            timers.delete(id);
        },
        /** Move the clock forward, firing due timers in order. */
        advance(ms: number) {
            const end = t + ms;
            for (;;) {
                let due: [number, { at: number; fn: () => void }] | null = null;
                for (const e of timers) {
                    if (e[1].at <= end && (!due || e[1].at < due[1].at))
                        due = e;
                }
                if (!due) break;
                timers.delete(due[0]);
                t = due[1].at;
                due[1].fn();
            }
            t = end;
        },
        /** Jump the clock without firing anything, like a sleeping PC. */
        sleep(ms: number) {
            t += ms;
            for (const timer of timers.values()) timer.at += ms;
        },
        pending: () => timers.size,
    };
}

function setup() {
    const time = fakeTime();
    let checks = 0;
    const schedule = createUpdateSchedule({
        check: () => checks++,
        now: time.now,
        setTimer: time.setTimer,
        clearTimer: time.clearTimer,
    });
    return { time, schedule, checks: () => checks };
}

describe("createUpdateSchedule", () => {
    it("checks shortly after launch, not before", () => {
        const { time, schedule, checks } = setup();
        schedule.start();
        time.advance(FIRST_CHECK_DELAY_MS - 1);
        expect(checks()).toBe(0);
        time.advance(1);
        expect(checks()).toBe(1);
    });

    it("keeps checking every interval while the app runs", () => {
        const { time, schedule, checks } = setup();
        schedule.start();
        time.advance(FIRST_CHECK_DELAY_MS);
        time.advance(CHECK_INTERVAL_MS * 3);
        expect(checks()).toBe(4);
        expect(time.pending()).toBe(1);
    });

    it("checks soon after waking when the last check is old", () => {
        const { time, schedule, checks } = setup();
        schedule.start();
        time.advance(FIRST_CHECK_DELAY_MS);
        // Asleep for a day: timers don't advance meanwhile.
        time.sleep(24 * 60 * 60 * 1000);
        schedule.onResume();
        time.advance(RESUME_CHECK_DELAY_MS);
        expect(checks()).toBe(2);
        // And the regular interval carries on from there, with one timer.
        expect(time.pending()).toBe(1);
        time.advance(CHECK_INTERVAL_MS);
        expect(checks()).toBe(3);
    });

    it("doesn't re-check on a wake soon after a check", () => {
        const { time, schedule, checks } = setup();
        schedule.start();
        time.advance(FIRST_CHECK_DELAY_MS);
        time.advance(RESUME_MIN_GAP_MS - 1000);
        schedule.onResume();
        time.advance(RESUME_CHECK_DELAY_MS);
        expect(checks()).toBe(1);
    });

    it("leaves a pending launch check alone on wake", () => {
        const { time, schedule, checks } = setup();
        schedule.start();
        schedule.onResume();
        time.advance(FIRST_CHECK_DELAY_MS);
        expect(checks()).toBe(1);
        expect(time.pending()).toBe(1);
    });

    it("keeps its schedule when a check throws", () => {
        const time = fakeTime();
        let calls = 0;
        const schedule = createUpdateSchedule({
            check: () => {
                calls++;
                throw new Error("offline");
            },
            now: time.now,
            setTimer: time.setTimer,
            clearTimer: time.clearTimer,
        });
        schedule.start();
        expect(() => time.advance(FIRST_CHECK_DELAY_MS)).toThrow("offline");
        expect(time.pending()).toBe(1);
        expect(() => time.advance(CHECK_INTERVAL_MS)).toThrow("offline");
        expect(calls).toBe(2);
    });

    it("stops", () => {
        const { time, schedule, checks } = setup();
        schedule.start();
        schedule.stop();
        time.advance(CHECK_INTERVAL_MS * 2);
        expect(checks()).toBe(0);
    });
});

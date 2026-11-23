import { describe, it, expect, vi, afterEach } from "vitest";
import {
    WaitTimeoutError,
    currentRoomLine,
    fullIndexPercent,
    groupThousands,
    raceWithTimeout,
    unfinishedRoomCount,
} from "./fullIndexProgress";

describe("raceWithTimeout", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("resolves with the promise value when it settles in time", async () => {
        vi.useFakeTimers();
        const p = raceWithTimeout(Promise.resolve(7), 1000);
        await expect(p).resolves.toBe(7);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("passes through the promise's own rejection", async () => {
        vi.useFakeTimers();
        const boom = new Error("boom");
        await expect(raceWithTimeout(Promise.reject(boom), 1000)).rejects.toBe(
            boom,
        );
        expect(vi.getTimerCount()).toBe(0);
    });

    it("rejects with WaitTimeoutError when the promise hangs", async () => {
        vi.useFakeTimers();
        const never = new Promise<number>(() => {});
        const p = raceWithTimeout(never, 60_000);
        const assertion = expect(p).rejects.toBeInstanceOf(WaitTimeoutError);
        await vi.advanceTimersByTimeAsync(60_000);
        await assertion;
    });

    it("rejects with AbortError as soon as the signal aborts", async () => {
        vi.useFakeTimers();
        const ctl = new AbortController();
        const p = raceWithTimeout(
            new Promise<void>(() => {}),
            30_000,
            ctl.signal,
        );
        ctl.abort();
        await expect(p).rejects.toMatchObject({ name: "AbortError" });
        expect(vi.getTimerCount()).toBe(0);
    });

    it("rejects at once when the signal is already aborted", async () => {
        const ctl = new AbortController();
        ctl.abort();
        await expect(
            raceWithTimeout(Promise.resolve(1), 1000, ctl.signal),
        ).rejects.toMatchObject({ name: "AbortError" });
    });

    it("ignores a late result after the timeout", async () => {
        vi.useFakeTimers();
        let resolveLate!: (v: number) => void;
        const late = new Promise<number>((r) => (resolveLate = r));
        const p = raceWithTimeout(late, 100);
        const assertion = expect(p).rejects.toBeInstanceOf(WaitTimeoutError);
        await vi.advanceTimersByTimeAsync(100);
        await assertion;
        resolveLate(5);
        await Promise.resolve();
    });
});

describe("fullIndexPercent", () => {
    it("floors the share of rooms done", () => {
        expect(fullIndexPercent(0, 40)).toBe(0);
        expect(fullIndexPercent(12, 40)).toBe(30);
        expect(fullIndexPercent(1, 3)).toBe(33);
        expect(fullIndexPercent(40, 40)).toBe(100);
    });

    it("treats no candidate rooms as finished", () => {
        expect(fullIndexPercent(0, 0)).toBe(100);
    });

    it("clamps out-of-range inputs", () => {
        expect(fullIndexPercent(50, 40)).toBe(100);
        expect(fullIndexPercent(-3, 40)).toBe(0);
        expect(fullIndexPercent(1, Number.NaN)).toBe(100);
    });
});

describe("unfinishedRoomCount", () => {
    it("counts rooms not yet done", () => {
        expect(unfinishedRoomCount(12, 40)).toBe(28);
        expect(unfinishedRoomCount(40, 40)).toBe(0);
    });

    it("never goes negative", () => {
        expect(unfinishedRoomCount(45, 40)).toBe(0);
        expect(unfinishedRoomCount(-1, 4)).toBe(4);
    });
});

describe("groupThousands", () => {
    it("groups digits in threes", () => {
        expect(groupThousands(0)).toBe("0");
        expect(groupThousands(999)).toBe("999");
        expect(groupThousands(1000)).toBe("1,000");
        expect(groupThousands(3210)).toBe("3,210");
        expect(groupThousands(1234567)).toBe("1,234,567");
    });

    it("drops fractions and clamps bad input to zero", () => {
        expect(groupThousands(1234.9)).toBe("1,234");
        expect(groupThousands(-5)).toBe("0");
        expect(groupThousands(Number.NaN)).toBe("0");
    });
});

describe("currentRoomLine", () => {
    const base = { roomsDone: 0, roomsTotal: 3, pages: 0, messagesIndexed: 0 };

    it("is empty before any room", () => {
        expect(currentRoomLine(base)).toEqual({ kind: "none" });
    });

    it("names the catch-up pass", () => {
        expect(
            currentRoomLine({
                ...base,
                currentRoomId: "!a:x",
                currentRoomName: "A",
                currentPass: "recent",
                currentReachedTs: 5,
            }),
        ).toEqual({ kind: "recent", room: "A" });
    });

    it("gives how far back a history pass reached", () => {
        expect(
            currentRoomLine({
                ...base,
                currentRoomId: "!a:x",
                currentPass: "history",
                currentReachedTs: 1_700_000_000_000,
            }),
        ).toEqual({
            kind: "history",
            room: "!a:x",
            reachedTs: 1_700_000_000_000,
        });
    });

    it("says when the start of the room was reached", () => {
        expect(
            currentRoomLine({
                ...base,
                currentRoomId: "!a:x",
                currentPass: "history",
                currentReachedTs: 0,
            }),
        ).toEqual({ kind: "start", room: "!a:x" });
    });

    it("falls back to the room alone before its first page", () => {
        expect(
            currentRoomLine({
                ...base,
                currentRoomId: "!a:x",
                currentPass: "history",
            }),
        ).toEqual({ kind: "room", room: "!a:x" });
    });
});

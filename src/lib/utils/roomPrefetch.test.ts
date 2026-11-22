import { describe, expect, it } from "vitest";
import {
    PREFETCH_COOLDOWN_MS,
    PREFETCH_TARGET,
    pickPrefetchRooms,
    prefetchPageSize,
    type RoomPrefetchInput,
} from "./roomPrefetch";

const NOW = 1_000_000_000;

function input(over: Partial<RoomPrefetchInput> = {}): RoomPrefetchInput {
    return {
        visibleRoomIds: [],
        activeRoomId: null,
        loadedCounts: new Map(),
        lastPrefetchAt: new Map(),
        inFlight: new Set(),
        now: NOW,
        saveData: false,
        hidden: false,
        ...over,
    };
}

describe("pickPrefetchRooms", () => {
    it("picks visible rooms top of the list first", () => {
        expect(
            pickPrefetchRooms(input({ visibleRoomIds: ["!a", "!b"] })),
        ).toEqual(["!a", "!b"]);
    });

    it("caps the picks at the free concurrency slots", () => {
        const picked = pickPrefetchRooms(
            input({ visibleRoomIds: ["!a", "!b", "!c", "!d"] }),
        );
        expect(picked).toEqual(["!a", "!b"]);
    });

    it("counts rooms already in flight against the concurrency", () => {
        const picked = pickPrefetchRooms(
            input({
                visibleRoomIds: ["!a", "!b", "!c"],
                inFlight: new Set(["!x"]),
            }),
        );
        expect(picked).toEqual(["!a"]);
    });

    it("returns nothing when both slots are busy", () => {
        expect(
            pickPrefetchRooms(
                input({
                    visibleRoomIds: ["!a"],
                    inFlight: new Set(["!x", "!y"]),
                }),
            ),
        ).toEqual([]);
    });

    it("skips the active room", () => {
        expect(
            pickPrefetchRooms(
                input({ visibleRoomIds: ["!a", "!b"], activeRoomId: "!a" }),
            ),
        ).toEqual(["!b"]);
    });

    it("skips rooms already holding the target", () => {
        const picked = pickPrefetchRooms(
            input({
                visibleRoomIds: ["!a", "!b"],
                loadedCounts: new Map([
                    ["!a", PREFETCH_TARGET],
                    ["!b", PREFETCH_TARGET - 1],
                ]),
            }),
        );
        expect(picked).toEqual(["!b"]);
    });

    it("treats a room with no count as empty", () => {
        expect(pickPrefetchRooms(input({ visibleRoomIds: ["!new"] }))).toEqual([
            "!new",
        ]);
    });

    it("skips a room prefetched inside the cooldown", () => {
        const picked = pickPrefetchRooms(
            input({
                visibleRoomIds: ["!a", "!b"],
                lastPrefetchAt: new Map([
                    ["!a", NOW - PREFETCH_COOLDOWN_MS + 1],
                ]),
            }),
        );
        expect(picked).toEqual(["!b"]);
    });

    it("prefetches again once the cooldown has passed", () => {
        expect(
            pickPrefetchRooms(
                input({
                    visibleRoomIds: ["!a"],
                    lastPrefetchAt: new Map([
                        ["!a", NOW - PREFETCH_COOLDOWN_MS],
                    ]),
                }),
            ),
        ).toEqual(["!a"]);
    });

    it("skips a room whose fetch is in flight", () => {
        expect(
            pickPrefetchRooms(
                input({
                    visibleRoomIds: ["!a", "!b"],
                    inFlight: new Set(["!a"]),
                }),
            ),
        ).toEqual(["!b"]);
    });

    it("visits a duplicate room id once", () => {
        expect(
            pickPrefetchRooms(input({ visibleRoomIds: ["!a", "!a", "!b"] })),
        ).toEqual(["!a", "!b"]);
    });

    it("does nothing under saveData", () => {
        expect(
            pickPrefetchRooms(
                input({ visibleRoomIds: ["!a"], saveData: true }),
            ),
        ).toEqual([]);
    });

    it("does nothing while the document is hidden", () => {
        expect(
            pickPrefetchRooms(input({ visibleRoomIds: ["!a"], hidden: true })),
        ).toEqual([]);
    });

    it("returns nothing for an empty visible set", () => {
        expect(pickPrefetchRooms(input())).toEqual([]);
    });
});

describe("prefetchPageSize", () => {
    it("asks for the gap up to the target", () => {
        expect(prefetchPageSize(0)).toBe(PREFETCH_TARGET);
        expect(prefetchPageSize(5)).toBe(PREFETCH_TARGET - 5);
    });

    it("never asks for less than one event", () => {
        expect(prefetchPageSize(PREFETCH_TARGET)).toBe(1);
        expect(prefetchPageSize(PREFETCH_TARGET + 30)).toBe(1);
    });

    it("treats a negative count as zero", () => {
        expect(prefetchPageSize(-3)).toBe(PREFETCH_TARGET);
    });
});

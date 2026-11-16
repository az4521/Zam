import { describe, it, expect } from "vitest";
import {
    buildPrefetchRooms,
    parsePrefetchStatus,
    parseTakenPrefetchPage,
} from "./historyPrefetchPlan";

describe("buildPrefetchRooms", () => {
    it("skips finished rooms and rooms without a token", () => {
        const rooms = buildPrefetchRooms([
            { roomId: "!a:x", from: "t1", done: false },
            { roomId: "!b:x", from: "t2", done: true },
            { roomId: "!c:x", from: null, done: false },
            { roomId: "!d:x", from: "", done: false },
        ]);
        expect(rooms).toEqual([{ roomId: "!a:x", from: "t1" }]);
    });

    it("keeps row order and the first row of a duplicate room", () => {
        const rooms = buildPrefetchRooms([
            { roomId: "!b:x", from: "t9", done: false },
            { roomId: "!a:x", from: "t1", done: false },
            { roomId: "!b:x", from: "t2", done: false },
        ]);
        expect(rooms).toEqual([
            { roomId: "!b:x", from: "t9" },
            { roomId: "!a:x", from: "t1" },
        ]);
    });

    it("returns an empty plan for no rows", () => {
        expect(buildPrefetchRooms([])).toEqual([]);
    });
});

describe("parseTakenPrefetchPage", () => {
    it("parses a found page and its chunk", () => {
        const page = parseTakenPrefetchPage({
            found: true,
            chunk: '[{"event_id":"$e1"},{"event_id":"$e2"}]',
            end: "t2",
            fetchedAt: 1700000000000,
        });
        expect(page).toEqual({
            chunk: [{ event_id: "$e1" }, { event_id: "$e2" }],
            end: "t2",
            fetchedAt: 1700000000000,
        });
    });

    it("accepts a missing end as null", () => {
        const page = parseTakenPrefetchPage({
            found: true,
            chunk: "[]",
            end: null,
            fetchedAt: 1,
        });
        expect(page?.end).toBeNull();
        const noEnd = parseTakenPrefetchPage({
            found: true,
            chunk: "[]",
            fetchedAt: 1,
        });
        expect(noEnd?.end).toBeNull();
    });

    it("rejects not-found, malformed and wrong-typed results", () => {
        expect(parseTakenPrefetchPage({ found: false })).toBeNull();
        expect(parseTakenPrefetchPage(null)).toBeNull();
        expect(parseTakenPrefetchPage("nope")).toBeNull();
        expect(
            parseTakenPrefetchPage({
                found: true,
                chunk: "{not json",
                end: null,
                fetchedAt: 1,
            }),
        ).toBeNull();
        expect(
            parseTakenPrefetchPage({
                found: true,
                chunk: '{"a":1}',
                end: null,
                fetchedAt: 1,
            }),
        ).toBeNull();
        expect(
            parseTakenPrefetchPage({
                found: true,
                chunk: [],
                end: null,
                fetchedAt: 1,
            }),
        ).toBeNull();
        expect(
            parseTakenPrefetchPage({
                found: true,
                chunk: "[]",
                end: 5,
                fetchedAt: 1,
            }),
        ).toBeNull();
        expect(
            parseTakenPrefetchPage({
                found: true,
                chunk: "[]",
                end: null,
                fetchedAt: "1",
            }),
        ).toBeNull();
        expect(
            parseTakenPrefetchPage({
                found: true,
                chunk: "[]",
                end: null,
                fetchedAt: NaN,
            }),
        ).toBeNull();
    });
});

describe("parsePrefetchStatus", () => {
    it("parses a full status", () => {
        expect(
            parsePrefetchStatus({
                pages: 3,
                bytes: 4096,
                rooms: 2,
                lastRunAt: 1700000000000,
                lastError: null,
                lastResult: "done",
            }),
        ).toEqual({
            pages: 3,
            bytes: 4096,
            rooms: 2,
            lastRunAt: 1700000000000,
            lastError: null,
            lastResult: "done",
        });
    });

    it("treats a never-run account as nulls", () => {
        const s = parsePrefetchStatus({
            pages: 0,
            bytes: 0,
            rooms: 0,
            lastRunAt: null,
            lastError: null,
            lastResult: null,
        });
        expect(s?.lastRunAt).toBeNull();
        expect(s?.lastResult).toBeNull();
    });

    it("rejects negative or non-numeric counts", () => {
        expect(
            parsePrefetchStatus({ pages: -1, bytes: 0, rooms: 0 }),
        ).toBeNull();
        expect(
            parsePrefetchStatus({ pages: "3", bytes: 0, rooms: 0 }),
        ).toBeNull();
        expect(parsePrefetchStatus(undefined)).toBeNull();
    });
});

import { describe, it, expect } from "vitest";
import {
    isRoomReceiptPrivate,
    parseReceiptOverrides,
    receiptPrivacyExceptions,
} from "./receiptPrivacy";

describe("parseReceiptOverrides", () => {
    it("keeps valid entries and drops junk", () => {
        expect(
            parseReceiptOverrides(
                JSON.stringify({ "!a": "private", "!b": "public", "!c": 1 }),
            ),
        ).toEqual({ "!a": "private", "!b": "public" });
    });
    it("tolerates null, garbage and non-objects", () => {
        expect(parseReceiptOverrides(null)).toEqual({});
        expect(parseReceiptOverrides("{nope")).toEqual({});
        expect(parseReceiptOverrides("[1]")).toEqual({});
        expect(parseReceiptOverrides("3")).toEqual({});
    });
});

describe("isRoomReceiptPrivate", () => {
    it("falls back to the default with no overrides", () => {
        expect(isRoomReceiptPrivate("!r", ["!s"], {}, false)).toBe(false);
        expect(isRoomReceiptPrivate("!r", ["!s"], {}, true)).toBe(true);
    });
    it("a room override beats its space and the default", () => {
        const o = { "!r": "public", "!s": "private" } as const;
        expect(isRoomReceiptPrivate("!r", ["!s"], o, true)).toBe(false);
        expect(
            isRoomReceiptPrivate("!r", ["!s"], { "!r": "private" }, false),
        ).toBe(true);
    });
    it("a space override covers its rooms", () => {
        expect(
            isRoomReceiptPrivate("!r", ["!s"], { "!s": "private" }, false),
        ).toBe(true);
        expect(
            isRoomReceiptPrivate("!r", ["!s"], { "!s": "public" }, true),
        ).toBe(false);
    });
    it("conflicting spaces fail closed to private", () => {
        const o = { "!a": "public", "!b": "private" } as const;
        expect(isRoomReceiptPrivate("!r", ["!a", "!b"], o, false)).toBe(true);
    });
});

describe("receiptPrivacyExceptions", () => {
    it("lists only rooms that differ from the default", () => {
        const rooms = [
            { roomId: "!big", parentSpaceIds: ["!s"] },
            { roomId: "!small", parentSpaceIds: [] },
            { roomId: "!same", parentSpaceIds: [] },
        ];
        expect(
            receiptPrivacyExceptions(
                rooms,
                { "!s": "private", "!same": "public" },
                false,
            ),
        ).toEqual({ "!big": true });
    });
    it("is empty with no overrides", () => {
        expect(
            receiptPrivacyExceptions(
                [{ roomId: "!a", parentSpaceIds: [] }],
                {},
                true,
            ),
        ).toEqual({});
    });
});

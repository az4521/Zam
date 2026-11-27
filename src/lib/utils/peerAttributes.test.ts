import { describe, expect, it } from "vitest";
import {
    PeerAttributeBook,
    decodePeerAttributes,
    encodePeerAttributes,
    peerAttribute,
} from "./peerAttributes";

describe("peer attribute records", () => {
    it("round-trips a record", () => {
        const rec = { "zam.watching": '["@a:x:D"]', "zam.decode": "vp8" };
        expect(decodePeerAttributes(encodePeerAttributes(rec))).toEqual(rec);
    });

    it("rejects what is not a record and drops non-string values", () => {
        const enc = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
        expect(decodePeerAttributes(enc([1, 2]))).toBeNull();
        expect(decodePeerAttributes(enc("x"))).toBeNull();
        expect(decodePeerAttributes(new TextEncoder().encode("{"))).toBeNull();
        expect(decodePeerAttributes(enc({ a: "1", b: 2 }))).toEqual({ a: "1" });
    });
});

describe("PeerAttributeBook", () => {
    it("reports the first record and changed keys, and merges", () => {
        const book = new PeerAttributeBook();
        expect(book.receive("@b:x:B", { w: "[]", d: "vp8" })).toEqual({
            first: true,
            changed: ["w", "d"],
        });
        expect(book.receive("@b:x:B", { w: '["s"]', d: "vp8" })).toEqual({
            first: false,
            changed: ["w"],
        });
        expect(book.receive("@b:x:B", { other: "1" }).first).toBe(false);
        expect(book.get("@b:x:B", "w")).toBe('["s"]');
        expect(book.get("@b:x:B", "other")).toBe("1");
    });

    it("forgets someone who left", () => {
        const book = new PeerAttributeBook();
        book.receive("@b:x:B", { w: "[]" });
        expect(book.forget("@b:x:B")).toBe(true);
        expect(book.get("@b:x:B", "w")).toBeUndefined();
        expect(book.receive("@b:x:B", { w: "[]" }).first).toBe(true);
    });

    it("prefers the data message over the LiveKit attribute", () => {
        const book = new PeerAttributeBook();
        const p = { identity: "@b:x:B", attributes: { w: "attr", d: "attr" } };
        book.receive("@b:x:B", { w: "data" });
        expect(peerAttribute(book, p, "w")).toBe("data");
        expect(peerAttribute(book, p, "d")).toBe("attr");
        expect(peerAttribute(undefined, p, "w")).toBe("attr");
    });
});

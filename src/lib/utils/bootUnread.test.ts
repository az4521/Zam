import { describe, expect, it } from "vitest";
import { BootUnread } from "./bootUnread";

describe("BootUnread", () => {
    it("keeps the saved verdict until the room is released", () => {
        const b = new BootUnread();
        b.restore([
            ["!read:hs", { unread: false, highlight: 0 }],
            ["!ping:hs", { unread: true, highlight: 2 }],
        ]);
        expect(b.get("!read:hs")).toEqual({ unread: false, highlight: 0 });
        expect(b.get("!ping:hs")).toEqual({ unread: true, highlight: 2 });
        expect(b.get("!other:hs")).toBeNull();
        expect(b.release(["!read:hs"])).toBe(true);
        expect(b.get("!read:hs")).toBeNull();
        expect(b.get("!ping:hs")).not.toBeNull();
    });

    it("a launched room is unread even when it was saved as read", () => {
        const b = new BootUnread();
        b.restore([["!r:hs", { unread: false, highlight: 0 }]]);
        b.markLaunched("!r:hs");
        expect(b.get("!r:hs")).toEqual({ unread: true, highlight: 0 });
        b.release(["!r:hs"]);
        expect(b.get("!r:hs")).toBeNull();
    });

    it("a launched room that was never saved is still unread", () => {
        const b = new BootUnread();
        b.markLaunched("!new:hs");
        expect(b.get("!new:hs")).toEqual({ unread: true, highlight: 0 });
    });

    it("a launch survives a fresh cache load", () => {
        const b = new BootUnread();
        b.markLaunched("!r:hs");
        b.restore([["!r:hs", { unread: false, highlight: 0 }]]);
        expect(b.get("!r:hs")?.unread).toBe(true);
    });

    it("releaseAll clears everything and reports whether anything was held", () => {
        const b = new BootUnread();
        expect(b.releaseAll()).toBe(false);
        b.restore([["!a:hs", { unread: false, highlight: 0 }]]);
        b.markLaunched("!b:hs");
        expect(b.releaseAll()).toBe(true);
        expect(b.get("!a:hs")).toBeNull();
        expect(b.get("!b:hs")).toBeNull();
    });

    it("release reports false for rooms it did not hold", () => {
        const b = new BootUnread();
        b.restore([["!a:hs", { unread: false, highlight: 0 }]]);
        expect(b.release(["!zzz:hs"])).toBe(false);
    });
});

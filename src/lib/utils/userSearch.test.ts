import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isValidUserId, mapUserSearchResults, debounce } from "./userSearch";

describe("isValidUserId — full @localpart:server shape", () => {
    it("accepts a normal user id", () => {
        expect(isValidUserId("@alice:example.org")).toBe(true);
    });

    it("accepts a server name with a port", () => {
        expect(isValidUserId("@alice:example.org:8448")).toBe(true);
    });

    it("rejects ids missing the leading @", () => {
        expect(isValidUserId("alice:example.org")).toBe(false);
    });

    it("rejects ids without a server part", () => {
        expect(isValidUserId("@alice")).toBe(false);
        expect(isValidUserId("@alice:")).toBe(false);
    });

    it("rejects an empty localpart", () => {
        expect(isValidUserId("@:example.org")).toBe(false);
    });

    it("rejects whitespace and empty input", () => {
        expect(isValidUserId("")).toBe(false);
        expect(isValidUserId("@ali ce:example.org")).toBe(false);
    });

    it("rejects plain search terms", () => {
        expect(isValidUserId("alice")).toBe(false);
    });
});

describe("mapUserSearchResults — normalize the user directory response", () => {
    it("maps snake_case fields and fills missing optionals with null", () => {
        expect(
            mapUserSearchResults([
                {
                    user_id: "@a:hs",
                    display_name: "Alice",
                    avatar_url: "mxc://hs/abc",
                },
                { user_id: "@b:hs" },
            ]),
        ).toEqual([
            {
                userId: "@a:hs",
                displayName: "Alice",
                avatarMxc: "mxc://hs/abc",
            },
            { userId: "@b:hs", displayName: null, avatarMxc: null },
        ]);
    });

    it("treats blank display names as missing", () => {
        expect(
            mapUserSearchResults([{ user_id: "@a:hs", display_name: "   " }]),
        ).toEqual([{ userId: "@a:hs", displayName: null, avatarMxc: null }]);
    });

    it("dedupes by user id, keeping the first entry", () => {
        const result = mapUserSearchResults([
            { user_id: "@a:hs", display_name: "First" },
            { user_id: "@a:hs", display_name: "Second" },
        ]);
        expect(result).toHaveLength(1);
        expect(result[0].displayName).toBe("First");
    });

    it("drops the searching user's own id", () => {
        expect(
            mapUserSearchResults(
                [{ user_id: "@me:hs" }, { user_id: "@other:hs" }],
                { ownUserId: "@me:hs" },
            ),
        ).toEqual([
            { userId: "@other:hs", displayName: null, avatarMxc: null },
        ]);
    });

    it("drops malformed entries without a user id", () => {
        expect(
            mapUserSearchResults([
                {} as never,
                { user_id: "not-a-user-id" },
                { user_id: "@ok:hs" },
            ]),
        ).toEqual([{ userId: "@ok:hs", displayName: null, avatarMxc: null }]);
    });

    it("hoists an exact user-id match for the term to the top", () => {
        const result = mapUserSearchResults(
            [
                { user_id: "@a:hs" },
                { user_id: "@b:hs" },
                { user_id: "@target:hs" },
            ],
            { term: "@target:hs" },
        );
        expect(result.map((u) => u.userId)).toEqual([
            "@target:hs",
            "@a:hs",
            "@b:hs",
        ]);
    });

    it("preserves server order otherwise", () => {
        const result = mapUserSearchResults(
            [{ user_id: "@z:hs" }, { user_id: "@a:hs" }],
            { term: "nobody" },
        );
        expect(result.map((u) => u.userId)).toEqual(["@z:hs", "@a:hs"]);
    });

    it("handles a missing results array", () => {
        expect(mapUserSearchResults(undefined as never)).toEqual([]);
    });
});

describe("debounce — trailing-edge debounce with cancel", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("does not call before the delay elapses", () => {
        const fn = vi.fn();
        const d = debounce(fn, 300);
        d("x");
        vi.advanceTimersByTime(299);
        expect(fn).not.toHaveBeenCalled();
    });

    it("calls once after the delay with the latest arguments", () => {
        const fn = vi.fn();
        const d = debounce(fn, 300);
        d("first");
        d("second");
        vi.advanceTimersByTime(300);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith("second");
    });

    it("resets the timer on each call", () => {
        const fn = vi.fn();
        const d = debounce(fn, 300);
        d("a");
        vi.advanceTimersByTime(200);
        d("b");
        vi.advanceTimersByTime(200);
        expect(fn).not.toHaveBeenCalled();
        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledWith("b");
    });

    it("cancel drops the pending call", () => {
        const fn = vi.fn();
        const d = debounce(fn, 300);
        d("a");
        d.cancel();
        vi.advanceTimersByTime(1000);
        expect(fn).not.toHaveBeenCalled();
    });
});

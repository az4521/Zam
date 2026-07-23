import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    isValidUserId,
    mapUserSearchResults,
    debounce,
    userDomain,
    resolveUserToken,
    resolveUserArg,
} from "./userSearch";

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

describe("userDomain — server-name portion of a user id", () => {
    it("extracts the server name", () => {
        expect(userDomain("@alice:example.org")).toBe("example.org");
    });
    it("includes a port in the server name", () => {
        expect(userDomain("@alice:example.org:8448")).toBe("example.org:8448");
    });
    it("returns empty for an id with no server part", () => {
        expect(userDomain("@nolocalpart")).toBe("");
    });
});

describe("mapUserSearchResults — same-homeserver ranking", () => {
    it("sorts same-domain users above federated ones", () => {
        const result = mapUserSearchResults(
            [
                { user_id: "@a:matrix.org" },
                { user_id: "@b:mystravil.xyz" },
                { user_id: "@c:other.net" },
                { user_id: "@d:mystravil.xyz" },
            ],
            { ownUserId: "@me:mystravil.xyz" },
        );
        expect(result.map((u) => u.userId)).toEqual([
            "@b:mystravil.xyz",
            "@d:mystravil.xyz",
            "@a:matrix.org",
            "@c:other.net",
        ]);
    });

    it("keeps input order within each group (stable sort)", () => {
        const result = mapUserSearchResults(
            [
                { user_id: "@z:matrix.org" },
                { user_id: "@y:mystravil.xyz" },
                { user_id: "@x:matrix.org" },
                { user_id: "@w:mystravil.xyz" },
            ],
            { ownUserId: "@me:mystravil.xyz" },
        );
        expect(result.map((u) => u.userId)).toEqual([
            "@y:mystravil.xyz",
            "@w:mystravil.xyz",
            "@z:matrix.org",
            "@x:matrix.org",
        ]);
    });

    it("compares the full server name including port", () => {
        const result = mapUserSearchResults(
            [
                { user_id: "@a:matrix.org" },
                { user_id: "@b:mystravil.xyz:8448" },
            ],
            { ownUserId: "@me:mystravil.xyz:8448" },
        );
        expect(result[0].userId).toBe("@b:mystravil.xyz:8448");
    });

    it("keeps an exact term match on top even if it is federated", () => {
        const result = mapUserSearchResults(
            [
                { user_id: "@local:mystravil.xyz" },
                { user_id: "@target:matrix.org" },
            ],
            { ownUserId: "@me:mystravil.xyz", term: "@target:matrix.org" },
        );
        expect(result.map((u) => u.userId)).toEqual([
            "@target:matrix.org",
            "@local:mystravil.xyz",
        ]);
    });

    it("does not reorder when ownUserId is absent", () => {
        const result = mapUserSearchResults([
            { user_id: "@a:matrix.org" },
            { user_id: "@b:mystravil.xyz" },
        ]);
        expect(result.map((u) => u.userId)).toEqual([
            "@a:matrix.org",
            "@b:mystravil.xyz",
        ]);
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

describe("resolveUserToken", () => {
    it("passes through a valid full user id", () => {
        expect(resolveUserToken("@bob:hs.tld", "me.tld")).toBe("@bob:hs.tld");
    });
    it("synthesizes a bare localpart onto ownDomain", () => {
        expect(resolveUserToken("bob", "me.tld")).toBe("@bob:me.tld");
        expect(resolveUserToken("  bob  ", "me.tld")).toBe("@bob:me.tld");
    });
    it("returns null when there is no domain to synthesize onto", () => {
        expect(resolveUserToken("bob", "")).toBeNull();
    });
    it("returns null for empty / invalid tokens", () => {
        expect(resolveUserToken("  ", "me.tld")).toBeNull();
        expect(resolveUserToken("na@me", "me.tld")).toBeNull();
        expect(resolveUserToken("has:colon", "me.tld")).toBeNull();
    });
});

describe("resolveUserArg — slash-command user tokens", () => {
    const members = [
        { userId: "@alice:hs.tld", rawDisplayName: "Ann" },
        { userId: "@bob:hs.tld", rawDisplayName: "Bob" },
        { userId: "@carol:other.tld", rawDisplayName: "bob" },
        { userId: "@nameless:hs.tld" },
    ];

    it("passes through a full user id", () => {
        expect(resolveUserArg("@x:hs.tld", "me.tld", members)).toBe(
            "@x:hs.tld",
        );
    });

    it("resolves the display name of exactly one member, case-insensitively", () => {
        expect(resolveUserArg("@Ann", "me.tld", members)).toBe("@alice:hs.tld");
        expect(resolveUserArg("@ann", "me.tld", members)).toBe("@alice:hs.tld");
    });

    it("refuses an ambiguous display name instead of guessing", () => {
        expect(resolveUserArg("@Bob", "me.tld", members)).toBeNull();
    });

    it("does not name-match a bare '@' against nameless members", () => {
        expect(resolveUserArg("@", "me.tld", members)).toBeNull();
    });

    it("synthesizes a bare or @-prefixed localpart onto ownDomain", () => {
        expect(resolveUserArg("dev", "me.tld", members)).toBe("@dev:me.tld");
        expect(resolveUserArg("@dev", "me.tld", members)).toBe("@dev:me.tld");
    });

    it("a member whose display name looks like an mxid cannot hijack it", () => {
        const spoof = [{ userId: "@evil:hs.tld", rawDisplayName: "@x:hs.tld" }];
        expect(resolveUserArg("@x:hs.tld", "me.tld", spoof)).toBe("@x:hs.tld");
    });

    it("returns null for junk and for empty input", () => {
        expect(resolveUserArg("", "me.tld", members)).toBeNull();
        expect(resolveUserArg("  ", "me.tld", members)).toBeNull();
        expect(resolveUserArg("na@me", "me.tld", members)).toBeNull();
        expect(resolveUserArg("has:colon", "me.tld", members)).toBeNull();
    });

    it("returns null for a localpart with no domain to synthesize onto", () => {
        expect(resolveUserArg("dev", "", [])).toBeNull();
    });
});

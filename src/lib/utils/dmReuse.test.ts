import { describe, it, expect } from "vitest";
import { firstReusableDmRoom } from "./dmReuse";

describe("firstReusableDmRoom", () => {
    it("returns undefined for an undefined list", () => {
        expect(firstReusableDmRoom(undefined, () => "join")).toBeUndefined();
    });

    it("returns undefined for an empty list", () => {
        expect(firstReusableDmRoom([], () => "join")).toBeUndefined();
    });

    it("returns the sole joined room", () => {
        expect(firstReusableDmRoom(["!a"], () => "join")).toBe("!a");
    });

    it("returns the FIRST joined room when several are joined", () => {
        expect(firstReusableDmRoom(["!a", "!b"], () => "join")).toBe("!a");
    });

    // The bug: m.direct[userId][0] is a room the client doesn't hold
    // (getMyMembership() -> undefined). The old code checked only [0] and, on a
    // miss, created a brand-new duplicate DM instead of reusing the live room.
    it("SKIPS a dead first entry and reuses the next joined room", () => {
        const membership = (id: string) =>
            id === "!live" ? "join" : undefined;
        expect(firstReusableDmRoom(["!dead", "!live"], membership)).toBe(
            "!live",
        );
    });

    it("treats every non-join membership as not reusable", () => {
        const m: Record<string, string | undefined> = {
            "!leave": "leave",
            "!invite": "invite",
            "!ban": "ban",
            "!knock": "knock",
            "!unknown": undefined,
            "!join": "join",
        };
        expect(
            firstReusableDmRoom(
                ["!leave", "!invite", "!ban", "!knock", "!unknown", "!join"],
                (id) => m[id],
            ),
        ).toBe("!join");
    });

    it("returns undefined when no listed room is joined", () => {
        expect(
            firstReusableDmRoom(["!dead1", "!dead2"], () => undefined),
        ).toBeUndefined();
    });
});

import { describe, expect, it } from "vitest";
import {
    directRoomMap,
    pillLabelKey,
    resolvePillLabel,
    type PillLookups,
} from "./label";
import { parseMessagePermalink, shouldPillAnchor } from "./links";

const lookups = (over: Partial<PillLookups> = {}): PillLookups => ({
    roomIdForAlias: (a) => (a === "#chat:hs" ? "!chat:hs" : null),
    room: (id) =>
        id === "!chat:hs"
            ? { name: "General Chat", avatarUrl: null }
            : id === "!dm:hs"
              ? { name: "Alice", avatarUrl: "https://hs/room-av" }
              : id === "!unnamed:hs"
                ? { name: "!unnamed:hs", avatarUrl: null }
                : null,
    dmUserId: (id) => (id === "!dm:hs" ? "@alice:hs" : null),
    memberAvatar: () => "https://hs/alice-av",
    ...over,
});

describe("resolvePillLabel", () => {
    it("names a joined room", () => {
        expect(resolvePillLabel("!chat:hs", lookups())).toEqual({
            kind: "room",
            name: "General Chat",
        });
    });

    it("resolves an alias to its joined room", () => {
        expect(resolvePillLabel("#chat:hs", lookups())).toEqual({
            kind: "room",
            name: "General Chat",
        });
    });

    it("shows an unknown alias as the alias", () => {
        expect(resolvePillLabel("#other:hs", lookups())).toEqual({
            kind: "room",
            name: "other:hs",
        });
    });

    it("uses the DM partner's avatar, falling back to the room's", () => {
        expect(resolvePillLabel("!dm:hs", lookups())).toEqual({
            kind: "dm",
            name: "Alice",
            avatarUrl: "https://hs/alice-av",
        });
        expect(
            resolvePillLabel("!dm:hs", lookups({ memberAvatar: () => null })),
        ).toMatchObject({ avatarUrl: "https://hs/room-av" });
    });

    it("falls back for rooms not joined or without a name yet", () => {
        expect(resolvePillLabel("!gone:hs", lookups())).toEqual({
            kind: "unknown",
        });
        expect(resolvePillLabel("!unnamed:hs", lookups())).toEqual({
            kind: "unknown",
        });
    });

    it("does not double a leading #", () => {
        const l = lookups({
            room: () => ({ name: "#lobby", avatarUrl: null }),
        });
        expect(resolvePillLabel("!x:hs", l)).toEqual({
            kind: "room",
            name: "lobby",
        });
    });
});

describe("directRoomMap", () => {
    it("inverts m.direct and ignores junk", () => {
        const map = directRoomMap({
            "@a:hs": ["!1:hs", 5],
            "@b:hs": "nope",
        });
        expect([...map]).toEqual([["!1:hs", "@a:hs"]]);
        expect(directRoomMap(null).size).toBe(0);
    });
});

describe("pillLabelKey", () => {
    it("changes when the avatar changes", () => {
        expect(
            pillLabelKey({ kind: "dm", name: "A", avatarUrl: "x" }),
        ).not.toBe(pillLabelKey({ kind: "dm", name: "A", avatarUrl: null }));
    });
});

describe("links", () => {
    const href = "https://matrix.to/#/!room:hs/$ev?via=hs";

    it("parses matrix.to and matrix: message links", () => {
        expect(parseMessagePermalink(href)).toMatchObject({
            roomOrAlias: "!room:hs",
            eventId: "$ev",
        });
        expect(parseMessagePermalink("matrix:r/chat:hs/e/ev")).toMatchObject({
            roomOrAlias: "#chat:hs",
            eventId: "$ev",
        });
        expect(parseMessagePermalink("https://matrix.to/#/!room:hs")).toBe(
            null,
        );
    });

    it("pills only raw URLs, not custom labels", () => {
        expect(shouldPillAnchor(href, href)).toBe(true);
        expect(shouldPillAnchor(href, "see here")).toBe(false);
        expect(
            shouldPillAnchor(
                "https://matrix.to/#/@u:hs",
                "https://matrix.to/#/@u:hs",
            ),
        ).toBe(false);
    });
});

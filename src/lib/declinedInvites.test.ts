import { describe, it, expect } from "vitest";
import {
    parseDeclinedInvites,
    planDeclinedInvites,
    type DeclinedInvite,
    type InviteLookup,
} from "./declinedInvites";

const ME = "@me:hs";
const NOW = 10_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const decline = (roomId: string, ts = NOW - 1000, userId = ME) => ({
    userId,
    roomId,
    ts,
});
const store =
    (rooms: Record<string, InviteLookup>) =>
    (roomId: string): InviteLookup =>
        rooms[roomId] ?? null;

describe("parseDeclinedInvites", () => {
    it("reads the receiver's array and drops malformed entries", () => {
        const raw = JSON.stringify([
            decline("!a"),
            { userId: ME, roomId: "!b" },
            null,
            "x",
        ]);
        expect(parseDeclinedInvites(raw)).toEqual([decline("!a")]);
    });

    it("treats absent or corrupt storage as empty", () => {
        expect(parseDeclinedInvites(null)).toEqual([]);
        expect(parseDeclinedInvites("{")).toEqual([]);
        expect(parseDeclinedInvites('{"a":1}')).toEqual([]);
    });
});

describe("planDeclinedInvites", () => {
    it("settles an invite the store still offers", () => {
        const plan = planDeclinedInvites(
            [decline("!a")],
            ME,
            NOW,
            store({ "!a": { membership: "invite", inviteTs: NOW - 5000 } }),
        );
        expect(plan).toEqual({ settle: ["!a"], keep: [] });
    });

    it("leaves a newer invite to the same room alone", () => {
        const plan = planDeclinedInvites(
            [decline("!a")],
            ME,
            NOW,
            store({ "!a": { membership: "invite", inviteTs: NOW } }),
        );
        expect(plan).toEqual({ settle: [], keep: [] });
    });

    it("drops the entry once the room is joined or left", () => {
        const plan = planDeclinedInvites(
            [decline("!a"), decline("!b")],
            ME,
            NOW,
            store({
                "!a": { membership: "join" },
                "!b": { membership: "leave" },
            }),
        );
        expect(plan).toEqual({ settle: [], keep: [] });
    });

    it("keeps an entry whose room has not appeared yet, for a week", () => {
        const fresh = decline("!a");
        const stale = decline("!b", NOW - 8 * DAY);
        const plan = planDeclinedInvites([fresh, stale], ME, NOW, store({}));
        expect(plan).toEqual({ settle: [], keep: [fresh] });
    });

    it("keeps another account's entries without touching its rooms", () => {
        const other: DeclinedInvite = decline("!a", NOW - 1000, "@other:hs");
        const plan = planDeclinedInvites(
            [other],
            ME,
            NOW,
            store({ "!a": { membership: "invite", inviteTs: 0 } }),
        );
        expect(plan).toEqual({ settle: [], keep: [other] });
    });
});

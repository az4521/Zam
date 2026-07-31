import { describe, it, expect } from "vitest";
import { resolveLandingTarget, type LandingInput } from "./landingSurface";

/** A snapshot where the user is sitting happily in a joined room inside a space. */
function baseInput(overrides: Partial<LandingInput> = {}): LandingInput {
    return {
        roomsReady: true,
        showInbox: false,
        activeSpaceId: "!space:server",
        activeRoomId: "!general:server",
        activeRoomIsJoined: true,
        spaceRoomIds: ["!general:server", "!random:server"],
        homeRoomIds: ["!orphan:server", "!dm:server"],
        ...overrides,
    };
}

describe("resolveLandingTarget — leaves a good selection alone", () => {
    it("keeps a joined active room", () => {
        expect(resolveLandingTarget(baseInput())).toEqual({ kind: "keep" });
    });

    it("keeps a joined active room at Home", () => {
        const target = resolveLandingTarget(
            baseInput({
                activeSpaceId: null,
                activeRoomId: "!dm:server",
                spaceRoomIds: [],
            }),
        );
        expect(target).toEqual({ kind: "keep" });
    });

    it("keeps a joined room that the space's child list has not caught up with", () => {
        // Federated rooms are omitted from continuwuity's /sync, so the space
        // child list can transiently miss a room the user is really in.
        const target = resolveLandingTarget(
            baseInput({ spaceRoomIds: ["!random:server"] }),
        );
        expect(target).toEqual({ kind: "keep" });
    });
});

describe("resolveLandingTarget — never acts before the room list is real", () => {
    it("keeps everything while rooms are not ready, even with no active room", () => {
        const target = resolveLandingTarget(
            baseInput({
                roomsReady: false,
                activeRoomId: null,
                activeRoomIsJoined: false,
            }),
        );
        expect(target).toEqual({ kind: "keep" });
    });

    it("keeps a stale active room while rooms are not ready", () => {
        const target = resolveLandingTarget(
            baseInput({ roomsReady: false, activeRoomIsJoined: false }),
        );
        expect(target).toEqual({ kind: "keep" });
    });

    it("keeps the inbox surface even with no active room", () => {
        const target = resolveLandingTarget(
            baseInput({
                showInbox: true,
                activeRoomId: null,
                activeRoomIsJoined: false,
            }),
        );
        expect(target).toEqual({ kind: "keep" });
    });
});

describe("resolveLandingTarget — Home", () => {
    it("lands on Home's first room when nothing is cached", () => {
        const target = resolveLandingTarget(
            baseInput({
                activeSpaceId: null,
                activeRoomId: null,
                activeRoomIsJoined: false,
            }),
        );
        expect(target).toEqual({ kind: "room", roomId: "!orphan:server" });
    });

    it("lands on the first DM when Home has only DMs", () => {
        const target = resolveLandingTarget(
            baseInput({
                activeSpaceId: null,
                activeRoomId: null,
                activeRoomIsJoined: false,
                homeRoomIds: ["!dm:server"],
            }),
        );
        expect(target).toEqual({ kind: "room", roomId: "!dm:server" });
    });

    it("falls through a stale cached room at Home (left/kicked/forgotten)", () => {
        const target = resolveLandingTarget(
            baseInput({
                activeSpaceId: null,
                activeRoomId: "!left:server",
                activeRoomIsJoined: false,
            }),
        );
        expect(target).toEqual({ kind: "room", roomId: "!orphan:server" });
    });

    it("reports nothing to land on when Home is genuinely empty", () => {
        const target = resolveLandingTarget(
            baseInput({
                activeSpaceId: null,
                activeRoomId: null,
                activeRoomIsJoined: false,
                homeRoomIds: [],
            }),
        );
        expect(target).toEqual({ kind: "none" });
    });
});

describe("resolveLandingTarget — inside a space", () => {
    it("lands on the space's first room when nothing is cached", () => {
        const target = resolveLandingTarget(
            baseInput({ activeRoomId: null, activeRoomIsJoined: false }),
        );
        expect(target).toEqual({ kind: "room", roomId: "!general:server" });
    });

    it("falls through a stale cached room inside a space", () => {
        const target = resolveLandingTarget(
            baseInput({
                activeRoomId: "!kicked:server",
                activeRoomIsJoined: false,
            }),
        );
        expect(target).toEqual({ kind: "room", roomId: "!general:server" });
    });

    it("takes the FIRST id verbatim — the caller has already applied sidebar order", () => {
        const target = resolveLandingTarget(
            baseInput({
                activeRoomId: null,
                activeRoomIsJoined: false,
                spaceRoomIds: ["!favourite:server", "!general:server"],
            }),
        );
        expect(target).toEqual({ kind: "room", roomId: "!favourite:server" });
    });

    it("reports nothing to land on when no room in the space is joined", () => {
        const target = resolveLandingTarget(
            baseInput({
                activeRoomId: null,
                activeRoomIsJoined: false,
                spaceRoomIds: [],
            }),
        );
        expect(target).toEqual({ kind: "none" });
    });

    it("does not borrow a Home room to fill an empty space", () => {
        const target = resolveLandingTarget(
            baseInput({
                activeRoomId: null,
                activeRoomIsJoined: false,
                spaceRoomIds: [],
                homeRoomIds: ["!orphan:server"],
            }),
        );
        expect(target).toEqual({ kind: "none" });
    });
});

describe("resolveLandingTarget — a space we are not joined to (never a Home redirect)", () => {
    it("returns none — NEVER a Home room — for an unjoined space with nothing joined in it", () => {
        // The ruling this pins: not being joined to a space is not evidence the
        // space is gone. `roomsState.spaces` is stale for a beat after joining
        // one, so redirecting on it would eject the user from the space they
        // just joined. `none` leaves them there, on Browse Channels — an
        // actionable surface — with Home one sidebar click away.
        const target = resolveLandingTarget(
            baseInput({
                activeRoomId: null,
                activeRoomIsJoined: false,
                spaceRoomIds: [],
                homeRoomIds: ["!orphan:server", "!dm:server"],
            }),
        );
        expect(target).toEqual({ kind: "none" });
    });

    it("stays put in a drilled unjoined sub-space so Browse Channels can show", () => {
        const target = resolveLandingTarget(
            baseInput({
                activeRoomId: null,
                activeRoomIsJoined: false,
                spaceRoomIds: [],
            }),
        );
        expect(target).toEqual({ kind: "none" });
    });

    it("lands on a drilled unjoined sub-space's first joined channel rather than Browse Channels", () => {
        // Drilled into a sub-space we have not joined, but we HAVE joined one of
        // its channels, and the remembered room is stale (left/kicked). Showing
        // an inert Browse panel over a channel the user can already read is the
        // "failed click" this feature exists to kill.
        const target = resolveLandingTarget(
            baseInput({
                activeRoomId: "!kicked:server",
                activeRoomIsJoined: false,
                spaceRoomIds: ["!subchannel:server", "!other:server"],
            }),
        );
        expect(target).toEqual({ kind: "room", roomId: "!subchannel:server" });
    });

    it("keeps a joined room in a space that exposes no joined children at all", () => {
        // The active room wins over the space branch even when that branch has
        // nothing to offer — an unjoined sub-space we are reading one room of.
        const target = resolveLandingTarget(baseInput({ spaceRoomIds: [] }));
        expect(target).toEqual({ kind: "keep" });
    });
});

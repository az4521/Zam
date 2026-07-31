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
        activeSpaceIsJoined: true,
        isDrilledSubspace: false,
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

describe("resolveLandingTarget — a cached space that is gone", () => {
    it("redirects to Home when the active space is no longer joined", () => {
        const target = resolveLandingTarget(
            baseInput({
                activeRoomId: null,
                activeRoomIsJoined: false,
                activeSpaceIsJoined: false,
                spaceRoomIds: [],
            }),
        );
        expect(target).toEqual({ kind: "home" });
    });

    it("redirects to Home even when Home is empty — the space is still gone", () => {
        const target = resolveLandingTarget(
            baseInput({
                activeRoomId: null,
                activeRoomIsJoined: false,
                activeSpaceIsJoined: false,
                spaceRoomIds: [],
                homeRoomIds: [],
            }),
        );
        expect(target).toEqual({ kind: "home" });
    });

    it("stays put in a drilled unjoined sub-space so Browse Channels can show", () => {
        const target = resolveLandingTarget(
            baseInput({
                activeRoomId: null,
                activeRoomIsJoined: false,
                activeSpaceIsJoined: false,
                isDrilledSubspace: true,
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
                activeSpaceIsJoined: false,
                isDrilledSubspace: true,
                spaceRoomIds: ["!subchannel:server", "!other:server"],
            }),
        );
        expect(target).toEqual({ kind: "room", roomId: "!subchannel:server" });
    });

    it("keeps a joined room inside an unjoined drilled sub-space", () => {
        const target = resolveLandingTarget(
            baseInput({
                activeSpaceIsJoined: false,
                isDrilledSubspace: true,
            }),
        );
        expect(target).toEqual({ kind: "keep" });
    });

    it("does not redirect away from an unjoined space the user is still in a room of", () => {
        // Membership of the space is irrelevant while the active room holds.
        const target = resolveLandingTarget(
            baseInput({ activeSpaceIsJoined: false }),
        );
        expect(target).toEqual({ kind: "keep" });
    });
});

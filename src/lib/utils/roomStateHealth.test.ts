import { describe, it, expect } from "vitest";
import { needsStateSeed, shouldPrimePaginationToken } from "./roomStateHealth";

// Regression cover for the bridged-space bug (2026-07-26): a space entered
// through an INVITE keeps only stripped invite state — m.room.create present
// but event-id-less, no m.space.child — so the old "has a create event?" test
// declared it healthy. The space then listed no channels and every room joined
// inside it landed in Home as an orphan. Reproduced live via acceptInvite().

describe("needsStateSeed", () => {
    it("seeds a joined room with no state at all (federated sync omission)", () => {
        expect(
            needsStateSeed({
                membership: "join",
                hasCreateEvent: false,
                createEventId: undefined,
            }),
        ).toBe(true);
    });

    it("seeds a joined room left with only STRIPPED invite state", () => {
        // invite_state events carry no event_id
        expect(
            needsStateSeed({
                membership: "join",
                hasCreateEvent: true,
                createEventId: undefined,
            }),
        ).toBe(true);
        expect(
            needsStateSeed({
                membership: "join",
                hasCreateEvent: true,
                createEventId: null,
            }),
        ).toBe(true);
    });

    it("leaves a properly synced joined room alone", () => {
        expect(
            needsStateSeed({
                membership: "join",
                hasCreateEvent: true,
                createEventId: "$realEventIdFromSync",
            }),
        ).toBe(false);
    });

    it("never seeds a room we are not joined to", () => {
        for (const membership of ["invite", "leave", "knock", "ban"]) {
            expect(
                needsStateSeed({
                    membership,
                    hasCreateEvent: true,
                    createEventId: undefined,
                }),
            ).toBe(false);
            expect(
                needsStateSeed({
                    membership,
                    hasCreateEvent: false,
                    createEventId: undefined,
                }),
            ).toBe(false);
        }
    });
});

// Regression cover for the "room opens empty and stays empty" race (2026-07-26).
// A healed room whose boot-time backfill threw keeps NO backward pagination
// token, so scrollback() silently no-ops and the caller reported "no more
// history" — latching pagination off for the whole session. Priming the token
// fixes that, but priming must never happen once real history is loaded: at the
// true start of a timeline the token is legitimately absent, and a fresh probe
// there hands back a token pointing at the NEWEST events, so pagination would
// never terminate.
describe("shouldPrimePaginationToken", () => {
    it("primes a timeline that was never given a token and holds nothing", () => {
        expect(
            shouldPrimePaginationToken({
                hasBackwardToken: false,
                timelineEventCount: 0,
            }),
        ).toBe(true);
    });

    it("does NOT prime a token-less timeline that already holds events — that is the real start of history", () => {
        expect(
            shouldPrimePaginationToken({
                hasBackwardToken: false,
                timelineEventCount: 42,
            }),
        ).toBe(false);
    });

    it("does not prime when a token is already present", () => {
        expect(
            shouldPrimePaginationToken({
                hasBackwardToken: true,
                timelineEventCount: 0,
            }),
        ).toBe(false);
        expect(
            shouldPrimePaginationToken({
                hasBackwardToken: true,
                timelineEventCount: 42,
            }),
        ).toBe(false);
    });
});

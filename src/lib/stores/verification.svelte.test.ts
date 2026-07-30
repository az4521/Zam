import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The store imports the crypto boundary at module load; stub it so no SDK is
// needed. Only `acceptIncoming` / `declineIncoming` behaviour is under test.
vi.mock("$lib/matrix/crypto", () => ({
    startDeviceVerification: vi.fn(),
    startUserVerification: vi.fn(),
    onIncomingVerificationRequest: vi.fn(() => () => {}),
    getPendingVerificationControllers: vi.fn(() => []),
}));

import {
    verificationState,
    acceptIncoming,
    declineIncoming,
    closeActive,
    isAcceptingRequest,
    acceptRequestError,
} from "./verification.svelte";
import { VerificationPhaseValue } from "$lib/utils/verification";

/** The one line a failed accept ever shows (acceptFailureText). */
const FAIL_COPY = "Couldn't accept this request. Try again.";

type Fake = {
    id: string;
    /** Mutable so a test can move a request to a terminal phase mid-flight,
     *  the way the SDK mutates the live request object in place. */
    phase: number;
    accept: () => Promise<void>;
    cancel: () => void;
    view: () => { phase: number };
    subscribe: (cb: () => void) => () => void;
};

function fakeController(id: string, accept: () => Promise<void>): Fake {
    const fake: Fake = {
        id,
        // "Unsent" is non-terminal for verificationPhaseKind.
        phase: VerificationPhaseValue.Unsent,
        accept,
        cancel: vi.fn(),
        view: () => ({ phase: fake.phase }),
        subscribe: () => () => {},
    };
    return fake;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asController = (c: Fake) => c as any;

// acceptFailureText logs every rejection; silence it and keep the spy so the
// tests that care can assert the raw error still reaches the console.
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    verificationState.incoming = [];
    verificationState.active = null;
    verificationState.accepting = null;
    verificationState.acceptErrors = {};
    verificationState.busyRefusalId = null;
});

afterEach(() => {
    warn.mockRestore();
});

describe("acceptIncoming", () => {
    it("promotes the request to the active flow once accept() resolves", async () => {
        const c = fakeController("$req1", async () => {});
        verificationState.incoming = [asController(c)];

        const ok = await acceptIncoming(asController(c));

        expect(ok).toBe(true);
        expect(verificationState.incoming).toEqual([]);
        expect(verificationState.active?.id).toBe("$req1");
        expect(acceptRequestError(asController(c))).toBeNull();
    });

    it("keeps the request queued and surfaces the error when accept() rejects", async () => {
        const c = fakeController("$req2", async () => {
            throw new Error("Cannot accept a verification request in state 6");
        });
        verificationState.incoming = [asController(c)];

        const ok = await acceptIncoming(asController(c));

        expect(ok).toBe(false);
        expect(verificationState.incoming.map((x) => x.id)).toEqual(["$req2"]);
        expect(verificationState.active).toBeNull();
        // Plain language on the card; the SDK's developer prose goes to the log.
        expect(acceptRequestError(asController(c))).toBe(FAIL_COPY);
        expect(isAcceptingRequest(asController(c))).toBe(false);
    });

    it("reports accepting while accept() is in flight", async () => {
        let release = () => {};
        const c = fakeController(
            "$req3",
            () => new Promise<void>((resolve) => (release = resolve)),
        );
        verificationState.incoming = [asController(c)];

        const pending = acceptIncoming(asController(c));
        expect(isAcceptingRequest(asController(c))).toBe(true);
        // Still queued mid-flight: the card must not vanish before it works.
        expect(verificationState.incoming.map((x) => x.id)).toEqual(["$req3"]);
        release();
        await pending;
        expect(isAcceptingRequest(asController(c))).toBe(false);
    });

    it("ignores a second accept while one is in flight", async () => {
        let release = () => {};
        const accept = vi.fn(
            () => new Promise<void>((resolve) => (release = resolve)),
        );
        const c = fakeController("$req4", accept);
        verificationState.incoming = [asController(c)];

        const first = acceptIncoming(asController(c));
        const second = await acceptIncoming(asController(c));
        expect(second).toBe(false);
        expect(accept).toHaveBeenCalledTimes(1);
        // A double-click on the SAME card is not an error: it is already
        // accepting, and the card says so.
        expect(acceptRequestError(asController(c))).toBeNull();
        release();
        await first;
    });

    it("clears a previous error when the retry succeeds", async () => {
        let fail = true;
        let release = () => {};
        const c = fakeController("$req5", () =>
            fail
                ? Promise.reject(new Error("boom"))
                : new Promise<void>((resolve) => (release = resolve)),
        );
        verificationState.incoming = [asController(c)];

        await acceptIncoming(asController(c));
        expect(acceptRequestError(asController(c))).toBe(FAIL_COPY);
        fail = false;
        const retry = acceptIncoming(asController(c));
        // The stale error must go the moment the retry STARTS: it describes a
        // finished attempt, and the card shows it instead of the subtitle, so
        // leaving it up reads as "this failed" while the retry is in flight.
        expect(acceptRequestError(asController(c))).toBeNull();
        release();
        await retry;
        expect(acceptRequestError(asController(c))).toBeNull();
        expect(verificationState.active?.id).toBe("$req5");
    });

    it("tells the user why a SECOND request's accept was refused, then forgets it", async () => {
        let release = () => {};
        const busy = fakeController(
            "$busy",
            () => new Promise<void>((resolve) => (release = resolve)),
        );
        const other = vi.fn(async () => {});
        const b = fakeController("$other", other);
        verificationState.incoming = [asController(busy), asController(b)];

        const first = acceptIncoming(asController(busy));
        const refused = await acceptIncoming(asController(b));

        expect(refused).toBe(false);
        expect(other).not.toHaveBeenCalled();
        // A refusal the user can SEE — the button looked live, so a silent
        // no-op would be a fresh piece of dishonesty (audit CRYPTO-03).
        expect(acceptRequestError(asController(b))).toMatch(/another/i);
        expect(verificationState.incoming.map((x) => x.id)).toEqual([
            "$busy",
            "$other",
        ]);

        release();
        await first;

        // …and it goes away with the accept that caused it, rather than sitting
        // on B's card claiming something is in flight when nothing is.
        expect(acceptRequestError(asController(b))).toBeNull();
        expect(verificationState.acceptErrors).toEqual({});
    });

    it("leaves a request that arrived mid-accept in the queue", async () => {
        let release = () => {};
        const a = fakeController(
            "$a",
            () => new Promise<void>((resolve) => (release = resolve)),
        );
        verificationState.incoming = [asController(a)];

        const pending = acceptIncoming(asController(a));
        // A second request lands while accept() is in flight (addIncoming).
        const b = fakeController("$b", async () => {});
        verificationState.incoming = [
            ...verificationState.incoming,
            asController(b),
        ];
        release();
        await pending;

        // Only the accepted one is dequeued: the post-await write must be a
        // filter on the CURRENT queue, not a stale snapshot of it.
        expect(verificationState.incoming.map((x) => x.id)).toEqual(["$b"]);
        expect(verificationState.active?.id).toBe("$a");
    });

    it("records no error, but still logs, when the request was pruned mid-accept", async () => {
        let reject = (_e: unknown) => {};
        const c = fakeController(
            "$gone",
            () => new Promise<void>((_r, rej) => (reject = rej)),
        );
        verificationState.incoming = [asController(c)];

        const pending = acceptIncoming(asController(c));
        // The other side cancels: addIncoming's subscriber sees a terminal
        // phase and drops the card (it is not the active flow).
        verificationState.incoming = [];
        const error = new Error("Unknown transaction");
        reject(error);
        const ok = await pending;

        expect(ok).toBe(false);
        // No card and no modal can show this, and removeIncoming (the only
        // thing that clears the map) has already run — so an entry here would
        // leak forever.
        expect(verificationState.acceptErrors).toEqual({});
        expect(verificationState.accepting).toBeNull();
        expect(verificationState.active).toBeNull();
        // The console is then the ONLY record that the accept failed, so the
        // log must not be skipped along with the copy.
        expect(warn).toHaveBeenCalledWith(
            "[matrix] verification accept failed",
            error,
        );
    });

    it("releases the gate when a stalled request's card is pruned", async () => {
        let rejectStalled = (_e: unknown) => {};
        const stalled = fakeController(
            "$stall",
            () => new Promise<void>((_r, rej) => (rejectStalled = rej)),
        );
        const acceptNext = vi.fn(async () => {});
        const next = fakeController("$next", acceptNext);
        verificationState.incoming = [
            asController(stalled),
            asController(next),
        ];

        const outstanding = acceptIncoming(asController(stalled));
        expect(verificationState.accepting).toBe("$stall");

        // Nothing bounds accept() client-side, so a card can leave the queue
        // while its accept promise is still outstanding — the user declining is
        // the escape hatch that makes that reachable on purpose, and the peer
        // cancelling reaches the same removeIncoming through the subscriber.
        declineIncoming(asController(stalled));
        expect(verificationState.accepting).toBeNull();

        // Without the release, this Verify — and every later one, on every
        // card, for the rest of the session — is refused.
        const ok = await acceptIncoming(asController(next));
        expect(ok).toBe(true);
        expect(acceptNext).toHaveBeenCalledTimes(1);
        expect(acceptRequestError(asController(next))).toBeNull();

        rejectStalled(new Error("timed out"));
        await outstanding;
        expect(verificationState.active?.id).toBe("$next");
        expect(verificationState.acceptErrors).toEqual({});
    });

    it("does not release a later accept's gate when a pruned one settles", async () => {
        let rejectStalled = (_e: unknown) => {};
        const stalled = fakeController(
            "$stall2",
            () => new Promise<void>((_r, rej) => (rejectStalled = rej)),
        );
        let releaseNext = () => {};
        const next = fakeController(
            "$next2",
            () => new Promise<void>((resolve) => (releaseNext = resolve)),
        );
        verificationState.incoming = [
            asController(stalled),
            asController(next),
        ];

        const outstanding = acceptIncoming(asController(stalled));
        declineIncoming(asController(stalled)); // the prune frees the gate
        const second = acceptIncoming(asController(next));
        expect(verificationState.accepting).toBe("$next2");

        rejectStalled(new Error("timed out"));
        await outstanding;

        // The stale settle must not clear a gate that is no longer its own —
        // that would re-enable Verify on a card whose accept is still running.
        expect(verificationState.accepting).toBe("$next2");
        expect(isAcceptingRequest(asController(next))).toBe(true);
        expect(acceptRequestError(asController(next))).toBeNull();
        releaseNext();
        await second;
        expect(verificationState.accepting).toBeNull();
    });

    // The twin of the stalled-accept tests above, which all REJECT the
    // outstanding promise. A stale accept that RESOLVES takes the success path,
    // and promoting from there unconditionally hands the modal to a request the
    // user has already walked away from — and silently orphans the one that is
    // actually live (no card, no modal, never cancelled), which is the very
    // shape of CRYPTO-03.
    it("does not promote a resolve that lands after its card was pruned", async () => {
        let resolveStale = () => {};
        const stale = fakeController(
            "$stale",
            () => new Promise<void>((resolve) => (resolveStale = resolve)),
        );
        const acceptNext = vi.fn(async () => {});
        const next = fakeController("$next3", acceptNext);
        verificationState.incoming = [asController(stale), asController(next)];

        const outstanding = acceptIncoming(asController(stale));
        expect(verificationState.accepting).toBe("$stale");

        // The card leaves the queue mid-accept. Its phase is deliberately still
        // non-terminal: cancel() only flips it once the SDK has processed the
        // cancellation, so "gone from the queue" is its own condition and cannot
        // be inferred from the phase.
        declineIncoming(asController(stale));

        // The user then verifies the request that is actually live.
        const ok = await acceptIncoming(asController(next));
        expect(ok).toBe(true);
        expect(verificationState.active?.id).toBe("$next3");

        resolveStale();
        const staleOk = await outstanding;

        expect(staleOk).toBe(false);
        // The abandoned flow must not take the modal…
        expect(verificationState.active?.id).toBe("$next3");
        // …and $next3 must still be the one thing the user can act on: it left
        // the queue on the way into the modal, so a clobbered `active` would
        // leave it live on the wire with nothing rendering it.
        expect(verificationState.incoming).toEqual([]);
        expect(verificationState.accepting).toBeNull();
        expect(verificationState.acceptErrors).toEqual({});
    });

    it("does not open the modal on a request that finished while accept() was in flight", async () => {
        let release = () => {};
        const c = fakeController(
            "$dead",
            () => new Promise<void>((resolve) => (release = resolve)),
        );
        verificationState.incoming = [asController(c)];

        const pending = acceptIncoming(asController(c));
        // The peer cancels. The live request object mutates in place, so the
        // phase is terminal the moment we look — whether our subscriber has been
        // handed the change event yet (and pruned the card) is not ours to time.
        c.phase = VerificationPhaseValue.Cancelled;
        release();
        const ok = await pending;

        expect(ok).toBe(false);
        // A modal on a cancelled flow is a dead end that claims a verification
        // is under way; the card can say "cancelled" and be pruned as usual.
        expect(verificationState.active).toBeNull();
        expect(verificationState.accepting).toBeNull();
    });

    it("refuses an accept for a request that is not in the queue", async () => {
        let calls = 0;
        const accept = vi.fn(async () => {
            calls++;
            // A second, real accept() for the promoted flow is exactly what the
            // SDK rejects — and "Try again" on a request that is FINE is a retry
            // that can never work.
            if (calls > 1) {
                throw new Error(
                    "Cannot accept a verification request in state 6",
                );
            }
        });
        const c = fakeController("$promoted", accept);
        verificationState.incoming = [asController(c)];

        await acceptIncoming(asController(c));
        expect(verificationState.active?.id).toBe("$promoted");

        // The in-timeline card still renders Verify/Decline for the active flow,
        // so a second click is reachable without anything being wrong.
        const again = await acceptIncoming(asController(c));

        expect(again).toBe(false);
        expect(accept).toHaveBeenCalledTimes(1);
        expect(acceptRequestError(asController(c))).toBeNull();
        expect(verificationState.accepting).toBeNull();
        expect(verificationState.active?.id).toBe("$promoted");
    });
});

describe("declineIncoming", () => {
    it("cancels, dequeues and forgets any recorded accept error", async () => {
        const c = fakeController("$req6", async () => {
            throw new Error("boom");
        });
        verificationState.incoming = [asController(c)];
        await acceptIncoming(asController(c));
        expect(acceptRequestError(asController(c))).toBe(FAIL_COPY);

        declineIncoming(asController(c));

        expect(c.cancel).toHaveBeenCalledTimes(1);
        expect(verificationState.incoming).toEqual([]);
        expect(verificationState.acceptErrors).toEqual({});
    });
});

describe("closeActive", () => {
    it("forgets an accept error recorded against the active flow", async () => {
        const c = fakeController("$req7", async () => {});
        verificationState.incoming = [asController(c)];
        await acceptIncoming(asController(c));
        expect(verificationState.active?.id).toBe("$req7");

        // Seeded directly: `acceptIncoming` now refuses a request that is not in
        // the queue, so the promoted flow can no longer acquire an error of its
        // own. The modal is still the surface `hasSurface` admits, so closing it
        // remains the only thing that could clear such an entry — and its card
        // left the queue on the way in.
        verificationState.acceptErrors = { $req7: FAIL_COPY };
        expect(acceptRequestError(asController(c))).toBe(FAIL_COPY);

        closeActive();

        expect(verificationState.acceptErrors).toEqual({});
    });
});

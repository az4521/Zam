import { beforeEach, describe, expect, it, vi } from "vitest";

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
    isAcceptingRequest,
    acceptRequestError,
} from "./verification.svelte";

type Fake = {
    id: string;
    accept: () => Promise<void>;
    cancel: () => void;
    view: () => { phase: number };
    subscribe: (cb: () => void) => () => void;
};

function fakeController(id: string, accept: () => Promise<void>): Fake {
    return {
        id,
        accept,
        cancel: vi.fn(),
        // Phase 1 ("Unsent") is non-terminal for verificationPhaseKind.
        view: () => ({ phase: 1 }),
        subscribe: () => () => {},
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asController = (c: Fake) => c as any;

beforeEach(() => {
    verificationState.incoming = [];
    verificationState.active = null;
    verificationState.accepting = null;
    verificationState.acceptErrors = {};
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
            throw new Error("Unknown transaction");
        });
        verificationState.incoming = [asController(c)];

        const ok = await acceptIncoming(asController(c));

        expect(ok).toBe(false);
        expect(verificationState.incoming.map((x) => x.id)).toEqual(["$req2"]);
        expect(verificationState.active).toBeNull();
        expect(acceptRequestError(asController(c))).toBe("Unknown transaction");
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
        // A double-click on the SAME card is not an error — it is already
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
        expect(acceptRequestError(asController(c))).toBe("boom");
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

    it("tells the user why a SECOND request's accept was refused", async () => {
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

    it("records no error when the request was pruned mid-accept", async () => {
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
        reject(new Error("Unknown transaction"));
        const ok = await pending;

        expect(ok).toBe(false);
        // No card and no modal can show this, and removeIncoming (the only
        // thing that clears the map) has already run — so an entry here would
        // leak forever.
        expect(verificationState.acceptErrors).toEqual({});
        expect(verificationState.accepting).toBeNull();
        expect(verificationState.active).toBeNull();
    });
});

describe("declineIncoming", () => {
    it("cancels, dequeues and forgets any recorded accept error", async () => {
        const c = fakeController("$req6", async () => {
            throw new Error("boom");
        });
        verificationState.incoming = [asController(c)];
        await acceptIncoming(asController(c));
        expect(acceptRequestError(asController(c))).toBe("boom");

        declineIncoming(asController(c));

        expect(c.cancel).toHaveBeenCalledTimes(1);
        expect(verificationState.incoming).toEqual([]);
        expect(verificationState.acceptErrors).toEqual({});
    });
});

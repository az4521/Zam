import { describe, it, expect } from "vitest";
import { createStaleGuard } from "./staleGuard";

/** A promise plus the handles to settle it later, so a test can interleave. */
function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe("createStaleGuard", () => {
    it("treats the newest token as current", () => {
        const guard = createStaleGuard();
        const first = guard.begin();
        expect(guard.isCurrent(first)).toBe(true);
    });

    it("supersedes an earlier token when a new one begins", () => {
        const guard = createStaleGuard();
        const first = guard.begin();
        const second = guard.begin();
        expect(guard.isCurrent(first)).toBe(false);
        expect(guard.isCurrent(second)).toBe(true);
    });

    it("cancel supersedes in-flight work without minting a token", () => {
        const guard = createStaleGuard();
        const first = guard.begin();
        guard.cancel();
        expect(guard.isCurrent(first)).toBe(false);
        const next = guard.begin();
        expect(guard.isCurrent(next)).toBe(true);
    });

    it("dispose is permanent, even for tokens minted afterwards", () => {
        const guard = createStaleGuard();
        const before = guard.begin();
        guard.dispose();
        expect(guard.disposed).toBe(true);
        expect(guard.isCurrent(before)).toBe(false);
        const after = guard.begin();
        expect(guard.isCurrent(after)).toBe(false);
    });

    it("keeps separate guards independent of one another", () => {
        // UserProfileCard runs two guards side by side on purpose — a
        // background trust reload and a moderation button press — so that
        // neither supersedes the other. Sharing generation state between
        // instances would silently break that pairing.
        const trust = createStaleGuard();
        const actions = createStaleGuard();

        const trustToken = trust.begin();
        actions.begin();
        expect(trust.isCurrent(trustToken)).toBe(true);

        actions.dispose();
        expect(trust.disposed).toBe(false);
        expect(trust.isCurrent(trustToken)).toBe(true);
    });

    it("run reports a successful result", async () => {
        const guard = createStaleGuard();
        const outcome = await guard.run(() => Promise.resolve("hits"));
        expect(outcome).toEqual({ status: "ok", value: "hits" });
    });

    it("run reports a rejection instead of throwing", async () => {
        const guard = createStaleGuard();
        const boom = new Error("network down");
        const outcome = await guard.run(() => Promise.reject(boom));
        expect(outcome).toEqual({ status: "error", error: boom });
    });

    it("run reports a synchronous throw instead of throwing", async () => {
        const guard = createStaleGuard();
        const boom = new Error("bad state");
        const outcome = await guard.run(() => {
            throw boom;
        });
        expect(outcome).toEqual({ status: "error", error: boom });
    });

    it("run reports stale when a newer run started first", async () => {
        const guard = createStaleGuard();
        const slow = deferred<string>();
        const outcomePromise = guard.run(() => slow.promise);
        guard.begin(); // a newer request supersedes it
        slow.resolve("room A hits");
        expect(await outcomePromise).toEqual({ status: "stale" });
    });

    it("run reports stale rather than error when a superseded run fails", async () => {
        const guard = createStaleGuard();
        const slow = deferred<string>();
        const outcomePromise = guard.run(() => slow.promise);
        guard.cancel();
        slow.reject(new Error("network down"));
        expect(await outcomePromise).toEqual({ status: "stale" });
    });

    it("run reports stale after dispose and never invokes the work", async () => {
        const guard = createStaleGuard();
        guard.dispose();
        let invoked = false;
        const outcome = await guard.run(() => {
            invoked = true;
            return Promise.resolve(1);
        });
        expect(outcome).toEqual({ status: "stale" });
        expect(invoked).toBe(false);
    });

    it("the newest run always clears the spinner, however the older ones settle", async () => {
        // Simulates the component contract: every run sets `loading = true` up
        // front, and only a non-stale outcome clears it. Whatever order the
        // responses come back in, the spinner must end up off.
        const guard = createStaleGuard();
        let loading = false;
        const pendings: Array<ReturnType<typeof deferred<number>>> = [];
        const runs: Array<Promise<void>> = [];

        for (let i = 0; i < 3; i++) {
            const slot = deferred<number>();
            pendings.push(slot);
            loading = true;
            runs.push(
                guard
                    .run(() => slot.promise)
                    .then((outcome) => {
                        if (outcome.status === "stale") return;
                        loading = false;
                    }),
            );
        }

        // Settle out of order, and make the survivor fail: newest first, then
        // the two stale ones, one of which rejects.
        pendings[2].reject(new Error("last one failed"));
        pendings[0].resolve(0);
        pendings[1].resolve(1);
        await Promise.all(runs);

        expect(loading).toBe(false);
    });
});

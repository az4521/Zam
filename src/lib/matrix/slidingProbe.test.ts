import { describe, expect, it } from "vitest";
import {
    probeOutcome,
    startSlidingProbe,
    takeSlidingProbe,
    type ProbeClient,
} from "./slidingProbe";

function fake(
    behaviour: () => Promise<unknown>,
): ProbeClient & { calls: unknown[][] } {
    const calls: unknown[][] = [];
    return {
        calls,
        getHomeserverUrl: () => "https://hs.example",
        slidingSync(...args: unknown[]) {
            calls.push(args);
            return behaviour() as never;
        },
    } as unknown as ProbeClient & { calls: unknown[][] };
}

describe("probeOutcome", () => {
    it("maps success to ok", () => {
        expect(probeOutcome({ ok: true })).toEqual({ kind: "ok" });
    });

    it("treats 404/405/501 and M_UNRECOGNIZED as unsupported", () => {
        const err = { httpStatus: 404 };
        expect(probeOutcome({ ok: false, err })).toEqual({
            kind: "unsupported",
            err,
        });
        const unrec = { errcode: "M_UNRECOGNIZED" };
        expect(probeOutcome({ ok: false, err: unrec }).kind).toBe(
            "unsupported",
        );
    });

    it("treats everything else as a transient failure", () => {
        const err = { httpStatus: 503 };
        expect(probeOutcome({ ok: false, err })).toEqual({
            kind: "failed",
            err,
        });
        expect(
            probeOutcome({ ok: false, err: new Error("offline") }).kind,
        ).toBe("failed");
    });
});

describe("startSlidingProbe / takeSlidingProbe", () => {
    it("sends the bare capability request once, to the homeserver", async () => {
        const c = fake(() => Promise.resolve({ pos: "1" }));
        const p = startSlidingProbe(c);
        expect(await p).toEqual({ kind: "ok" });
        expect(c.calls).toHaveLength(1);
        expect(c.calls[0]).toEqual([
            { lists: {}, timeout: 0, clientTimeout: 10000 },
            "https://hs.example",
        ]);
    });

    it("hands the probe out once per client", async () => {
        const c = fake(() => Promise.resolve({}));
        startSlidingProbe(c);
        expect(takeSlidingProbe(c)).toBeDefined();
        expect(takeSlidingProbe(c)).toBeUndefined();
    });

    it("never gives one client's probe to another", async () => {
        const a = fake(() => Promise.resolve({}));
        const b = fake(() => Promise.resolve({}));
        startSlidingProbe(a);
        expect(takeSlidingProbe(b)).toBeUndefined();
        expect(takeSlidingProbe(a)).toBeDefined();
    });

    it("keeps the same error decision and does not reject", async () => {
        const err = { httpStatus: 404 };
        const c = fake(() => Promise.reject(err));
        const p = startSlidingProbe(c);
        expect(await takeSlidingProbe(c)).toEqual({ kind: "unsupported", err });
        expect(await p).toEqual({ kind: "unsupported", err });
    });

    it("a synchronous throw becomes a failed outcome, not a rejection", async () => {
        const c = {
            getHomeserverUrl: () => "https://hs.example",
            slidingSync() {
                throw new Error("boom");
            },
        } as unknown as ProbeClient;
        const p = startSlidingProbe(c);
        expect((await p).kind).toBe("failed");
    });
});

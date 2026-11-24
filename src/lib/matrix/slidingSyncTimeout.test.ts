import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import {
    adaptSlidingSyncTimeout,
    resetSlidingSyncTimeout,
} from "./slidingSyncTimeout";

// A fake client.slidingSync whose requests take `durationMs` to answer and,
// like the SDK's fetch, fail once they outlive req.clientTimeout.
function fakeClient(durationMs: () => number) {
    const seen: number[] = [];
    const client = {
        slidingSync(req: { clientTimeout?: number }) {
            const limit = req.clientTimeout ?? Infinity;
            seen.push(limit);
            return new Promise((resolve, reject) => {
                const d = durationMs();
                if (d <= limit) setTimeout(() => resolve({ pos: "1" }), d);
                else
                    setTimeout(
                        () => reject(new Error("request timed out")),
                        limit,
                    );
            });
        },
    };
    return { client: client as unknown as MatrixClient, seen };
}

// An initial request (no pos) unless `pos` is given.
async function request(
    client: MatrixClient,
    clientTimeout = 40_000,
    pos?: string,
) {
    const p = client
        .slidingSync({ clientTimeout, pos } as never)
        .then(() => "ok" as const)
        .catch(() => "failed" as const);
    await vi.runAllTimersAsync();
    return p;
}

describe("adaptSlidingSyncTimeout", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("lets a slow initial response through after timeouts instead of looping forever", async () => {
        // Every response takes 100s to download over this link.
        const { client, seen } = fakeClient(() => 100_000);
        adaptSlidingSyncTimeout(client);
        expect(await request(client)).toBe("failed");
        expect(await request(client)).toBe("failed");
        expect(await request(client)).toBe("ok");
        expect(seen).toEqual([40_000, 80_000, 160_000]);
    });

    it("goes back to the SDK's timeout after a success", async () => {
        let duration = 60_000;
        const { client, seen } = fakeClient(() => duration);
        adaptSlidingSyncTimeout(client);
        await request(client); // times out at 40s
        await request(client); // 80s allowance, succeeds
        duration = 1_000;
        await request(client);
        expect(seen).toEqual([40_000, 80_000, 40_000]);
    });

    it("caps the allowance", async () => {
        const { client, seen } = fakeClient(() => Infinity);
        adaptSlidingSyncTimeout(client, { maxMs: 100_000 });
        for (let i = 0; i < 4; i++) await request(client);
        expect(seen).toEqual([40_000, 80_000, 100_000, 100_000]);
    });

    it("does not count HTTP errors or our own aborts as timeouts", async () => {
        const seen: number[] = [];
        const client = {
            slidingSync(req: { clientTimeout?: number }) {
                seen.push(req.clientTimeout ?? 0);
                return Promise.reject(
                    Object.assign(new Error("bad"), { httpStatus: 502 }),
                );
            },
        } as unknown as MatrixClient;
        adaptSlidingSyncTimeout(client);
        await request(client);
        await request(client);
        expect(seen).toEqual([40_000, 40_000]);
    });

    it("reset drops a raised allowance so the next request is back to the SDK's timeout", async () => {
        // Raised to 80s by a timeout on the old connection.
        const { client, seen } = fakeClient(() => 100_000);
        const allowance = adaptSlidingSyncTimeout(client);
        await request(client); // times out at 40s
        expect(allowance()).toBe(80_000);
        resetSlidingSyncTimeout(client);
        expect(allowance()).toBe(0);
        await request(client);
        expect(seen).toEqual([40_000, 40_000]);
    });

    it("reset is a no-op for a client that was never wrapped", () => {
        const client = {} as MatrixClient;
        expect(() => resetSlidingSyncTimeout(client)).not.toThrow();
    });

    it("wraps a client only once", async () => {
        const { client, seen } = fakeClient(() => 100_000);
        const first = adaptSlidingSyncTimeout(client);
        const second = adaptSlidingSyncTimeout(client);
        expect(second).toBe(first);
        await request(client);
        expect(seen).toEqual([40_000]);
        expect(first()).toBe(80_000);
    });

    it("retries a lost long-poll answer with the normal allowance", async () => {
        // The response to a request with a pos never arrives (the connection
        // was dropped). Waiting longer for the next one only delays messages.
        const { client, seen } = fakeClient(() => Infinity);
        const lost: number[] = [];
        const raised: number[] = [];
        const allowance = adaptSlidingSyncTimeout(client, {
            onLostResponse: (ms) => lost.push(ms),
            onTimeout: (ms) => raised.push(ms),
        });
        for (let i = 0; i < 3; i++) await request(client, 40_000, "p1");
        expect(seen).toEqual([40_000, 40_000, 40_000]);
        expect(allowance()).toBe(40_000);
        expect(lost).toEqual([40_000, 40_000, 40_000]);
        expect(raised).toEqual([]);
    });

    it("a long-poll ignores an allowance raised by an initial request", async () => {
        const { client, seen } = fakeClient(() => Infinity);
        adaptSlidingSyncTimeout(client);
        await request(client); // initial, times out: next initial gets 80s
        await request(client, 40_000, "p1");
        await request(client);
        expect(seen).toEqual([40_000, 40_000, 80_000]);
    });

    it("an abort ends the call even after the SDK stopped listening", async () => {
        // The SDK's fetch drops its abort listener once headers arrive, so a
        // body stalled on a dead socket never settles on its own.
        const stalled = new Promise(() => {});
        const client = {
            slidingSync: () => stalled,
        } as unknown as MatrixClient;
        adaptSlidingSyncTimeout(client);
        const controller = new AbortController();
        const p = client.slidingSync(
            { clientTimeout: 40_000, pos: "p1" } as never,
            undefined,
            controller.signal,
        );
        controller.abort();
        await expect(p).rejects.toMatchObject({ name: "AbortError" });
    });

    it("an abort does not count as a lost answer", async () => {
        const client = {
            slidingSync: () => new Promise(() => {}),
        } as unknown as MatrixClient;
        const lost: number[] = [];
        adaptSlidingSyncTimeout(client, {
            onLostResponse: (ms) => lost.push(ms),
        });
        const controller = new AbortController();
        const p = client
            .slidingSync(
                { clientTimeout: 40_000, pos: "p1" } as never,
                undefined,
                controller.signal,
            )
            .catch(() => "aborted");
        await vi.advanceTimersByTimeAsync(45_000);
        controller.abort();
        expect(await p).toBe("aborted");
        expect(lost).toEqual([]);
    });

    it("passes results through untouched when given a signal", async () => {
        const client = {
            slidingSync: () => Promise.resolve({ pos: "2" }),
        } as unknown as MatrixClient;
        adaptSlidingSyncTimeout(client);
        const res = await client.slidingSync(
            { clientTimeout: 40_000, pos: "1" } as never,
            undefined,
            new AbortController().signal,
        );
        expect(res).toEqual({ pos: "2" });
    });
});

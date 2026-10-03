import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import { adaptSlidingSyncTimeout } from "./slidingSyncTimeout";

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

async function request(client: MatrixClient, clientTimeout = 40_000) {
    const p = client
        .slidingSync({ clientTimeout } as never)
        .then(() => "ok" as const)
        .catch(() => "failed" as const);
    await vi.runAllTimersAsync();
    return p;
}

describe("adaptSlidingSyncTimeout", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("lets a slow response through after timeouts instead of looping forever", async () => {
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

    it("wraps a client only once", async () => {
        const { client, seen } = fakeClient(() => 100_000);
        const first = adaptSlidingSyncTimeout(client);
        const second = adaptSlidingSyncTimeout(client);
        expect(second).toBe(first);
        await request(client);
        expect(seen).toEqual([40_000]);
        expect(first()).toBe(80_000);
    });
});

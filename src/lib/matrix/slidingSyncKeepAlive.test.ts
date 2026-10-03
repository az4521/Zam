import { describe, expect, it } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import {
    SlidingSync,
    SlidingSyncEvent,
    type MSC3575List,
} from "matrix-js-sdk/lib/sliding-sync";
import { keepSlidingSyncAlive } from "./slidingSyncKeepAlive";

// A fake server for the real SlidingSync loop: each request records its body
// and gets the next canned response; once they run out, requests hang until
// aborted (like a long-poll).
function fakeServer(responses: object[]) {
    const requests: { pos?: string; room_subscriptions?: object }[] = [];
    const client = {
        slidingSync: (
            body: { pos?: string; room_subscriptions?: object },
            _proxy: string,
            signal: AbortSignal,
        ) => {
            requests.push(body);
            const next = responses.shift();
            if (next) return Promise.resolve(structuredClone(next));
            return new Promise((_, reject) =>
                signal.addEventListener("abort", () =>
                    reject(
                        Object.assign(new Error("aborted"), {
                            name: "AbortError",
                        }),
                    ),
                ),
            );
        },
    } as unknown as MatrixClient;
    return { client, requests };
}

const list: MSC3575List = { ranges: [[0, 10]], timeline_limit: 1 };
const roomResponse = (pos: string) => ({
    pos,
    lists: { all: { count: 1 } },
    rooms: { "!a:x": { timeline: [], required_state: [], initial: true } },
});

function makeSliding(client: MatrixClient): SlidingSync {
    return new SlidingSync(
        "https://hs.example",
        new Map([["all", list]]),
        { timeline_limit: 30 },
        client,
        30_000,
    );
}

async function until(cond: () => boolean): Promise<void> {
    for (let i = 0; i < 200 && !cond(); i++)
        await new Promise((r) => setTimeout(r, 5));
    expect(cond()).toBe(true);
}

describe("keepSlidingSyncAlive", () => {
    it("the SDK loop dies for good when a listener throws (the bug)", async () => {
        const { client } = fakeServer([roomResponse("1")]);
        const sliding = makeSliding(client);
        sliding.on(SlidingSyncEvent.RoomData, () => {
            throw new Error("listener boom");
        });
        await expect(sliding.start()).rejects.toThrow("listener boom");
    });

    it("restarts a crashed loop on a fresh connection", async () => {
        const { client, requests } = fakeServer([
            roomResponse("1"),
            roomResponse("7"),
            roomResponse("8"),
        ]);
        const sliding = makeSliding(client);
        sliding.modifyRoomSubscriptions(new Set(["!a:x"]));
        let throwOnce = true;
        sliding.on(SlidingSyncEvent.RoomData, () => {
            if (throwOnce) {
                throwOnce = false;
                throw new Error("listener boom");
            }
        });
        const crashes: unknown[] = [];
        keepSlidingSyncAlive(sliding, (err) => crashes.push(err), {
            initialBackoffMs: 5,
        });

        const done = sliding.start();
        // Crash on the first response, restart, then keep going normally
        // (third request carries the pos from the restarted connection).
        await until(() => requests.length >= 4);
        expect(crashes).toHaveLength(1);
        expect(requests[0].pos).toBeUndefined();
        // The restart starts over without a pos and re-sends the room
        // subscription, which resetup() un-confirmed.
        expect(requests[1].pos).toBeUndefined();
        expect(requests[1].room_subscriptions).toHaveProperty("!a:x");
        expect(requests[2].pos).toBe("7");
        expect(requests[3].pos).toBe("8");

        sliding.stop();
        await expect(done).resolves.toBeUndefined();
    });

    it("does not restart after stop()", async () => {
        const { client, requests } = fakeServer([roomResponse("1")]);
        const sliding = makeSliding(client);
        sliding.on(SlidingSyncEvent.RoomData, () => {
            sliding.stop();
            throw new Error("boom during shutdown");
        });
        const crashes: unknown[] = [];
        keepSlidingSyncAlive(sliding, (err) => crashes.push(err), {
            initialBackoffMs: 5,
        });
        await expect(sliding.start()).resolves.toBeUndefined();
        expect(crashes).toHaveLength(0);
        expect(requests).toHaveLength(1);
    });
});

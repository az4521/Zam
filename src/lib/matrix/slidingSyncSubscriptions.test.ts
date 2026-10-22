import { describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import {
    resendRoomSubscriptions,
    withAllRoomSubscriptions,
} from "./slidingSyncSubscriptions";

const sub = { timeline_limit: 30 };

describe("withAllRoomSubscriptions", () => {
    it("repeats desired subscriptions the SDK no longer sends", () => {
        expect(withAllRoomSubscriptions({}, ["!a", "!b"], sub)).toEqual({
            room_subscriptions: { "!a": sub, "!b": sub },
        });
    });

    it("keeps a subscription the request already carries", () => {
        const own = { timeline_limit: 5 };
        expect(
            withAllRoomSubscriptions(
                { room_subscriptions: { "!a": own } },
                ["!a"],
                sub,
            ).room_subscriptions,
        ).toEqual({ "!a": own });
    });

    it("never re-subscribes a room being unsubscribed", () => {
        expect(
            withAllRoomSubscriptions(
                { unsubscribe_rooms: ["!a"] } as {
                    unsubscribe_rooms: string[];
                    room_subscriptions?: Record<
                        string,
                        Record<string, unknown>
                    >;
                },
                ["!a"],
                sub,
            ).room_subscriptions,
        ).toBeUndefined();
    });

    it("adds nothing when nothing is desired", () => {
        expect(withAllRoomSubscriptions({}, [], sub)).toEqual({});
    });
});

describe("resendRoomSubscriptions", () => {
    it("wraps a client once and reads the desired set per request", async () => {
        const inner = vi.fn(async (req: unknown) => req);
        const client = { slidingSync: inner } as unknown as MatrixClient;
        let desired = ["!a"];
        resendRoomSubscriptions(client, () => desired, sub);
        resendRoomSubscriptions(client, () => ["!x"], sub);

        await client.slidingSync({} as never);
        desired = ["!b"];
        await client.slidingSync({} as never);

        expect(inner.mock.calls.map((c) => c[0])).toEqual([
            { room_subscriptions: { "!a": sub } },
            { room_subscriptions: { "!b": sub } },
        ]);
    });
});

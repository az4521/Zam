import { describe, expect, it, vi } from "vitest";
import { MatrixEvent } from "matrix-js-sdk";
import { fetchServerNotificationsForClient } from "./notifications";

function mockClient(
    result: unknown,
    rejection = false,
    decryptEventIfNeeded = vi.fn().mockResolvedValue(undefined),
) {
    return {
        http: {
            authedRequest: rejection
                ? vi.fn().mockRejectedValue(result)
                : vi.fn().mockResolvedValue(result),
        },
        getEventMapper: () => (event: object) => new MatrixEvent(event),
        decryptEventIfNeeded,
    } as any;
}

describe("fetchServerNotificationsForClient", () => {
    it("only classifies unsupported endpoints as unsupported", async () => {
        await expect(
            fetchServerNotificationsForClient(
                mockClient({ errcode: "M_UNRECOGNIZED" }, true),
            ),
        ).resolves.toEqual({ status: "unsupported" });

        const result = await fetchServerNotificationsForClient(
            mockClient(new Error("offline"), true),
        );
        expect(result.status).toBe("error");
    });

    it("maps a supported response", async () => {
        const result = await fetchServerNotificationsForClient(
            mockClient({
                notifications: [
                    {
                        actions: ["notify"],
                        event: { event_id: "$event" },
                        read: false,
                        room_id: "!room",
                        ts: 42,
                    },
                ],
                next_token: "next",
            }),
        );
        expect(result.status).toBe("ok");
        if (result.status === "ok") {
            expect(result.notifications[0].room_id).toBe("!room");
            expect(result.nextToken).toBe("next");
        }
    });

    it("gives events their room, without which they cannot decrypt", async () => {
        const result = await fetchServerNotificationsForClient(
            mockClient({
                notifications: [
                    {
                        event: { event_id: "$event", type: "m.room.encrypted" },
                        room_id: "!room",
                    },
                ],
            }),
        );
        expect(result.status).toBe("ok");
        if (result.status === "ok") {
            expect(result.notifications[0].event.getRoomId()).toBe("!room");
        }
    });

    it("waits for decryption, since nothing redraws the inbox after it", async () => {
        const decrypted: Array<string | undefined> = [];
        const client = mockClient(
            {
                notifications: [
                    {
                        event: { event_id: "$event", type: "m.room.encrypted" },
                        room_id: "!room",
                    },
                ],
            },
            false,
            vi.fn(async (event: MatrixEvent) => {
                await Promise.resolve();
                decrypted.push(event.getId());
            }),
        );
        await fetchServerNotificationsForClient(client);
        expect(decrypted).toEqual(["$event"]);
    });

    it("decrypts a bundled edit too, since it supplies the content", async () => {
        const replacement = new MatrixEvent({ event_id: "$edit" });
        const mapped = new MatrixEvent({ event_id: "$event" });
        mapped.makeReplaced(replacement);
        const decrypt = vi.fn().mockResolvedValue(undefined);
        const client = mockClient(
            { notifications: [{ event: {}, room_id: "!room" }] },
            false,
            decrypt,
        );
        client.getEventMapper = () => () => mapped;
        await fetchServerNotificationsForClient(client);
        expect(decrypt).toHaveBeenCalledWith(mapped);
        expect(decrypt).toHaveBeenCalledWith(replacement);
    });

    it("still returns events that fail to decrypt", async () => {
        const result = await fetchServerNotificationsForClient(
            mockClient(
                {
                    notifications: [
                        { event: { event_id: "$event" }, room_id: "!room" },
                    ],
                },
                false,
                vi.fn().mockRejectedValue(new Error("no key")),
            ),
        );
        expect(result.status).toBe("ok");
    });
});

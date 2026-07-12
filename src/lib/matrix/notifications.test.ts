import { describe, expect, it, vi } from "vitest";
import { fetchServerNotificationsForClient } from "./notifications";

function mockClient(result: unknown, rejection = false) {
    return {
        http: {
            authedRequest: rejection
                ? vi.fn().mockRejectedValue(result)
                : vi.fn().mockResolvedValue(result),
        },
        getEventMapper: () => (event: unknown) => event,
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
});

import { describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import { sendPresenceWithSlidingSync } from "./slidingSyncPresence";

const SLIDING = { prefix: "/_matrix/client/unstable/simplified_msc3575" };

function fakeClient() {
    const authedRequest = vi.fn(async (..._args: unknown[]) => ({}));
    const client = { http: { authedRequest } } as unknown as MatrixClient;
    return {
        client,
        authedRequest,
        http: client.http as never as {
            authedRequest: (...args: unknown[]) => Promise<unknown>;
        },
    };
}

describe("sendPresenceWithSlidingSync", () => {
    it("adds set_presence to sliding-sync polls once a state is chosen", async () => {
        const { client, authedRequest, http } = fakeClient();
        const set = sendPresenceWithSlidingSync(client);
        await http.authedRequest("POST", "/sync", { timeout: 1 }, {}, SLIDING);
        expect(authedRequest.mock.calls[0][2]).toEqual({ timeout: 1 });
        set("unavailable");
        await http.authedRequest("POST", "/sync", { timeout: 1 }, {}, SLIDING);
        expect(authedRequest.mock.calls[1][2]).toEqual({
            timeout: 1,
            set_presence: "unavailable",
        });
    });

    it("leaves classic /sync and other requests alone", async () => {
        const { client, authedRequest, http } = fakeClient();
        sendPresenceWithSlidingSync(client)("offline");
        await http.authedRequest("GET", "/sync", { timeout: 1 }, undefined, {});
        await http.authedRequest(
            "PUT",
            "/presence/x/status",
            undefined,
            {},
            SLIDING,
        );
        expect(authedRequest.mock.calls[0][2]).toEqual({ timeout: 1 });
        expect(authedRequest.mock.calls[1][2]).toBeUndefined();
    });

    it("wraps a client once", () => {
        const { client } = fakeClient();
        expect(sendPresenceWithSlidingSync(client)).toBe(
            sendPresenceWithSlidingSync(client),
        );
    });
});

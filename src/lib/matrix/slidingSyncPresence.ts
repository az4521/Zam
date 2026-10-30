import type { MatrixClient } from "matrix-js-sdk";
import type { PresenceState } from "$lib/utils/presence";

/**
 * Make sliding-sync requests carry our chosen presence.
 *
 * MSC4186 takes `set_presence` as a query parameter and a homeserver that
 * honours it (tuwunel does, defaulting to "online") marks the user with that
 * state on every poll. The SDK never sends it for sliding sync
 * (SlidingSyncSdk.setPresence is a TODO), so every poll put us back to
 * online right after a PUT /presence chose away or invisible.
 *
 * Wraps the client's HTTP layer once and returns the setter for the state to
 * send; null leaves the parameter off, as the SDK does.
 */
export function sendPresenceWithSlidingSync(
    client: MatrixClient,
): (presence: PresenceState | null) => void {
    const existing = installed.get(client);
    if (existing) return existing;
    let current: PresenceState | null = null;

    type Http = {
        authedRequest: (
            method: unknown,
            path: string,
            queryParams?: Record<string, unknown>,
            ...rest: unknown[]
        ) => unknown;
    };
    const http = client.http as unknown as Http;
    const send = http.authedRequest.bind(http);
    http.authedRequest = (method, path, queryParams, ...rest) => {
        if (current && path === "/sync" && isSlidingRequest(rest[1])) {
            queryParams = { ...queryParams, set_presence: current };
        }
        return send(method, path, queryParams, ...rest);
    };

    const set = (presence: PresenceState | null) => {
        current = presence;
    };
    installed.set(client, set);
    return set;
}

// authedRequest(method, path, queryParams, body, opts): opts.prefix tells a
// sliding-sync poll from a classic /sync.
function isSlidingRequest(opts: unknown): boolean {
    const prefix = (opts as { prefix?: string } | undefined)?.prefix;
    return typeof prefix === "string" && prefix.includes("msc3575");
}

const installed = new WeakMap<
    MatrixClient,
    (presence: PresenceState | null) => void
>();

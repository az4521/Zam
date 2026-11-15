import type { MatrixClient } from "matrix-js-sdk";

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
 * send (a raw wire value, so a server's busy spelling passes through); null
 * leaves the parameter off, as the SDK does.
 */
export function sendPresenceWithSlidingSync(
    client: MatrixClient,
): (presence: string | null) => void {
    const existing = installed.get(client);
    if (existing) return existing;
    let current: string | null = null;

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
        if (current && path === "/sync" && isSlidingRequest(method, rest[1])) {
            queryParams = { ...queryParams, set_presence: current };
        }
        return send(method, path, queryParams, ...rest);
    };

    const set = (presence: string | null) => {
        current = presence;
    };
    installed.set(client, set);
    return set;
}

// authedRequest(method, path, queryParams, body, opts). Sliding sync (MSC4186)
// is a POST /sync; classic sync is GET /sync. The method is the stable signal;
// the prefix (unstable msc3575 or msc4186 path) still counts so older SDK
// paths keep matching.
function isSlidingRequest(method: unknown, opts: unknown): boolean {
    if (String(method).toUpperCase() === "POST") return true;
    const prefix = (opts as { prefix?: string } | undefined)?.prefix;
    return (
        typeof prefix === "string" &&
        (prefix.includes("msc3575") || prefix.includes("msc4186"))
    );
}

const installed = new WeakMap<
    MatrixClient,
    (presence: string | null) => void
>();

// Pure classifier for the Matrix homeserver auto-discovery step
// (GET /.well-known/matrix/client), per the client-server spec's
// well-known algorithm:
//
//   - 404                       → IGNORE: use the address the user typed,
//                                 silently (there is simply no delegation).
//   - any other non-2xx status,
//     a request that never landed
//     (status === null), invalid
//     JSON, or a 2xx body missing
//     m.homeserver.base_url      → PROMPT (FAIL_PROMPT): still use the typed
//                                 address, but inform the user that
//                                 auto-discovery failed.
//   - 2xx with a usable base_url → OK: that URL must then be validated
//                                 against /_matrix/client/versions before we
//                                 trust the redirect target.
//
// Kept pure (no fetch, no toasts) so the branching is unit-testable; the
// caller in client.ts wires it to fetch + the toast surface.

export type WellKnownOutcome =
    | { action: "ignore" }
    | { action: "prompt" }
    | { action: "ok"; baseUrl: string };

/**
 * Decide how to treat a well-known response.
 *
 * @param status  HTTP status of the well-known request, or `null` if the
 *                request itself failed (network / connection error).
 * @param json    Parsed JSON body, or `undefined` if the body was absent or
 *                did not parse (invalid JSON).
 */
export function classifyWellKnown(
    status: number | null,
    json: unknown,
): WellKnownOutcome {
    if (status === 404) return { action: "ignore" };
    if (status === null || status < 200 || status >= 300) {
        return { action: "prompt" };
    }
    // 2xx: a usable m.homeserver.base_url is required, else FAIL_PROMPT.
    const homeserver =
        typeof json === "object" && json !== null
            ? (json as Record<string, unknown>)["m.homeserver"]
            : undefined;
    const baseUrl =
        typeof homeserver === "object" && homeserver !== null
            ? (homeserver as Record<string, unknown>)["base_url"]
            : undefined;
    if (typeof baseUrl === "string" && baseUrl.length > 0) {
        return { action: "ok", baseUrl: baseUrl.replace(/\/$/, "") };
    }
    return { action: "prompt" };
}

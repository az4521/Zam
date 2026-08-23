/**
 * Pure verification of the push-gateway a homeserver actually registered for
 * our pushers.
 *
 * The client asks the homeserver to route pushes to a specific Sygnal gateway
 * (`data.url`), but a hostile or misconfigured homeserver can register a
 * pusher pointing somewhere else and forward push metadata (event id, room id,
 * sender) to a gateway of its choosing. After registering, the client re-reads
 * its pushers and compares the reported `data.url` against the one it asked
 * for; a byte difference is the signal. (An honest server that lies about the
 * stored value is out of scope — this catches accidental reroutes and honest
 * rewrites, per the audit's SEC-L4.)
 *
 * SDK-free so it can be unit-tested; callers flatten the SDK pusher list to
 * `{ app_id, url }` first.
 */

/** A pusher reduced to the two fields this check needs. */
export interface PusherLike {
    app_id: string;
    /** The gateway URL the homeserver will POST to (`data.url`). */
    url?: string | null;
}

export type PusherGatewayVerdict = "none" | "verified" | "mismatch";

export interface PusherGatewayStatus {
    /** `none` = we registered no pushers; `verified` = all ours match; `mismatch` = at least one differs. */
    status: PusherGatewayVerdict;
    /** How many of the account's pushers are ours (match one of `appIds`). */
    ours: number;
    /** The gateway URL we asked for (echoed for display). */
    expectedUrl: string;
    /** Distinct actual `data.url` values of our pushers that do NOT match, for display. */
    mismatchedUrls: string[];
}

/** Shown for one of our pushers whose `data.url` is missing entirely. */
const MISSING_URL_LABEL = "(no gateway URL)";

/**
 * Compare the homeserver's registered pushers against the gateway URL we asked
 * for. Only pushers whose `app_id` is one of `appIds` (ours) are considered;
 * every other app's pushers are ignored.
 */
export function checkPusherGateway(
    expectedUrl: string,
    appIds: string[],
    pushers: PusherLike[],
): PusherGatewayStatus {
    const ourApps = new Set(appIds);
    const ours = pushers.filter((p) => ourApps.has(p.app_id));

    const mismatchedUrls: string[] = [];
    for (const p of ours) {
        const url = p.url ?? "";
        if (url !== expectedUrl) {
            const label = url === "" ? MISSING_URL_LABEL : url;
            if (!mismatchedUrls.includes(label)) mismatchedUrls.push(label);
        }
    }

    let status: PusherGatewayVerdict;
    if (ours.length === 0) status = "none";
    else if (mismatchedUrls.length === 0) status = "verified";
    else status = "mismatch";

    return { status, ours: ours.length, expectedUrl, mismatchedUrls };
}

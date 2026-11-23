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

/** A pusher reduced to the fields this check needs. */
import { t } from "$lib/i18n";
import { PUSH_TAG_FIELD } from "$lib/utils/pushTag";

export interface PusherLike {
    app_id: string;
    /** The gateway URL the homeserver will POST to (`data.url`). */
    url?: string | null;
    /**
     * `data.format`. The format decides whether the gateway receives the
     * event content or only its id, so it is checked like the URL.
     */
    format?: string | null;
    /** `data.default_payload`, which the gateway copies into every push. */
    default_payload?: unknown;
}

/** The only format we register: the gateway gets the event id, never the content. */
export const REQUIRED_PUSHER_FORMAT = "event_id_only";

/** The account tag a pusher carries in `default_payload`, or null. */
function payloadTag(p: PusherLike): string | null {
    const dp = p.default_payload;
    if (dp && typeof dp === "object") {
        const tag = (dp as Record<string, unknown>)[PUSH_TAG_FIELD];
        if (typeof tag === "string") return tag;
    }
    return null;
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
const MISSING_URL_LABEL = t("pusherVerification.noGatewayUrl");

/**
 * Compare the homeserver's registered pushers against what we registered: the
 * gateway URL we asked for, the `event_id_only` format, and (when given) our
 * account tag in `default_payload`. Only pushers whose `app_id` is one of
 * `appIds` (ours) are considered; every other app's pushers are ignored.
 *
 * A pusher is a mismatch unless all of its checked fields match. Matching the
 * URL alone is not enough: a homeserver that keeps the URL but drops the
 * format still gets the gateway the full event.
 */
export function checkPusherGateway(
    expectedUrl: string,
    appIds: string[],
    pushers: PusherLike[],
    expectedTag: string | null = null,
): PusherGatewayStatus {
    const ourApps = new Set(appIds);
    const ours = pushers.filter((p) => ourApps.has(p.app_id));

    const mismatchedUrls: string[] = [];
    for (const p of ours) {
        const url = p.url ?? "";
        const urlOk = url === expectedUrl;
        const formatOk = p.format === REQUIRED_PUSHER_FORMAT;
        const tagOk = expectedTag === null || payloadTag(p) === expectedTag;
        if (urlOk && formatOk && tagOk) continue;
        // The URL label stays as before; the extra markers are technical, not prose.
        let label = url === "" ? MISSING_URL_LABEL : url;
        if (!formatOk) label += ` [format: ${p.format ?? "none"}]`;
        if (!tagOk) label += " [tag mismatch]";
        if (!mismatchedUrls.includes(label)) mismatchedUrls.push(label);
    }

    let status: PusherGatewayVerdict;
    if (ours.length === 0) status = "none";
    else if (mismatchedUrls.length === 0) status = "verified";
    else status = "mismatch";

    return { status, ours: ours.length, expectedUrl, mismatchedUrls };
}

/**
 * Combine verdicts for pushers checked against different gateways (Sygnal
 * for FCM/webpush, a UnifiedPush device's own gateway). Any mismatch wins;
 * `expectedUrl` is the first status's.
 */
export function mergeGatewayStatus(
    a: PusherGatewayStatus,
    b: PusherGatewayStatus,
): PusherGatewayStatus {
    const mismatchedUrls = [...a.mismatchedUrls];
    for (const u of b.mismatchedUrls)
        if (!mismatchedUrls.includes(u)) mismatchedUrls.push(u);
    const ours = a.ours + b.ours;
    let status: PusherGatewayVerdict;
    if (ours === 0) status = "none";
    else if (mismatchedUrls.length === 0) status = "verified";
    else status = "mismatch";
    return { status, ours, expectedUrl: a.expectedUrl, mismatchedUrls };
}

/**
 * Pure classification of homeserver usage-limit signals (see
 * stores/usageLimits.svelte.ts for the state and the banner it drives).
 *
 * Signals a homeserver (Synapse, matrix.org) gives a client:
 *
 * - `M_RESOURCE_LIMIT_EXCEEDED` (HTTP 403, Synapse check_auth_blocking): the
 *   server as a whole is over a limit, so this account is blocked. Carries
 *   `admin_contact` and `limit_type` (`monthly_active_user` per the spec;
 *   Synapse also sends `hs_disabled`).
 * - `M_USER_LIMIT_EXCEEDED` (HTTP 403, MSC4326): this user is over a personal
 *   quota. Synapse returns it from media upload when `media_upload_limits`
 *   (matrix.org's plan quota: uploads, thumbnails and URL previews per day /
 *   28 days) is used up, with `info_uri` and `can_upgrade` (only when true).
 *   Nothing is stored, so other users never see a trace of it.
 * - `M_LIMIT_EXCEEDED` (HTTP 429): rate limited; `retry_after_ms` and/or a
 *   `Retry-After` header. Short-lived, so it is shown only for media
 *   transfers, where the SDK does not retry for us.
 * - `M_TOO_LARGE` (HTTP 413): one upload above `m.upload.size` (Synapse
 *   leaves this to the HTTP layer; other servers return the errcode).
 * - Server notices: an `m.room.message` with `msgtype: m.server_notice` and
 *   `server_notice_type: m.server_notice.usage_limit_reached` (plus
 *   `admin_contact`, `limit_type`) in the room tagged `m.server_notice`.
 *   Synapse pins it while the limit applies and unpins it once lifted.
 */

export type UsageLimitKind =
    /** M_RESOURCE_LIMIT_EXCEEDED (server-wide block), or M_USER_LIMIT_EXCEEDED
     *  on anything but a media upload. */
    | "resource"
    /** M_USER_LIMIT_EXCEEDED on a media upload (upload quota). */
    | "mediaQuota"
    /** M_LIMIT_EXCEEDED (rate limited). */
    | "rateLimited"
    /** M_TOO_LARGE on a media upload. */
    | "tooLarge";

export interface UsageLimitSignal {
    kind: UsageLimitKind;
    /** `limit_type` from the error or notice, when given. */
    limitType?: string;
    /** `admin_contact` (usually a mailto: or https: URI), when given. */
    adminContact?: string;
    /** How long the server asked us to wait, in ms, for a rate limit. */
    retryAfterMs?: number;
    /** The server's own human-readable `error` text, when given. */
    message?: string;
    /** `info_uri` (MSC4326): a page explaining the limit. */
    infoUri?: string;
    /** `can_upgrade` (MSC4326): the limit can be raised, e.g. by a paid plan. */
    canUpgrade?: boolean;
}

/** The known `limit_type` values (others are passed through verbatim). */
export const LIMIT_TYPE_MAU = "monthly_active_user";
export const LIMIT_TYPE_HS_DISABLED = "hs_disabled";

export const SERVER_NOTICE_TAG = "m.server_notice";
export const SERVER_NOTICE_MSGTYPE = "m.server_notice";
export const USAGE_LIMIT_NOTICE_TYPE = "m.server_notice.usage_limit_reached";

function str(v: unknown): string | undefined {
    return typeof v === "string" && v ? v : undefined;
}

/** Whether a request URL is a media upload (v1 or legacy v3 / r0). */
export function isMediaUploadUrl(url: string): boolean {
    return /\/_matrix\/media\/(?:v3|r0|v1)\/upload(?:\/|\?|$)/.test(url);
}

/** Whether a request URL is a media download or thumbnail. */
export function isMediaDownloadUrl(url: string): boolean {
    return /\/_matrix\/(?:client\/v1|media\/(?:v3|r0|v1))\/(?:media\/)?(?:download|thumbnail)\//.test(
        url,
    );
}

/** Seconds (or an HTTP date) from a Retry-After header, as ms. */
export function parseRetryAfter(
    header: string | null | undefined,
    now: number = Date.now(),
): number | undefined {
    if (!header) return undefined;
    const secs = Number(header);
    if (Number.isFinite(secs) && secs >= 0) return secs * 1000;
    const at = Date.parse(header);
    if (Number.isFinite(at)) return Math.max(0, at - now);
    return undefined;
}

/**
 * Classify one failed HTTP response. `body` is the parsed JSON error body
 * (or anything: non-objects classify as null). `url` decides whether a
 * resource limit is an upload quota. Returns null for anything that is not
 * a usage-limit signal.
 */
export function classifyLimitResponse(
    status: number,
    body: unknown,
    url: string,
    retryAfterHeader?: string | null,
): UsageLimitSignal | null {
    if (typeof body !== "object" || body === null) return null;
    const b = body as Record<string, unknown>;
    const errcode = str(b.errcode);
    const message = str(b.error);
    const upload = isMediaUploadUrl(url);
    if (errcode === "M_RESOURCE_LIMIT_EXCEEDED") {
        return {
            kind: "resource",
            limitType: str(b.limit_type),
            adminContact: str(b.admin_contact),
            message,
        };
    }
    if (errcode === "M_USER_LIMIT_EXCEEDED") {
        return {
            kind: upload ? "mediaQuota" : "resource",
            infoUri: str(b.info_uri),
            canUpgrade: b.can_upgrade === true || undefined,
            message,
        };
    }
    if (errcode === "M_LIMIT_EXCEEDED" || (!errcode && status === 429)) {
        const fromBody =
            typeof b.retry_after_ms === "number" && b.retry_after_ms >= 0
                ? b.retry_after_ms
                : undefined;
        return {
            kind: "rateLimited",
            retryAfterMs: parseRetryAfter(retryAfterHeader) ?? fromBody,
            message,
        };
    }
    if (upload && (errcode === "M_TOO_LARGE" || status === 413)) {
        return { kind: "tooLarge", message };
    }
    return null;
}

/** Classify a thrown SDK error (a MatrixError: errcode, httpStatus, data). */
export function classifyLimitError(
    err: unknown,
    url = "",
): UsageLimitSignal | null {
    if (typeof err !== "object" || err === null) return null;
    const e = err as {
        errcode?: unknown;
        httpStatus?: unknown;
        data?: unknown;
        url?: unknown;
    };
    const data =
        typeof e.data === "object" && e.data !== null
            ? (e.data as Record<string, unknown>)
            : {};
    const body = { ...data };
    if (body.errcode === undefined && typeof e.errcode === "string")
        body.errcode = e.errcode;
    const status = typeof e.httpStatus === "number" ? e.httpStatus : 0;
    return classifyLimitResponse(
        status,
        body,
        url || (typeof e.url === "string" ? e.url : ""),
    );
}

/** The usage-limit details in a server-notice message, or null if the
 *  content is not a usage-limit notice. */
export function usageLimitNotice(content: unknown): UsageLimitSignal | null {
    if (typeof content !== "object" || content === null) return null;
    const c = content as Record<string, unknown>;
    if (c.msgtype !== SERVER_NOTICE_MSGTYPE) return null;
    if (c.server_notice_type !== USAGE_LIMIT_NOTICE_TYPE) return null;
    return {
        kind: "resource",
        limitType: str(c.limit_type),
        adminContact: str(c.admin_contact),
        message: str(c.body),
    };
}

/**
 * A safe link for `admin_contact`: only mailto: and https: URIs (a bare
 * address becomes mailto:). Anything else (javascript:, data:, ...) is
 * dropped, since the value comes from the server.
 */
export function adminContactHref(
    contact: string | undefined,
): string | undefined {
    if (!contact) return undefined;
    const trimmed = contact.trim();
    if (/^[^\s@:/]+@[^\s@:/]+\.[^\s@:/]+$/.test(trimmed))
        return `mailto:${trimmed}`;
    try {
        const u = new URL(trimmed);
        if (u.protocol === "mailto:" || u.protocol === "https:") return u.href;
    } catch {
        // Not a URL.
    }
    return undefined;
}

/** Statuses a usage-limit error can come back with (400 for servers that
 *  pick it for a quota). Anything else is not
 *  read, so the common path costs nothing. */
const LIMIT_STATUSES = new Set([400, 403, 413, 429]);

function requestUrl(input: RequestInfo | URL): string {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.href;
    return (input as Request).url ?? "";
}

/**
 * Wrap a fetch so every usage-limit error response is reported (the response
 * itself is returned untouched; the body is read from a clone). `onOk` hears
 * about successful responses, so a limit can clear itself once a request of
 * the same kind goes through again.
 */
export function limitWatchingFetch(
    inner: typeof fetch,
    report: (signal: UsageLimitSignal, url: string) => void,
    onOk?: (url: string, method: string) => void,
): typeof fetch {
    return async (input, init) => {
        const res = await inner(input, init);
        const url = requestUrl(input);
        try {
            if (res.ok) {
                const method = (
                    init?.method ??
                    (typeof input === "object" && "method" in input
                        ? (input as Request).method
                        : "GET")
                ).toUpperCase();
                onOk?.(url, method);
            } else if (LIMIT_STATUSES.has(res.status)) {
                const type = res.headers.get("content-type") ?? "";
                if (type.includes("json")) {
                    const body: unknown = await res
                        .clone()
                        .json()
                        .catch(() => null);
                    const signal = classifyLimitResponse(
                        res.status,
                        body,
                        url,
                        res.headers.get("retry-after"),
                    );
                    if (signal) report(signal, url);
                }
            }
        } catch {
            // Reporting must never break the request.
        }
        return res;
    };
}

/** The i18n key for the banner text describing `s`. */
export function usageLimitMessageKey(
    s: UsageLimitSignal,
):
    | "usageLimits.bannerMau"
    | "usageLimits.bannerDisabled"
    | "usageLimits.bannerResource"
    | "usageLimits.bannerMediaQuota" {
    if (s.kind === "mediaQuota") return "usageLimits.bannerMediaQuota";
    if (s.limitType === LIMIT_TYPE_MAU) return "usageLimits.bannerMau";
    if (s.limitType === LIMIT_TYPE_HS_DISABLED)
        return "usageLimits.bannerDisabled";
    return "usageLimits.bannerResource";
}

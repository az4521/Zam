/**
 * Whether the signed-in account has run into a homeserver usage limit, for
 * UsageLimitBanner (persistent) and a one-off toast. Fed from two places:
 *
 * - every SDK request, through limitWatchingFetch (client.ts): an
 *   M_RESOURCE_LIMIT_EXCEEDED on sync/send/join/upload, M_LIMIT_EXCEEDED on a
 *   media transfer;
 * - the server-notice room (m.server_notice tag): Synapse pins an
 *   m.server_notice.usage_limit_reached message while the limit applies and
 *   unpins it once lifted (watchServerNotices in client.ts).
 *
 * An error-derived limit clears itself once a request of the same kind goes
 * through again (a send or sync for a resource limit, an upload for the upload
 * quota). Everything is per client: resetUsageLimits runs on account switch.
 */
import { t } from "$lib/i18n";
import { showToast } from "$lib/stores/toasts.svelte";
import {
    isMediaDownloadUrl,
    isMediaUploadUrl,
    type UsageLimitSignal,
} from "$lib/utils/usageLimits";

class UsageLimitsState {
    /** A resource limit an error reported (sync, send, join, ...). */
    resource = $state<UsageLimitSignal | null>(null);
    /** The media upload quota is used up. */
    mediaQuota = $state<UsageLimitSignal | null>(null);
    /** A pinned usage-limit server notice. */
    notice = $state<UsageLimitSignal | null>(null);
    /** The user closed the banner; it comes back if the signal changes. */
    dismissedKey = $state<string | null>(null);
}

export const usageLimitsState = new UsageLimitsState();

/** Throttle for the rate-limit toast. */
const RATE_TOAST_MS = 30_000;
let lastRateToast = 0;

/** Whether a 2xx on this request shows a resource limit no longer applies. */
function clearsResource(url: string, method: string): boolean {
    if (method === "PUT" && /\/rooms\/[^/]+\/send\//.test(url)) return true;
    return /\/_matrix\/client\/[^/]+\/sync(?:\?|$)/.test(url) ||
        /\/org\.matrix\.simplified_msc3575\/sync(?:\?|$)/.test(url)
        ? true
        : false;
}

/** Record a signal from a failed request (see limitWatchingFetch). */
export function reportUsageLimit(signal: UsageLimitSignal, url: string): void {
    switch (signal.kind) {
        case "resource":
            if (!usageLimitsState.resource)
                showToast(t("usageLimits.toastResource"), { tone: "danger" });
            usageLimitsState.resource = signal;
            break;
        case "mediaQuota":
            if (!usageLimitsState.mediaQuota)
                showToast(t("usageLimits.toastMediaQuota"), { tone: "danger" });
            usageLimitsState.mediaQuota = signal;
            break;
        case "rateLimited": {
            // Sends and syncs back off and retry by themselves; only media
            // transfers fail outright, so only they are worth telling about.
            if (!isMediaUploadUrl(url) && !isMediaDownloadUrl(url)) return;
            const now = Date.now();
            if (now - lastRateToast < RATE_TOAST_MS) return;
            lastRateToast = now;
            const secs = signal.retryAfterMs
                ? Math.max(1, Math.ceil(signal.retryAfterMs / 1000))
                : null;
            showToast(
                secs
                    ? t("usageLimits.toastRateLimitedFor", { seconds: secs })
                    : t("usageLimits.toastRateLimited"),
                { tone: "danger" },
            );
            break;
        }
        case "tooLarge":
            // The upload flow already says the file is too large.
            break;
    }
}

/** A request went through: lift error-derived limits of the same kind. */
export function noteUsageOk(url: string, method: string): void {
    if (usageLimitsState.resource && clearsResource(url, method))
        usageLimitsState.resource = null;
    if (
        usageLimitsState.mediaQuota &&
        method === "POST" &&
        isMediaUploadUrl(url)
    )
        usageLimitsState.mediaQuota = null;
}

/** The pinned server notice, or null when none is pinned. */
export function setUsageLimitNotice(signal: UsageLimitSignal | null): void {
    const prev = usageLimitsState.notice;
    if (
        prev?.limitType === signal?.limitType &&
        prev?.adminContact === signal?.adminContact &&
        prev?.message === signal?.message &&
        !!prev === !!signal
    )
        return;
    usageLimitsState.notice = signal;
}

/** What the banner shows: the most serious active signal. */
export function activeUsageLimit(): UsageLimitSignal | null {
    return (
        usageLimitsState.resource ??
        usageLimitsState.notice ??
        usageLimitsState.mediaQuota
    );
}

/** A key for "this banner", so a dismissal sticks until it changes. */
export function usageLimitKey(s: UsageLimitSignal | null): string | null {
    return s ? `${s.kind}|${s.limitType ?? ""}|${s.message ?? ""}` : null;
}

export function dismissUsageLimitBanner(): void {
    usageLimitsState.dismissedKey = usageLimitKey(activeUsageLimit());
}

/** Forget everything (new client / account switch / logout). */
export function resetUsageLimits(): void {
    usageLimitsState.resource = null;
    usageLimitsState.mediaQuota = null;
    usageLimitsState.notice = null;
    usageLimitsState.dismissedKey = null;
    lastRateToast = 0;
}

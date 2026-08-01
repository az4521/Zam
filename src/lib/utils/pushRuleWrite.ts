// Pure decisions for a push-rule write. Extracted so the honesty rules — never
// report a change the server did not take (NOTIF-01), never create a rule after
// a transport failure, never mutate the cached rules on a failed write — are
// unit-testable independently of the SDK.

import type { PushRuleLevel } from "$lib/matrix/pushRules";

/**
 * Why a push-rule write failed, at the granularity the caller can act on.
 *
 * - `rule-missing`  the server has no such rule (404 / M_NOT_FOUND). A custom
 *   rule can be created outright; a server-default (dotted) one cannot.
 * - `rule-rejected` the server understood the request and refused it (400, or an
 *   errcode naming the body). Repeating the same update is futile.
 * - `transport`     everything else: offline, 5xx, 429, 401/403, or an error
 *   shape we do not recognise. The write MAY have landed, so nothing about
 *   server state may be assumed from it.
 */
export type PushRuleWriteFailure =
    | "rule-missing"
    | "rule-rejected"
    | "transport";

const REJECTED_ERRCODES = new Set([
    "M_BAD_JSON",
    "M_NOT_JSON",
    "M_INVALID_PARAM",
    "M_UNRECOGNIZED",
]);

function errcodeOf(error: unknown): string | undefined {
    if (!error || typeof error !== "object") return undefined;
    const direct = (error as { errcode?: unknown }).errcode;
    if (typeof direct === "string") return direct;
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object") {
        const nested = (data as { errcode?: unknown }).errcode;
        if (typeof nested === "string") return nested;
    }
    return undefined;
}

function httpStatusOf(error: unknown): number | undefined {
    if (!error || typeof error !== "object") return undefined;
    const status = (error as { httpStatus?: unknown }).httpStatus;
    return typeof status === "number" ? status : undefined;
}

export function classifyPushRuleWriteError(
    error: unknown,
): PushRuleWriteFailure {
    const errcode = errcodeOf(error);
    const status = httpStatusOf(error);
    if (status === 404 || errcode === "M_NOT_FOUND") return "rule-missing";
    if (errcode && REJECTED_ERRCODES.has(errcode)) return "rule-rejected";
    if (status === 400) return "rule-rejected";
    return "transport";
}

/**
 * May the caller CREATE the rule after a failed update? Only when the id is one
 * we are allowed to create (a custom, non-dotted rule) AND the failure tells us
 * something about the rule rather than about the network — on a transport
 * failure the update may actually have landed, and creating on top of it would
 * write a second, unintended rule.
 */
export function shouldAttemptRuleCreate(
    failure: PushRuleWriteFailure,
    canCreate: boolean,
): boolean {
    return canCreate && failure !== "transport";
}

export type PushRuleVerdict =
    | { status: "applied" }
    | { status: "unverified" }
    | { status: "mismatch"; observed: PushRuleLevel };

/**
 * Compare what was asked for against the level the canonical rules report after
 * the write. `observed: null` means the canonical rules could not be re-read —
 * unknown, which is NOT the same as success.
 */
export function verifyPushRuleLevel(input: {
    requested: PushRuleLevel;
    observed: PushRuleLevel | null;
}): PushRuleVerdict {
    if (input.observed === null) return { status: "unverified" };
    if (input.observed === input.requested) return { status: "applied" };
    return { status: "mismatch", observed: input.observed };
}

/**
 * What may be done to the SDK's cached rules after a write attempt.
 *
 * - `canonical`  the cache already holds freshly-fetched server truth.
 * - `optimistic` the write succeeded but the re-read did not; mirror the change
 *   locally so the UI is not stuck on a value we know is stale.
 * - `none`       the write did NOT succeed. Never mutate — a local mutation here
 *   is exactly the "muted in the UI, still notifying on the server" failure.
 */
export type PushRuleCachePlan = "canonical" | "optimistic" | "none";

export function planPushRuleCacheUpdate(input: {
    wrote: boolean;
    refreshed: boolean;
}): PushRuleCachePlan {
    if (!input.wrote) return "none";
    return input.refreshed ? "canonical" : "optimistic";
}

/** User-facing copy for a push-rule change that did not stick. */
export function pushRuleFailureMessage(
    label: string,
    reason: PushRuleWriteFailure | "mismatch",
): string {
    switch (reason) {
        case "rule-missing":
            return `Your homeserver has no "${label}" notification rule, so it could not be changed.`;
        case "rule-rejected":
            return `Your homeserver rejected the change to "${label}" notifications.`;
        case "mismatch":
            return `"${label}" notifications did not change on your homeserver.`;
        default:
            return `Could not save "${label}" notifications. Check your connection and try again.`;
    }
}

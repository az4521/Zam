/**
 * Who a file offer's sender answers. A request starts a transfer of the whole
 * file and hands over a key, so it needs more behind it than a known file id.
 */

export type RefusalReason =
    | "unknown-offer"
    | "expired"
    | "blocked"
    | "not-joined"
    | "device-not-allowed"
    | "busy";

export function requestRefusal(request: {
    known: boolean;
    expired: boolean;
    requesterBlocked: boolean;
    requesterJoined: boolean;
    deviceAllowed: boolean;
    receivers: number;
    maxReceivers: number;
}): RefusalReason | null {
    if (!request.known) return "unknown-offer";
    if (request.expired) return "expired";
    if (request.requesterBlocked) return "blocked";
    if (!request.requesterJoined) return "not-joined";
    if (!request.deviceAllowed) return "device-not-allowed";
    if (request.receivers >= request.maxReceivers) return "busy";
    return null;
}

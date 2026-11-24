/**
 * Whether a native call event names an account other than this window's.
 * Native tracks rings and calls per account and room, so a Decline or a
 * hang-up for another account signed in on the device (in a room both are
 * in) must not end this account's ring or call. An event naming no account
 * (an older native build) is this window's, as before.
 */
export function isForOtherAccount(
    eventUserId: string | null | undefined,
    ownUserId: string | null | undefined,
): boolean {
    return !!eventUserId && !!ownUserId && eventUserId !== ownUserId;
}

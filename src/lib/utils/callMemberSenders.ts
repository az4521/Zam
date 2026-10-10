/** A call membership event (state or sticky), as the member check sees it. */
export interface CallMemberEventView {
    sender: string | undefined;
    /** False for an emptied membership, which is how a device leaves. */
    active: boolean;
}

/**
 * Senders of active call memberships that have no known joined membership in
 * the room. MatrixRTC ignores a call membership whose sender isn't a known
 * joined member, so each of these is someone in the call that the client
 * can't show until their m.room.member is loaded.
 */
export function callMemberSendersMissingMembership(
    events: CallMemberEventView[],
    isJoined: (userId: string) => boolean,
): string[] {
    const missing = new Set<string>();
    for (const { sender, active } of events) {
        if (active && sender && !isJoined(sender)) missing.add(sender);
    }
    return [...missing];
}

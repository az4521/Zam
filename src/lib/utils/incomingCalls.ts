/**
 * Pure decisions for DM call ringing: which membership-snapshot changes mean
 * "ring", "blip", or "stay quiet". The store does the I/O, owns the ringtone
 * handle, and decides `busy`; every decision lives here.
 *
 * Ring eligibility is a TRANSITION, not a timestamp: we ring when an identity
 * appears that was not in the previous snapshot. Gating on the membership's
 * own createdTs would compare a server clock against the client's, and the
 * skew between them is unbounded.
 */

/** Room id → membership identities ("userId:deviceId") currently in its call. */
export type CallSnapshot = Map<string, string[]>;

export interface IncomingDiff {
    /** Incoming-calling rooms, oldest first. */
    ringing: string[];
    /** Room whose arrival should start the ringtone, or null. */
    startRing: string | null;
    /** A new caller arrived that must not ring aloud (busy, or a ring is
     *  already sounding for someone else). */
    blip: boolean;
    /** Next decline-suppression set. */
    declined: Set<string>;
}

export interface IncomingDiffOptions {
    /** JOINED DM rooms only. An invited-but-unjoined DM must never ring. */
    dmRoomIds: Set<string>;
    ownUserId: string;
    declined: Set<string>;
    prevRinging: string[];
    /** Already in a call, or a ringtone is still sounding. */
    busy: boolean;
}

export function diffIncomingCalls(
    prev: CallSnapshot | null,
    next: CallSnapshot,
    opts: IncomingDiffOptions,
): IncomingDiff {
    const isOwn = (id: string) => id.startsWith(opts.ownUserId + ":");
    const peers = (ids: string[] | undefined) =>
        (ids ?? []).filter((id) => !isOwn(id));
    const selfIn = (ids: string[] | undefined) => (ids ?? []).some(isOwn);

    // A decline lasts exactly as long as the call it declined.
    const declined = new Set<string>();
    for (const roomId of opts.declined)
        if (peers(next.get(roomId)).length > 0) declined.add(roomId);

    const isIncoming = (roomId: string) =>
        opts.dmRoomIds.has(roomId) &&
        peers(next.get(roomId)).length > 0 &&
        !selfIn(next.get(roomId)) &&
        !declined.has(roomId);

    const incoming = [...next.keys()].filter(isIncoming);
    const incomingSet = new Set(incoming);
    // Keep established cards where they are; append arrivals.
    const ringing = [
        ...opts.prevRinging.filter((roomId) => incomingSet.has(roomId)),
        ...incoming.filter((roomId) => !opts.prevRinging.includes(roomId)),
    ];

    // prev === null is the boot seed: a caller already waiting must not sound.
    const newlyRinging =
        prev === null
            ? []
            : ringing.filter((roomId) => {
                  if (opts.prevRinging.includes(roomId)) return false;
                  const before = new Set(peers(prev.get(roomId)));
                  return peers(next.get(roomId)).some((id) => !before.has(id));
              });

    // At most one ringtone ever sounds. A second arrival — whether because a
    // call is live or because someone else already owns the ringer — is the
    // same situation, and gets the same discreet blip.
    const startRing =
        !opts.busy && newlyRinging.length > 0 ? newlyRinging[0] : null;
    const blip = newlyRinging.length > (startRing === null ? 0 : 1);

    return { ringing, startRing, blip, declined };
}

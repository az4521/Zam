/**
 * Pure decision logic for the per-participant status indicators on call tiles.
 * SDK/store wiring lives in CallView; this module carries only plain data and
 * stays unit-testable. See src/lib/utils/voiceCall.ts for the same pattern.
 */

/** Distinct devices per user in the PRE-dedupe membership list (a user on 2
 *  distinct devices → 2). A repeated (user, device) counts once. Used to
 *  badge multi-device participants that dedupeParticipants hides. */
export function deviceCountByUser(
    memberships: { userId: string; deviceId: string }[],
): Map<string, number> {
    const devices = new Map<string, Set<string>>();
    for (const m of memberships) {
        let set = devices.get(m.userId);
        if (!set) devices.set(m.userId, (set = new Set()));
        set.add(m.deviceId);
    }
    const counts = new Map<string, number>();
    for (const [userId, set] of devices) counts.set(userId, set.size);
    return counts;
}

export interface CallTileStatusInput {
    /** This tile is the local user's own tile. */
    isOwn: boolean;
    /** The peer has self-muted their mic (from voiceCallState.mutedUserIds). */
    remoteMuted: boolean;
    /** The user is currently speaking (from voiceCallState.speakingUserIds). */
    speaking: boolean;
    /** I have locally silenced this peer (participantAudioFor(id).muted). */
    locallyMuted: boolean;
    /** My own mic is muted (voiceCallState.micMuted). */
    selfMicMuted: boolean;
    /** I am deafened (voiceCallState.deafened). */
    selfDeafened: boolean;
    /** How many devices this user is joined from. */
    deviceCount: number;
}

export interface CallTileStatus {
    /** Render a muted-mic icon. */
    micOff: boolean;
    /** Render a deafened icon. */
    deafened: boolean;
    /** Render a "you muted them locally" icon. */
    locallyMuted: boolean;
    /** Render a multi-device badge. */
    multiDevice: boolean;
}

/** Which status icons a single call tile should show. */
export function callTileStatus(input: CallTileStatusInput): CallTileStatus {
    return {
        micOff: input.isOwn
            ? input.selfMicMuted
            : input.remoteMuted && !input.speaking,
        deafened: input.isOwn && input.selfDeafened,
        locallyMuted: !input.isOwn && input.locallyMuted,
        multiDevice: input.deviceCount > 1,
    };
}

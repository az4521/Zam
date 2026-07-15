import {
    onVoiceSessionsChanged,
    getDirectRooms,
    getRoomCallMemberships,
    getActiveVoiceRoomId,
} from "$lib/matrix/client";
import { diffIncomingCalls, type CallSnapshot } from "$lib/utils/incomingCalls";
import {
    startRingtone,
    playRingBlip,
    configureRing,
    RING_MAX_MS,
    type RingHandle,
} from "$lib/audio/soundEffects";
import { settingsState } from "$lib/stores/settings.svelte";
import { auth } from "$lib/stores/auth.svelte";

// Incoming DM calls, derived from MatrixRTC membership — no MSC4075, no
// server support needed. In a DM, "they joined and I haven't" IS the ring.
// Rooms never ring: they are join-on-demand.
class IncomingCallsState {
    /** Rooms to show an incoming-call card for, oldest first. */
    ringing = $state<string[]>([]);
    /** Locally declined rooms. A decline lasts as long as the call it
     *  declined; the diff clears it once the caller leaves. */
    declined = $state<Set<string>>(new Set());
}

export const incomingCallsState = new IncomingCallsState();

/** Subscribe the store to call-membership changes. Call once from the app
 *  shell; returns an unsub. */
export function initIncomingCalls(): () => void {
    configureRing({
        enabled: settingsState.ringEnabled,
        volume: settingsState.ringVolume,
    });

    let prev: CallSnapshot | null = null;
    let ringHandle: RingHandle | null = null;
    let ringOwner: string | null = null;
    let ringStartedAt: number | null = null;

    // Date.now(), not a timer: setTimeout is throttled to ~1/min in a hidden
    // renderer (the tray case), which would strand this flag on forever.
    const ringSounding = () =>
        ringStartedAt !== null && Date.now() - ringStartedAt < RING_MAX_MS;

    const stopRing = () => {
        ringHandle?.stop();
        ringHandle = null;
        ringOwner = null;
        ringStartedAt = null;
    };

    const sweep = () => {
        const dmRoomIds = new Set<string>();
        const next: CallSnapshot = new Map();
        for (const room of getDirectRooms()) {
            // An invited-but-unjoined DM must never ring.
            if (room.getMyMembership() !== "join") continue;
            dmRoomIds.add(room.roomId);
            next.set(
                room.roomId,
                getRoomCallMemberships(room).map(
                    (m) => `${m.userId}:${m.deviceId}`,
                ),
            );
        }

        const result = diffIncomingCalls(prev, next, {
            dmRoomIds,
            ownUserId: auth.userId ?? "",
            declined: incomingCallsState.declined,
            prevRinging: incomingCallsState.ringing,
            busy: getActiveVoiceRoomId() !== null || ringSounding(),
        });
        prev = next;

        incomingCallsState.declined = result.declined;
        incomingCallsState.ringing = result.ringing;

        // The caller gave up, or we answered — silence the ringer early.
        if (ringOwner && !result.ringing.includes(ringOwner)) stopRing();
        if (result.startRing) {
            // Unconditional, even though `busy` should already have
            // suppressed this: RING_MAX_MS bounds the AUDIO clock, so a
            // suspended context can leave a ring audible after ringSounding()
            // says it finished. Stopping first guarantees at most one
            // ringtone no matter how the two clocks drift.
            stopRing();
            ringOwner = result.startRing;
            ringStartedAt = Date.now();
            ringHandle = startRingtone();
        }
        if (result.blip) playRingBlip();
    };

    // Seed silently: prev === null, so a caller already waiting when we boot
    // gets a card but no ringtone.
    sweep();
    const unsub = onVoiceSessionsChanged(sweep);
    return () => {
        unsub();
        stopRing();
    };
}

/** Decline locally: silence this call and hide its card. Nothing is sent —
 *  the caller cannot tell a decline from a no-answer (that needs MSC4310). */
export function declineIncomingCall(roomId: string): void {
    const declined = new Set(incomingCallsState.declined);
    declined.add(roomId);
    // Reassign rather than mutate: $state tracks the reference.
    incomingCallsState.declined = declined;
    incomingCallsState.ringing = incomingCallsState.ringing.filter(
        (id) => id !== roomId,
    );
}

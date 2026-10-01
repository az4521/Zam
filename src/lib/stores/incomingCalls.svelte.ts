import {
    onVoiceSessionsChanged,
    getDirectRooms,
    getRoomCallMemberships,
    getActiveVoiceRoomId,
    isInitialSyncComplete,
    onSyncPrepared,
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
import {
    dismissNativeIncomingCall,
    silenceNativeIncomingCall,
    releaseNativeLockScreen,
    reportNativeIncomingCall,
    hasNativeCallService,
    onNativeCallEvent,
} from "$lib/nativeCall";

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

// The ring state is MODULE-scope, not a local of initIncomingCalls(). Do not
// "tidy" it back into the closure: declineIncomingCall/silenceIncomingCall are
// module-level exports and must be able to silence a ring that a sweep inside
// initIncomingCalls() started. A decline sends nothing over the wire, so no
// membership changes and no sweep ever fires — a closure-local stopRing() would
// leave the ringtone playing for its full RING_MAX_MS after the card is gone.
let ringHandle: RingHandle | null = null;
let ringOwner: string | null = null;
let ringStartedAt: number | null = null;

// Date.now(), not a timer: setTimeout is throttled to ~1/min in a hidden
// renderer (the tray case), which would strand this flag on forever.
const ringSounding = () =>
    ringStartedAt !== null && Date.now() - ringStartedAt < RING_MAX_MS;

function stopRing(): void {
    ringHandle?.stop();
    ringHandle = null;
    ringOwner = null;
    // Clearing ringStartedAt is what un-strands `busy`: leave it set and
    // ringSounding() stays true for the rest of RING_MAX_MS, which downgrades a
    // genuinely new caller to a blip. Permanently — they land in prevRinging,
    // and the ring-once latch means they never ring aloud on a later sweep.
    ringStartedAt = null;
}

/** Android: the ring for `roomId` is over — end the system's ringing call and
 *  its notification. Once nothing rings and no call is starting, also stop
 *  showing over the lock screen (a full-screen incoming call put us there). */
function releaseNativeRing(roomId: string, declined: boolean): void {
    dismissNativeIncomingCall(roomId, declined);
    if (
        incomingCallsState.ringing.length === 0 &&
        getActiveVoiceRoomId() === null
    )
        releaseNativeLockScreen();
}

/** Subscribe the store to call-membership changes. Call once from the app
 *  shell; returns an unsub. */
export function initIncomingCalls(): () => void {
    configureRing({
        enabled: settingsState.ringEnabled,
        volume: settingsState.ringVolume,
    });

    let prev: CallSnapshot | null = null;

    const sweep = () => {
        const dmRoomIds = new Set<string>();
        const roomNames = new Map<string, string>();
        const next: CallSnapshot = new Map();
        for (const room of getDirectRooms()) {
            // An invited-but-unjoined DM must never ring.
            if (room.getMyMembership() !== "join") continue;
            dmRoomIds.add(room.roomId);
            roomNames.set(room.roomId, room.name ?? "");
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

        const prevRinging = incomingCallsState.ringing;
        incomingCallsState.declined = result.declined;
        incomingCallsState.ringing = result.ringing;
        // Answered, declined or given up on: the native ring goes too.
        for (const roomId of prevRinging)
            if (!result.ringing.includes(roomId))
                releaseNativeRing(roomId, false);

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
            const hidden = document.visibilityState !== "visible";
            if (hidden && hasNativeCallService()) {
                // Android, app in the background or screen off: a ringtone in
                // a hidden WebView is a sound with no card to answer. Ring the
                // OS way instead (a no-op when push already did).
                if (settingsState.ringEnabled)
                    reportNativeIncomingCall(
                        result.startRing,
                        roomNames.get(result.startRing) ?? "",
                        auth.userId ?? "",
                    );
            } else {
                ringHandle = startRingtone();
                // Visible in-app card + ringtone: the native notification
                // would only ring a second time over it. The system call keeps
                // ringing, so a headset can still pick it up.
                if (!hidden) silenceNativeIncomingCall(result.startRing);
            }
        }
        if (result.blip) playRingBlip();
    };

    // Both the seed sweep and the subscription must wait for the initial sync:
    // AppShell mounts as soon as the route's startSync resolves, which is a
    // couple of round trips in — well before the first /sync response — so
    // getRooms() would iterate zero rooms here, and onVoiceSessionsChanged
    // watches the calls already in progress by iterating getRooms() at
    // subscribe time: an empty list means a call that was already running
    // never notifies at all.
    // Declined from the Android notification or the system (headset, car):
    // hide the card and stop the in-app ringer as if declined here.
    const unsubNativeDecline = onNativeCallEvent("decline", ({ roomId }) =>
        declineIncomingCall(roomId),
    );

    let unsubSessions: (() => void) | null = null;
    const start = () => {
        if (unsubSessions) return; // idempotent: PREPARED can re-fire
        // The seed sweep (prev === null) rings for a call already waiting when
        // we arrive — that is the "catch up on entry" case (see diffIncomingCalls).
        // It runs at most once per mount (guarded above), so it cannot re-ring on
        // a reconnect: reconnects re-fire onVoiceSessionsChanged with a non-null
        // prev, which rings only on a genuine new arrival.
        sweep();
        unsubSessions = onVoiceSessionsChanged(sweep);
    };
    if (isInitialSyncComplete()) start();
    const unsubPrepared = onSyncPrepared(start);
    return () => {
        unsubPrepared();
        unsubNativeDecline();
        unsubSessions?.();
        stopRing();
    };
}

/** Stop the ringtone for a room without declining it. The app shell calls this
 *  on Accept: joining probes the mic (a first-ever call shows a permission
 *  prompt), publishes membership, and waits for the echo before a sweep would
 *  notice — the ring must not sound through all of that. */
export function silenceIncomingCall(roomId: string): void {
    if (ringOwner === roomId) stopRing();
    // Only the notification: the system's ringing call is answered (not
    // ended) when the join starts the native call for this room, and
    // answering from the lock screen must stay over it meanwhile.
    silenceNativeIncomingCall(roomId);
}

/** Decline locally: silence this call and hide its card. Nothing is sent —
 *  the caller cannot tell a decline from a no-answer (that needs MSC4310). */
export function declineIncomingCall(roomId: string): void {
    // Nothing is sent, so no membership changes and no sweep will ever fire:
    // this is the only chance to stop the ringtone.
    if (ringOwner === roomId) stopRing();
    const declined = new Set(incomingCallsState.declined);
    declined.add(roomId);
    // Reassign rather than mutate: $state tracks the reference.
    incomingCallsState.declined = declined;
    incomingCallsState.ringing = incomingCallsState.ringing.filter(
        (id) => id !== roomId,
    );
    releaseNativeRing(roomId, true);
}

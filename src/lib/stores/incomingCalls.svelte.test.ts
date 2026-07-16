import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the SDK boundary and the sound engine so we can drive the store into a
// ringing state and spy on the ringtone handle. diffIncomingCalls (the pure
// decision) stays real — this exercises the store's wiring around it.
const h = vi.hoisted(() => ({
    getDirectRooms: vi.fn<
        () => { roomId: string; getMyMembership: () => string }[]
    >(() => []),
    getRoomCallMemberships: vi.fn<() => { userId: string; deviceId: string }[]>(
        () => [],
    ),
    getActiveVoiceRoomId: vi.fn<() => string | null>(() => null),
    isInitialSyncComplete: vi.fn(() => true),
    onVoiceSessionsChanged: vi.fn((_cb: () => void) => () => {}),
    onSyncPrepared: vi.fn((_cb: () => void) => () => {}),
    startRingtone: vi.fn(() => ({ stop: vi.fn() })),
    playRingBlip: vi.fn(),
    configureRing: vi.fn(),
}));

vi.mock("$lib/matrix/client", () => ({
    getDirectRooms: h.getDirectRooms,
    getRoomCallMemberships: h.getRoomCallMemberships,
    getActiveVoiceRoomId: h.getActiveVoiceRoomId,
    isInitialSyncComplete: h.isInitialSyncComplete,
    onVoiceSessionsChanged: h.onVoiceSessionsChanged,
    onSyncPrepared: h.onSyncPrepared,
}));

vi.mock("$lib/audio/soundEffects", () => ({
    startRingtone: h.startRingtone,
    playRingBlip: h.playRingBlip,
    configureRing: h.configureRing,
    RING_MAX_MS: 10000,
}));

vi.mock("$lib/stores/settings.svelte", () => ({
    settingsState: { ringEnabled: true, ringVolume: 1 },
}));

vi.mock("$lib/stores/auth.svelte", () => ({
    auth: { userId: "@me:server" },
}));

import {
    initIncomingCalls,
    declineIncomingCall,
    silenceIncomingCall,
    incomingCallsState,
} from "./incomingCalls.svelte";

const DM = "!dm:server";
const dmRoom = { roomId: DM, getMyMembership: () => "join" };

/** The sweep callback the store registers via onVoiceSessionsChanged; calling
 *  it re-runs a membership sweep the way a live session change would. */
let sweep: () => void;
let unsub: () => void;

beforeEach(() => {
    vi.clearAllMocks();
    h.getDirectRooms.mockReturnValue([dmRoom]);
    h.getRoomCallMemberships.mockReturnValue([]); // seed: nobody in the call yet
    h.getActiveVoiceRoomId.mockReturnValue(null);
    h.isInitialSyncComplete.mockReturnValue(true);
    h.onVoiceSessionsChanged.mockImplementation((cb: () => void) => {
        sweep = cb;
        return () => {};
    });
    h.startRingtone.mockImplementation(() => ({ stop: vi.fn() }));
    incomingCallsState.ringing = [];
    incomingCallsState.declined = new Set();
});

afterEach(() => {
    unsub?.();
});

/** Boot the store (silent seed sweep) then make a peer arrive in the DM so the
 *  ringtone starts. Returns the spy on the started ring's stop(). */
function startRingingCall(): ReturnType<typeof vi.fn> {
    const ringStop = vi.fn();
    h.startRingtone.mockReturnValueOnce({ stop: ringStop });
    unsub = initIncomingCalls(); // seed sweep: prev===null, no ring
    // A peer (not me) joins the DM's call — an arrival, so it rings.
    h.getRoomCallMemberships.mockReturnValue([
        { userId: "@them:server", deviceId: "DEV1" },
    ]);
    sweep();
    return ringStop;
}

describe("incoming-calls store: ring lifecycle", () => {
    it("starts ringing when a peer arrives in a DM call", () => {
        const ringStop = startRingingCall();
        expect(incomingCallsState.ringing).toContain(DM);
        expect(h.startRingtone).toHaveBeenCalledTimes(1);
        expect(ringStop).not.toHaveBeenCalled();
    });

    it("stops the ring when the call is declined", () => {
        const ringStop = startRingingCall();

        declineIncomingCall(DM);

        // The decline sends nothing over the wire, so no sweep will ever fire —
        // this is the only place the ringtone can be stopped.
        expect(ringStop).toHaveBeenCalledTimes(1);
        expect(incomingCallsState.ringing).not.toContain(DM);
        expect(incomingCallsState.declined.has(DM)).toBe(true);
    });

    it("stops the ring when the call is accepted (silenced)", () => {
        const ringStop = startRingingCall();

        silenceIncomingCall(DM);

        expect(ringStop).toHaveBeenCalledTimes(1);
    });

    it("does not stop the ring when a different room is declined", () => {
        const ringStop = startRingingCall();

        declineIncomingCall("!other:server");

        expect(ringStop).not.toHaveBeenCalled();
        expect(incomingCallsState.ringing).toContain(DM);
    });
});

/**
 * Pure decision logic for MatrixRTC voice calls: participant display,
 * Discord-style mute/deafen semantics, and LiveKit transport selection.
 * SDK/media wiring lives in $lib/matrix/client; this module stays testable.
 */

export interface VoiceParticipant {
    userId: string;
    deviceId: string;
    joinedTs: number;
}

/** One entry per user (earliest joined device wins), ordered by join time. */
export function dedupeParticipants(
    memberships: VoiceParticipant[],
): VoiceParticipant[] {
    const byUser = new Map<string, VoiceParticipant>();
    for (const m of memberships) {
        const existing = byUser.get(m.userId);
        if (!existing || m.joinedTs < existing.joinedTs)
            byUser.set(m.userId, m);
    }
    return [...byUser.values()].sort((a, b) => a.joinedTs - b.joinedTs);
}

export type CallBannerAction = "leave" | "join";

export interface CallBannerInput {
    /** Whether we are connected to THIS room's call. */
    inThisCall: boolean;
    /** Deduped roster user ids currently in the call (may include self). */
    participantUserIds: string[];
    /** Our own user id, or null before it is known. */
    selfUserId: string | null;
}

export interface CallBannerDecision {
    visible: boolean;
    /** The right-hand action, or null while the banner is hidden. */
    action: CallBannerAction | null;
}

/**
 * Whether the active-call banner shows, and whether its action is Leave or
 * Join. Visible when we are in the call OR some OTHER user is in it.
 *
 * Excluding self from the "someone is here" test is what kills the solo-leave
 * flicker. On leave, `inThisCall` flips false the instant our connection drops,
 * but the roster still holds our own stale membership for a beat. A plain "any
 * participant" test would keep the banner up showing "Join" — a call whose only
 * member is us, which we are not in — until the roster empties. Requiring a
 * NON-self participant means that transient state never renders, while a call
 * someone else started (they are the sole member, we are not in it yet) still
 * shows a Join banner.
 */
export function callBannerDecision(input: CallBannerInput): CallBannerDecision {
    const hasOthers = input.participantUserIds.some(
        (id) => id !== input.selfUserId,
    );
    const visible = input.inThisCall || hasOthers;
    if (!visible) return { visible: false, action: null };
    return { visible: true, action: input.inThisCall ? "leave" : "join" };
}

export type VoiceConnState = "connecting" | "connected" | "reconnecting" | null;

export function connStateLabel(state: VoiceConnState): string {
    switch (state) {
        case "connecting":
            return "Connecting…";
        case "connected":
            return "Voice connected";
        case "reconnecting":
            return "Reconnecting…";
        default:
            return "";
    }
}

/**
 * Discord semantics: deafen implies mute; un-deafening restores the mic only
 * if the deafen action muted it; unmuting while deafened lifts the deafen too.
 */
export interface MuteState {
    micMuted: boolean;
    deafened: boolean;
    mutedByDeafen: boolean;
}

export function toggleMute(s: MuteState): MuteState {
    if (s.micMuted)
        return { micMuted: false, deafened: false, mutedByDeafen: false };
    return { ...s, micMuted: true };
}

export function toggleDeafen(s: MuteState): MuteState {
    if (s.deafened) {
        return {
            micMuted: s.mutedByDeafen ? false : s.micMuted,
            deafened: false,
            mutedByDeafen: false,
        };
    }
    return { micMuted: true, deafened: true, mutedByDeafen: !s.micMuted };
}

/** lk-jwt-service JWT endpoint for a LiveKit focus service URL. */
export function sfuJwtUrl(serviceUrl: string): string {
    return `${serviceUrl.replace(/\/+$/, "")}/sfu/get`;
}

export interface LivekitTarget {
    serviceUrl: string;
    alias: string;
}

function asLivekit(
    t: unknown,
): { livekit_service_url: string; livekit_alias?: string } | null {
    if (typeof t !== "object" || t === null) return null;
    const o = t as Record<string, unknown>;
    if (o.type !== "livekit" || typeof o.livekit_service_url !== "string")
        return null;
    return {
        livekit_service_url: o.livekit_service_url,
        // Remote membership data — a non-string alias must not leak through.
        livekit_alias:
            typeof o.livekit_alias === "string" ? o.livekit_alias : undefined,
    };
}

/**
 * Choose the LiveKit SFU to connect to: an existing member's transport wins
 * (everyone must meet in the same SFU room), otherwise the homeserver's
 * configured focus with this room's id as the alias.
 */
export function pickLivekitTransport(
    memberTransports: unknown[],
    configuredFoci: unknown[],
    roomId: string,
): LivekitTarget | null {
    for (const t of memberTransports) {
        const lk = asLivekit(t);
        if (lk)
            return {
                serviceUrl: lk.livekit_service_url,
                alias: lk.livekit_alias ?? roomId,
            };
    }
    for (const t of configuredFoci) {
        const lk = asLivekit(t);
        if (lk) return { serviceUrl: lk.livekit_service_url, alias: roomId };
    }
    return null;
}

export interface ScreenResolutionOption {
    key: string;
    label: string;
    width: number;
    height: number;
}

/** Screen-share capture resolutions offered in settings. A target/cap — the
 *  browser yields at most the source's native resolution. */
export const SCREEN_RESOLUTIONS: ScreenResolutionOption[] = [
    { key: "720", label: "720p", width: 1280, height: 720 },
    { key: "1080", label: "1080p", width: 1920, height: 1080 },
    { key: "1440", label: "1440p", width: 2560, height: 1440 },
    { key: "2160", label: "4K", width: 3840, height: 2160 },
];

export const SCREEN_FPS_OPTIONS = [15, 30, 60] as const;

/** Map a stored resolution key + frame rate to a LiveKit VideoResolution.
 *  Unknown key → 1080p (LiveKit's own default); non-preset fps → 30. */
export function screenShareCaptureResolution(
    resKey: string,
    fps: number,
): { width: number; height: number; frameRate: number } {
    const res =
        SCREEN_RESOLUTIONS.find((o) => o.key === resKey) ??
        SCREEN_RESOLUTIONS[1];
    const frameRate = (SCREEN_FPS_OPTIONS as readonly number[]).includes(fps)
        ? fps
        : 30;
    return { width: res.width, height: res.height, frameRate };
}

/**
 * Message to show when MY room membership changed during a call, or null when
 * the change doesn't end the call. `sender` is who sent the m.room.member event
 * that removed me; `me` is my own user id. An absent/unknown sender is treated
 * as a self-leave: leaving from another device can prune my member object
 * before this fires, so a missing sender would otherwise misread as "You were
 * removed". A genuine kick carries its actor in the fresh state event.
 */
export function callEndedMembershipMessage(
    membership: string,
    sender: string | undefined,
    me: string,
): string | null {
    if (membership === "ban")
        return "You were banned from this room - call ended";
    if (membership === "leave") {
        const removedBySelf = !sender || sender === me;
        return removedBySelf
            ? "You left this room - call ended"
            : "You were removed from this room - call ended";
    }
    return null; // join / invite / knock: no teardown
}

/** "@user:server:DEVICE" → "@user:server". Device ids never contain ":". */
export function identityToUserId(identity: string): string {
    return identity.slice(0, identity.lastIndexOf(":"));
}

/** The distinct user ids present in a list of "user:device" identities. */
export function usersFromIdentities(identities: string[]): Set<string> {
    return new Set(identities.map(identityToUserId));
}

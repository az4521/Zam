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

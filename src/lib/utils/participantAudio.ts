/**
 * Pure per-participant audio state: the local volume slider and local mute
 * driven by the call participant menu, plus its persisted form. Element and
 * LiveKit wiring lives in $lib/matrix/client; this module stays testable.
 */

export interface ParticipantAudio {
    /** Slider position, 0–1. Unity is the ceiling: HTMLMediaElement.volume
     *  caps at 1.0, so there is no Discord-style 200% boost. */
    volume: number;
    /** Local mute, held apart from the slider so unmuting restores the level. */
    muted: boolean;
}

export const DEFAULT_PARTICIPANT_AUDIO: ParticipantAudio = {
    volume: 1,
    muted: false,
};

/** Clamp to [0,1]. Non-finite input falls back to unity rather than silence —
 *  a corrupt value must not silently mute someone. */
export function clampVolume(v: number): number {
    if (!Number.isFinite(v)) return 1;
    return Math.min(1, Math.max(0, v));
}

/** What an attached <audio> element's `volume` should be: the call-output
 *  master scaled by this user's level, or silence when locally muted. */
export function effectiveVolume(
    master: number,
    p: ParticipantAudio | undefined,
): number {
    if (p?.muted) return 0;
    return clampVolume(clampVolume(master) * clampVolume(p?.volume ?? 1));
}

export function withVolume(p: ParticipantAudio, v: number): ParticipantAudio {
    return { ...p, volume: clampVolume(v) };
}

export function withLocalMute(
    p: ParticipantAudio,
    muted: boolean,
): ParticipantAudio {
    return { ...p, muted };
}

/** Persisted shape: {"@user:server": {v: 0.5, m: true}}. Defaults are dropped. */
export function serializeAudioMap(map: Map<string, ParticipantAudio>): string {
    const out: Record<string, { v: number; m: boolean }> = {};
    for (const [userId, p] of map) {
        if (p.volume === DEFAULT_PARTICIPANT_AUDIO.volume && !p.muted) continue;
        out[userId] = { v: p.volume, m: p.muted };
    }
    return JSON.stringify(out);
}

/** Tolerant of anything localStorage hands back: bad JSON and bad entries are
 *  dropped, never thrown. */
export function parseAudioMap(
    json: string | null,
): Map<string, ParticipantAudio> {
    const map = new Map<string, ParticipantAudio>();
    if (!json) return map;
    let raw: unknown;
    try {
        raw = JSON.parse(json);
    } catch {
        return map;
    }
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
        return map;
    for (const [userId, value] of Object.entries(
        raw as Record<string, unknown>,
    )) {
        if (typeof value !== "object" || value === null) continue;
        const { v, m } = value as { v?: unknown; m?: unknown };
        const hasVolume = typeof v === "number";
        const hasMute = typeof m === "boolean";
        if (!hasVolume && !hasMute) continue;
        map.set(userId, {
            volume: hasVolume
                ? clampVolume(v)
                : DEFAULT_PARTICIPANT_AUDIO.volume,
            muted: m === true,
        });
    }
    return map;
}

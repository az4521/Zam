/**
 * Pure per-participant audio state: the local volume slider and local mute
 * driven by the call participant menu, plus its persisted form. Element and
 * LiveKit wiring lives in $lib/matrix/client; this module stays testable.
 */

export interface ParticipantAudio {
    /** Slider position, 0–MAX_PARTICIPANT_VOLUME. Above unity the boost is
     *  applied through Web Audio (HTMLMediaElement.volume caps at 1.0). */
    volume: number;
    /** Slider position for the audio of their screen or application share,
     *  kept apart from `volume` (their voice). Same range. */
    shareVolume: number;
    /** Local mute, held apart from the slider so unmuting restores the level. */
    muted: boolean;
    /** Local per-user video hide flag. */
    videoHidden: boolean;
}

export const DEFAULT_PARTICIPANT_AUDIO: ParticipantAudio = {
    volume: 1,
    shareVolume: 1,
    muted: false,
    videoHidden: false,
};

/** Which of a user's audio tracks an element plays: their microphone, or the
 *  sound of a screen or application they share. */
export type AudioKind = "voice" | "share";

/** Per-user slider ceiling: 500%. */
export const MAX_PARTICIPANT_VOLUME = 5;

/** Clamp to [0,1]. Non-finite input falls back to unity rather than silence —
 *  a corrupt value must not silently mute someone. */
export function clampVolume(v: number): number {
    if (!Number.isFinite(v)) return 1;
    return Math.min(1, Math.max(0, v));
}

/** Clamp a per-user level to [0,MAX_PARTICIPANT_VOLUME], with the same
 *  unity fallback for non-finite input. */
export function clampParticipantVolume(v: number): number {
    if (!Number.isFinite(v)) return 1;
    return Math.min(MAX_PARTICIPANT_VOLUME, Math.max(0, v));
}

/** The linear gain a user's audio should play at: the call-output master
 *  (0–1) scaled by this user's level for `kind` (0–5), or silence when
 *  locally muted.
 *  Above 1 an <audio> element alone cannot produce it; see needsBoost. */
export function effectiveVolume(
    master: number,
    p: ParticipantAudio | undefined,
    kind: AudioKind = "voice",
): number {
    if (p?.muted) return 0;
    const level = kind === "share" ? p?.shareVolume : p?.volume;
    return clampVolume(master) * clampParticipantVolume(level ?? 1);
}

/** Whether a gain from effectiveVolume needs the Web Audio path. */
export function needsBoost(gain: number): boolean {
    return gain > 1;
}

export function withVolume(p: ParticipantAudio, v: number): ParticipantAudio {
    return { ...p, volume: clampParticipantVolume(v) };
}

export function withShareVolume(
    p: ParticipantAudio,
    v: number,
): ParticipantAudio {
    return { ...p, shareVolume: clampParticipantVolume(v) };
}

export function withLocalMute(
    p: ParticipantAudio,
    muted: boolean,
): ParticipantAudio {
    return { ...p, muted };
}

export function withVideoHidden(
    p: ParticipantAudio,
    videoHidden: boolean,
): ParticipantAudio {
    return { ...p, videoHidden };
}

/** Persisted shape: {"@user:server": {v: 0.5, s?: 2, m: true, h?: true}}. Defaults are dropped. */
export function serializeAudioMap(map: Map<string, ParticipantAudio>): string {
    const out: Record<
        string,
        { v: number; s?: number; m: boolean; h?: boolean }
    > = {};
    for (const [userId, p] of map) {
        if (
            p.volume === DEFAULT_PARTICIPANT_AUDIO.volume &&
            p.shareVolume === DEFAULT_PARTICIPANT_AUDIO.shareVolume &&
            !p.muted &&
            !p.videoHidden
        )
            continue;
        out[userId] = {
            v: p.volume,
            ...(p.shareVolume !== DEFAULT_PARTICIPANT_AUDIO.shareVolume
                ? { s: p.shareVolume }
                : {}),
            m: p.muted,
            ...(p.videoHidden ? { h: true } : {}),
        };
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
        const { v, s, m, h } = value as {
            v?: unknown;
            s?: unknown;
            m?: unknown;
            h?: unknown;
        };
        const hasVolume = typeof v === "number";
        const hasShareVolume = typeof s === "number";
        const hasMute = typeof m === "boolean";
        const hasVideoHidden = typeof h === "boolean";
        if (!hasVolume && !hasShareVolume && !hasMute && !hasVideoHidden)
            continue;
        map.set(userId, {
            volume: hasVolume
                ? clampParticipantVolume(v)
                : DEFAULT_PARTICIPANT_AUDIO.volume,
            shareVolume: hasShareVolume
                ? clampParticipantVolume(s)
                : DEFAULT_PARTICIPANT_AUDIO.shareVolume,
            muted: m === true,
            videoHidden: h === true,
        });
    }
    return map;
}

// Pure soundboard helpers: the pack content shape (a sibling of the MSC2545
// image packs, holding audio instead of images), upload limits, and the call
// data-channel message. Kept free of the Matrix client and LiveKit so it is
// unit-testable.

/** Per-user pack, in account data. */
export const USER_SOUNDBOARD_TYPE = "moe.crafty.soundboard";
/** Room/space pack, a state event keyed by pack name. */
export const ROOM_SOUNDBOARD_TYPE = "moe.crafty.room_soundboard";
/** LiveKit data-channel topic that carries "play this sound". */
export const SOUNDBOARD_TOPIC = "moe.crafty.soundboard";

/** Largest file accepted for upload and for playback. */
export const MAX_SOUND_BYTES = 1024 * 1024;
/** Longest clip accepted, in seconds. */
export const MAX_SOUND_SECONDS = 15;
/** Receivers drop a sender's sounds arriving faster than this. */
export const MIN_SOUND_INTERVAL_MS = 400;
/** Sounds from one sender that may be playing at once. */
export const MAX_SOUNDS_PER_SENDER = 3;
/** Soundboard slider ceiling: 500%, like the voice slider. */
export const MAX_SOUND_VOLUME = 5;

export interface SoundInfo {
    mimetype?: string;
    size?: number;
    /** Seconds. */
    duration?: number;
}

export interface Sound {
    name: string;
    mxcUrl: string;
    info?: SoundInfo;
}

export interface SoundPack {
    id: string;
    name: string;
    /** Where it lives, for the editor: "user" or the room id. */
    roomId?: string;
    stateKey?: string;
    sourceName?: string;
    inherited?: boolean;
    editable?: boolean;
    sounds: Sound[];
}

export interface SoundPackContent {
    pack?: { display_name?: string; [key: string]: unknown };
    sounds?: Record<string, { url?: unknown; info?: unknown }>;
    [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isMxcUrl(value: unknown): value is string {
    return (
        typeof value === "string" && /^mxc:\/\/[^/\s]+\/[^/\s]+$/.test(value)
    );
}

/** `name` without surrounding colons/whitespace. */
export function normalizeSoundName(name: string): string {
    return name.trim().replace(/^:+|:+$/g, "");
}

/** Letters, digits and a few separators, like emoji shortcodes, plus spaces. */
export function isValidSoundName(name: string): boolean {
    return /^[\p{L}\p{N}_.+\- ]{1,48}$/u.test(normalizeSoundName(name));
}

/** `wanted`, or `wanted_2`, `wanted_3`... whichever is free in `taken`. */
export function uniqueSoundName(taken: Set<string>, wanted: string): string {
    if (!taken.has(wanted)) return wanted;
    let n = 2;
    while (taken.has(`${wanted}_${n}`)) n++;
    return `${wanted}_${n}`;
}

function cleanInfo(raw: unknown): SoundInfo | undefined {
    if (!isRecord(raw)) return undefined;
    const info: SoundInfo = {};
    if (typeof raw.mimetype === "string") info.mimetype = raw.mimetype;
    if (typeof raw.size === "number" && Number.isFinite(raw.size))
        info.size = raw.size;
    if (typeof raw.duration === "number" && Number.isFinite(raw.duration))
        info.duration = raw.duration;
    return Object.keys(info).length > 0 ? info : undefined;
}

/** The sounds in a pack's content, skipping entries that are not an mxc
 *  audio reference. Sorted by name. */
export function soundsFromContent(
    content: SoundPackContent | undefined | null,
): Sound[] {
    const raw = content?.sounds;
    if (!isRecord(raw)) return [];
    const out: Sound[] = [];
    for (const [name, value] of Object.entries(raw)) {
        if (!isRecord(value) || !isMxcUrl(value.url)) continue;
        const info = cleanInfo(value.info);
        out.push({ name, mxcUrl: value.url, ...(info ? { info } : {}) });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Content with a sound added (or replaced). Other keys are kept. */
export function withSound(
    content: SoundPackContent | undefined | null,
    sound: Sound,
    packName: string,
): SoundPackContent {
    const current = content ?? {};
    return {
        ...current,
        pack: {
            ...(current.pack ?? {}),
            display_name: current.pack?.display_name || packName,
        },
        sounds: {
            ...(current.sounds ?? {}),
            [sound.name]: {
                url: sound.mxcUrl,
                ...(sound.info ? { info: sound.info } : {}),
            },
        },
    };
}

/** Content with a sound removed. */
export function withoutSound(
    content: SoundPackContent | undefined | null,
    name: string,
): SoundPackContent {
    const sounds = { ...(content?.sounds ?? {}) };
    delete sounds[name];
    return { ...(content ?? {}), sounds };
}

/** Why a file cannot be a sound, or null when it can. `kind` is a key for the
 *  caller to translate. */
export function soundFileProblem(file: {
    type: string;
    size: number;
}): "notAudio" | "tooBig" | null {
    if (!file.type.startsWith("audio/")) return "notAudio";
    if (file.size > MAX_SOUND_BYTES) return "tooBig";
    return null;
}

export interface SoundboardMessage {
    mxcUrl: string;
    name: string;
}

export function encodeSoundboardMessage(
    msg: SoundboardMessage,
): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(
        JSON.stringify({ v: 1, url: msg.mxcUrl, name: msg.name.slice(0, 48) }),
    );
}

/** A received message, or null for anything that is not a well-formed one.
 *  Only mxc references are accepted: the sender picks what we fetch. */
export function decodeSoundboardMessage(
    payload: Uint8Array,
): SoundboardMessage | null {
    if (payload.byteLength > 1024) return null;
    let raw: unknown;
    try {
        raw = JSON.parse(new TextDecoder().decode(payload));
    } catch {
        return null;
    }
    if (!isRecord(raw) || raw.v !== 1 || !isMxcUrl(raw.url)) return null;
    return {
        mxcUrl: raw.url,
        name: typeof raw.name === "string" ? raw.name.slice(0, 48) : "",
    };
}

/** Per-sender throttle for incoming sounds. */
export interface SenderLimiter {
    /** Whether a sound from `sender` may start now. */
    allow(sender: string, now: number): boolean;
    /** Call when a sound from `sender` finishes. */
    done(sender: string): void;
}

export function createSenderLimiter(): SenderLimiter {
    const last = new Map<string, number>();
    const playing = new Map<string, number>();
    return {
        allow(sender, now) {
            const prev = last.get(sender);
            if (prev !== undefined && now - prev < MIN_SOUND_INTERVAL_MS)
                return false;
            if ((playing.get(sender) ?? 0) >= MAX_SOUNDS_PER_SENDER)
                return false;
            last.set(sender, now);
            playing.set(sender, (playing.get(sender) ?? 0) + 1);
            return true;
        },
        done(sender) {
            const n = (playing.get(sender) ?? 0) - 1;
            if (n > 0) playing.set(sender, n);
            else playing.delete(sender);
        },
    };
}

/** The linear gain a sender's sounds play at: call-output master (0-1) times
 *  their soundboard level (0-5), or silence when muted. Non-finite input
 *  falls back to unity rather than silence. */
export function soundGain(
    master: number,
    level: number | undefined,
    muted: boolean,
): number {
    if (muted) return 0;
    const m = Number.isFinite(master) ? Math.min(1, Math.max(0, master)) : 1;
    const l =
        level === undefined || !Number.isFinite(level)
            ? 1
            : Math.min(MAX_SOUND_VOLUME, Math.max(0, level));
    return m * l;
}

// Pure soundboard helpers (MSC4577): the pack content shape (a sibling of the
// MSC2545 image packs, holding audio instead of images), upload limits, and
// the call data-channel message. Kept free of the Matrix client and LiveKit so
// it is unit-testable.

/** Per-user pack, in account data. Not in MSC4577 (which, like MSC2545, has
 *  only room packs); kept as a Zam extra, as im.ponies.user_emotes is for
 *  emotes. Only the sender reads it, so other clients are unaffected. */
export const USER_SOUNDBOARD_TYPE = "moe.crafty.soundboard";
/** Room/space pack, a state event keyed by pack name. */
export const ROOM_SOUNDBOARD_TYPE = "moe.crafty.room_soundboard";
/** Room packs the user enabled for every call (m.soundboard.rooms), the same
 *  shape as m.image_pack.rooms. */
export const SOUNDBOARD_ROOMS_TYPE = "moe.crafty.soundboard_rooms";
/** LiveKit data-channel topic that carries "play this sound". */
export const SOUNDBOARD_TOPIC = "moe.crafty.soundboard";

/** Largest file accepted for upload and for playback. */
export const MAX_SOUND_BYTES = 1024 * 1024;
/** Longest clip accepted, in seconds. */
export const MAX_SOUND_SECONDS = 15;
/** Receivers drop a sender's sounds arriving faster than this. */
export const MIN_SOUND_INTERVAL_MS = 1500;
/** A sound that has not started this long after it arrived is dropped, so a
 *  slow download does not play it over a conversation that moved on. */
export const SOUND_START_TTL_MS = 3000;
/** Sounds from one sender that may be playing at once. */
export const MAX_SOUNDS_PER_SENDER = 3;
/** Soundboard slider ceiling: 500%, like the voice slider. */
export const MAX_SOUND_VOLUME = 5;

/** The spec's AudioInfo. */
export interface SoundInfo {
    mimetype?: string;
    size?: number;
    /** Milliseconds. Packs written before Zam 1.49.0 hold seconds; cleanInfo
     *  converts those. */
    duration?: number;
}

export interface Sound {
    /** The shortcode, the key in `sounds`. */
    name: string;
    mxcUrl: string;
    /** A description, for display and accessibility. */
    body?: string;
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
    /** Listed in soundboard_rooms, so offered in every call. */
    global?: boolean;
    sounds: Sound[];
}

export interface SoundPackContent {
    pack?: { display_name?: string; [key: string]: unknown };
    sounds?: Record<
        string,
        {
            url?: unknown;
            body?: unknown;
            info?: unknown;
            [key: string]: unknown;
        }
    >;
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

/** The MSC2545 shortcode grammar: ASCII letters, digits, `-` and `_`, at most
 *  100 bytes. Only enforced on new sounds: older names (with spaces, dots...)
 *  stay usable. */
export function isValidSoundName(name: string): boolean {
    return /^[a-zA-Z0-9_-]{1,100}$/.test(normalizeSoundName(name));
}

/** A shortcode made from free text (a typed name, a file name): whitespace
 *  becomes `_` and other characters outside the grammar are dropped. May be
 *  empty, for text with no usable characters. */
export function soundNameFromText(text: string): string {
    return normalizeSoundName(text)
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 100);
}

/** `wanted`, or `wanted_2`, `wanted_3`... whichever is free in `taken`. */
export function uniqueSoundName(taken: Set<string>, wanted: string): string {
    if (!taken.has(wanted)) return wanted;
    let n = 2;
    while (taken.has(`${wanted}_${n}`)) n++;
    return `${wanted}_${n}`;
}

/** Whether a stored duration is in seconds, as Zam wrote before 1.49.0, not
 *  milliseconds. Those were rounded to hundredths and capped at
 *  MAX_SOUND_SECONDS, so are fractional or small; a real clip is never a
 *  whole number of milliseconds that short. */
function isLegacySeconds(duration: number): boolean {
    return !Number.isInteger(duration) || duration <= MAX_SOUND_SECONDS;
}

function durationMs(raw: unknown): number | undefined {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0)
        return undefined;
    return isLegacySeconds(raw) ? Math.round(raw * 1000) : raw;
}

function cleanInfo(raw: unknown): SoundInfo | undefined {
    if (!isRecord(raw)) return undefined;
    const info: SoundInfo = {};
    if (typeof raw.mimetype === "string") info.mimetype = raw.mimetype;
    if (typeof raw.size === "number" && Number.isFinite(raw.size))
        info.size = raw.size;
    const duration = durationMs(raw.duration);
    if (duration !== undefined) info.duration = duration;
    return Object.keys(info).length > 0 ? info : undefined;
}

/** `sounds` with every legacy seconds duration rewritten as milliseconds, so
 *  an edit leaves the whole pack in the current shape. Other keys are kept. */
function withCurrentDurations(
    sounds: SoundPackContent["sounds"],
): NonNullable<SoundPackContent["sounds"]> {
    const out: NonNullable<SoundPackContent["sounds"]> = {};
    for (const [name, value] of Object.entries(sounds ?? {})) {
        const info = isRecord(value) ? value.info : undefined;
        const duration = isRecord(info) ? durationMs(info.duration) : undefined;
        out[name] =
            isRecord(info) &&
            duration !== undefined &&
            duration !== info.duration
                ? { ...value, info: { ...info, duration } }
                : value;
    }
    return out;
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
        const body =
            typeof value.body === "string" && value.body.trim()
                ? value.body
                : undefined;
        out.push({
            name,
            mxcUrl: value.url,
            ...(body ? { body } : {}),
            ...(info ? { info } : {}),
        });
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
            ...withCurrentDurations(current.sounds),
            [sound.name]: {
                url: sound.mxcUrl,
                ...(sound.body ? { body: sound.body } : {}),
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
    const sounds = withCurrentDurations(content?.sounds);
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

/** Whether an audio file is an MP4 container (an .m4a), the kind whose index
 *  may sit after the audio and so needs moving to the front to stream. */
export function isMp4Audio(file: { type: string; name: string }): boolean {
    return (
        /^audio\/(x-)?(mp4|m4a)$/i.test(file.type) ||
        (file.type.startsWith("audio/") && /\.(m4a|m4b|mp4)$/i.test(file.name))
    );
}

export interface SoundboardMessage {
    mxcUrl: string;
    shortcode: string;
}

/** A shortcode cut to at most 100 bytes, on a code point. */
function clipShortcode(text: string): string {
    const bytes = new TextEncoder().encode(text);
    if (bytes.byteLength <= 100) return text;
    return new TextDecoder().decode(bytes.slice(0, 100)).replace(/\uFFFD$/, "");
}

/** The MSC4577 play message, `{url, shortcode}`. `v` and `name` are the
 *  earlier revision's fields, kept so Zam before 1.49.0, which requires
 *  `v: 1`, still plays our sounds; receivers ignore unknown keys. */
export function encodeSoundboardMessage(
    msg: SoundboardMessage,
): Uint8Array<ArrayBuffer> {
    const shortcode = clipShortcode(msg.shortcode);
    return new TextEncoder().encode(
        JSON.stringify({
            url: msg.mxcUrl,
            shortcode,
            v: 1,
            name: shortcode.slice(0, 48),
        }),
    );
}

/** A received message, or null for anything that is not a well-formed one.
 *  Only mxc references are accepted: the sender picks what we fetch. Reads
 *  both revisions: `shortcode`, or the earlier `name`. */
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
    if (!isRecord(raw) || !isMxcUrl(raw.url)) return null;
    const shortcode =
        typeof raw.shortcode === "string"
            ? raw.shortcode
            : typeof raw.name === "string"
              ? raw.name
              : "";
    return { mxcUrl: raw.url, shortcode: clipShortcode(shortcode) };
}

/** Per-sender throttle for incoming sounds. */
export interface SenderLimiter {
    /** Whether a sound from `sender` may start now. */
    allow(sender: string, now: number): boolean;
    /** Call when a sound from `sender` finishes. */
    done(sender: string): void;
}

export function createSenderLimiter(
    minIntervalMs: () => number = () => MIN_SOUND_INTERVAL_MS,
): SenderLimiter {
    const last = new Map<string, number>();
    const playing = new Map<string, number>();
    return {
        allow(sender, now) {
            const prev = last.get(sender);
            if (prev !== undefined && now - prev < minIntervalMs())
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

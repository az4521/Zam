/**
 * Remembered voice levels, so normalization starts a call where the last one
 * left off instead of at unity gain. Without it every voice takes its first
 * few seconds of speech to settle (the level estimate only moves on speech,
 * and gain goes up slowly by design), which testers heard as audio that
 * "takes a few seconds to normalize" on every join.
 *
 * Keyed by user id for incoming voices and "self" for your own mic. Kept in
 * localStorage: losing it only means one slower start.
 */
import type { NormalizerState } from "./voiceNormalization";

const STORAGE_KEY = "zam.voiceLevels.v1";
/** Older than this, a level is likely a different mic or room. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Most voices kept; the least recently heard go first. */
const MAX_ENTRIES = 200;
/** Write at most this often per voice while it is being heard. */
const SAVE_INTERVAL_MS = 5000;

export interface RememberedLevel {
    /** Smoothed speech level, dBFS. */
    level: number;
    /** Noise floor, dBFS, when known. */
    floor: number | null;
    /** When it was last updated (ms since epoch). */
    at: number;
}

type Store = Record<string, RememberedLevel>;

let cache: Store | null = null;

function load(): Store {
    if (cache) return cache;
    cache = {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === "object") {
            for (const [k, v] of Object.entries(parsed as Store)) {
                if (
                    v &&
                    Number.isFinite(v.level) &&
                    Number.isFinite(v.at) &&
                    (v.floor === null || Number.isFinite(v.floor))
                )
                    cache[k] = v;
            }
        }
    } catch {
        /* unreadable or blocked storage: start empty */
    }
    return cache;
}

function persist(store: Store): void {
    const keys = Object.keys(store);
    if (keys.length > MAX_ENTRIES) {
        keys.sort((a, b) => store[a].at - store[b].at);
        for (const k of keys.slice(0, keys.length - MAX_ENTRIES))
            delete store[k];
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
        /* full or blocked: the cache still serves this session */
    }
}

/** The level last heard for `key`, if recent enough to trust. */
export function rememberedLevel(
    key: string,
    now = Date.now(),
): RememberedLevel | null {
    const entry = load()[key];
    if (!entry || now - entry.at > MAX_AGE_MS) return null;
    return entry;
}

/** Record a normalizer's state for `key`. Throttled per key unless `force`
 *  (a voice leaving the call). */
export function rememberLevel(
    key: string,
    state: NormalizerState,
    force = false,
    now = Date.now(),
): void {
    if (state.level === null) return;
    const store = load();
    const prev = store[key];
    if (!force && prev && now - prev.at < SAVE_INTERVAL_MS) return;
    store[key] = { level: state.level, floor: state.gate.floor, at: now };
    persist(store);
}

/** Tests only. */
export function resetRememberedLevelsCache(): void {
    cache = null;
}

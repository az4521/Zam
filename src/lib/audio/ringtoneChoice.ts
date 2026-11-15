/**
 * Which ringtone rings an incoming call: the built-in tone, or one a plugin
 * registered with zam.ringtones.register. Selection is pure; the runner keeps a
 * plugin's ringtone from ever leaving a call silent. A ringtone that is missing,
 * unloaded, throws, rejects or hangs hands the call to the built-in tone.
 * No SDK or DOM imports at module scope (Audio is touched only at play time).
 */
import type { RegistryEntry } from "$lib/plugins/registry";
import type {
    PluginRingtone,
    PluginRingtoneCallback,
} from "$lib/plugins/types";
import { RING_MAX_MS, type RingHandle } from "./soundEffects";

const KEY_PREFIX = "plugin:";
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SRC_PATTERN = /^(https:|blob:|data:)/i;

/** How long a plugin's start() has to begin sounding before the built-in tone
 *  takes over. */
export const RING_START_TIMEOUT_MS = 2000;
/** How long a picker preview of a plugin ringtone plays. */
export const RING_PREVIEW_MS = 2400;

/** Why a ringtone registration is refused, or null when it is valid. */
export function ringtoneProblem(r: PluginRingtone): string | null {
    if (!r || typeof r !== "object") return "a ringtone object is required";
    if (typeof r.id !== "string" || !ID_PATTERN.test(r.id))
        return "id must be 1 to 64 letters, digits, dots, underscores or dashes";
    if (typeof r.name !== "string" || !r.name.trim())
        return "name must be a non-empty string";
    if (r.src !== undefined) {
        if (typeof r.src !== "string" || !SRC_PATTERN.test(r.src))
            return "src must be an https:, blob: or data: URL";
        if (r.start !== undefined || r.stop !== undefined)
            return "give either src or start and stop, not both";
        return null;
    }
    if (typeof r.start !== "function" || typeof r.stop !== "function")
        return "give src, or start and stop functions";
    return null;
}

/** The stored choice for a plugin ringtone. Built-in is the empty string. */
export function ringtoneKey(pluginId: string, id: string): string {
    return `${KEY_PREFIX}${pluginId}:${id}`;
}

/** Split a stored key back into its parts. Plugin ids and ringtone ids never
 *  contain a colon, so the first one after the prefix is the separator. */
export function parseRingtoneKey(
    key: string,
): { pluginId: string; id: string } | null {
    if (!key.startsWith(KEY_PREFIX)) return null;
    const rest = key.slice(KEY_PREFIX.length);
    const i = rest.indexOf(":");
    if (i <= 0 || i === rest.length - 1) return null;
    return { pluginId: rest.slice(0, i), id: rest.slice(i + 1) };
}

/** The registered ringtone a stored key names, or null: built-in, malformed,
 *  or its plugin is not loaded. */
export function findPluginRingtone(
    entries: RegistryEntry<PluginRingtone>[],
    key: string,
): RegistryEntry<PluginRingtone> | null {
    const parsed = key ? parseRingtoneKey(key) : null;
    if (!parsed) return null;
    return (
        entries.find(
            (e) => e.pluginId === parsed.pluginId && e.value.id === parsed.id,
        ) ?? null
    );
}

/** Picker rows for the registered plugin ringtones, in registration order. */
export function pluginRingtoneOptions(
    entries: RegistryEntry<PluginRingtone>[],
): { key: string; name: string; pluginId: string }[] {
    return entries.map((e) => ({
        key: ringtoneKey(e.pluginId, e.value.id),
        name: e.value.name,
        pluginId: e.pluginId,
    }));
}

/** A ring that is sounding and may need to be handed back to the built-in
 *  tone. Set holds only rings that have not ended. */
interface LiveRing {
    pluginId: string;
    abandon(): void;
}
const liveRings = new Set<LiveRing>();

/** Plugin unloaded or disabled: every ring it is playing falls back to the
 *  built-in tone. Call from the plugin's disposeAll, after its registry
 *  entries are gone. */
export function stopPluginRingtonesOf(pluginId: string): void {
    for (const r of [...liveRings]) if (r.pluginId === pluginId) r.abandon();
}

interface Sound {
    start(): void | Promise<void>;
    stop(): void;
}

function audioSound(src: string, volume: number): Sound {
    let el: HTMLAudioElement | null = null;
    return {
        start() {
            el = new Audio(src);
            el.loop = true;
            el.volume = Math.min(1, Math.max(0, volume));
            return el.play();
        },
        stop() {
            if (!el) return;
            el.pause();
            el.removeAttribute("src");
            el.load();
            el = null;
        },
    };
}

function soundOf(r: PluginRingtone, volume: number): Sound {
    if (typeof r.src === "string") return audioSound(r.src, volume);
    const cb = r as PluginRingtoneCallback;
    return { start: () => cb.start(), stop: () => cb.stop() };
}

const isPromise = (v: unknown): v is Promise<void> =>
    typeof (v as Promise<void> | undefined)?.then === "function";

const SILENT: RingHandle = { stop() {} };

/** Run one plugin ringtone. Ends after RING_MAX_MS like the built-in ring.
 *  Stop is idempotent. Once the plugin gives up, the built-in ring takes over
 *  and stays until stop(). */
function runPluginRing(
    pluginId: string,
    ringtone: PluginRingtone,
    builtin: () => RingHandle,
    volume: number,
): RingHandle {
    const sound = soundOf(ringtone, volume);
    let soundStopped = false;
    let finished = false;
    let failed = false;
    let fallback: RingHandle = SILENT;
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    let maxTimer: ReturnType<typeof setTimeout> | undefined;

    const stopSound = (): void => {
        if (soundStopped) return;
        soundStopped = true;
        try {
            sound.stop();
        } catch (e) {
            console.error(`[plugin ${pluginId}] ringtone stop threw`, e);
        }
    };
    const live: LiveRing = { pluginId, abandon: () => fail("was unloaded") };
    const handle: RingHandle = {
        stop() {
            if (finished) return;
            finished = true;
            liveRings.delete(live);
            clearTimeout(startTimer);
            clearTimeout(maxTimer);
            stopSound();
            fallback.stop();
        },
    };
    // The plugin gave up: silence its sound and let the built-in tone ring.
    const fail = (why: string): void => {
        if (finished || failed) return;
        failed = true;
        console.warn(
            `[plugin ${pluginId}] ringtone ${why}; the built-in ring plays instead`,
        );
        clearTimeout(startTimer);
        stopSound();
        fallback = builtin();
    };

    liveRings.add(live);
    maxTimer = setTimeout(() => handle.stop(), RING_MAX_MS);

    let started: void | Promise<void>;
    try {
        started = sound.start();
    } catch (e) {
        console.error(`[plugin ${pluginId}] ringtone start threw`, e);
        fail("threw on start");
        return handle;
    }
    if (isPromise(started)) {
        startTimer = setTimeout(
            () => fail(`did not start within ${RING_START_TIMEOUT_MS} ms`),
            RING_START_TIMEOUT_MS,
        );
        started.then(
            () => {
                clearTimeout(startTimer);
                // It came up after the ring had already ended or fallen back:
                // silence it now, for real.
                if (finished || failed) {
                    soundStopped = false;
                    stopSound();
                }
            },
            (e) => {
                console.error(`[plugin ${pluginId}] ringtone start failed`, e);
                fail("start rejected");
            },
        );
    }
    return handle;
}

/**
 * Start the ringtone for an incoming call. `key` is the stored choice ("" for
 * the built-in tone). Falls back to `builtin()` when no plugin ringtone is
 * selected, the plugin is not loaded, ringing is disabled, or the plugin's
 * ringtone fails.
 */
export function startRingtoneFor(
    key: string,
    entries: RegistryEntry<PluginRingtone>[],
    builtin: () => RingHandle,
    opts: { enabled: boolean; volume: number },
): RingHandle {
    const entry = findPluginRingtone(entries, key);
    if (!entry || !opts.enabled) return builtin();
    return runPluginRing(entry.pluginId, entry.value, builtin, opts.volume);
}

/**
 * Settings picker preview: one short pass of the chosen ringtone. Built-in
 * (or a missing plugin) plays `builtinPreview`.
 */
export function previewRingtone(
    key: string,
    entries: RegistryEntry<PluginRingtone>[],
    opts: { enabled: boolean; volume: number },
    builtinPreview: () => void,
): void {
    const entry = findPluginRingtone(entries, key);
    if (!entry) {
        builtinPreview();
        return;
    }
    if (!opts.enabled) return;
    const h = runPluginRing(
        entry.pluginId,
        entry.value,
        () => {
            builtinPreview();
            return SILENT;
        },
        opts.volume,
    );
    setTimeout(() => h.stop(), RING_PREVIEW_MS);
}

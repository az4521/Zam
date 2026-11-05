import { t } from "$lib/i18n";
import { setOwnProfileField, uploadContent } from "$lib/matrix/client";
import { auth } from "$lib/stores/auth.svelte";
import { requestProfile } from "$lib/stores/profileFields.svelte";
import {
    readRichPresenceApps,
    readRichPresenceImages,
    settingsState,
    writeRichPresenceApps,
    writeRichPresenceImages,
} from "$lib/stores/settings.svelte";
import { PROFILE_FIELDS } from "$lib/utils/extendedProfile";
import {
    discordActivityToEntry,
    discordImageRefs,
    parseRpcEntry,
    pickPublishable,
    serializeRpcEntry,
    withIcons,
    type DiscordImages,
    type RpcEntry,
} from "$lib/utils/richPresence";

// What apps on this computer are doing, published to our profile as MSC4544's
// `m.rpc` field. The Electron main process (electron/richPresence.cjs) listens
// for apps and forwards what they say; this decides what is allowed to leave.
//
// Every app is blocked until the user allows it in Settings > General: the MSC
// asks for per-app control that defaults to deny.

/** How long a Discord-sourced entry lives. They carry no expiry of their own,
 *  so we renew them while the app keeps its activity set. */
const RENEWABLE_TTL_MS = 5 * 60 * 1000;
const RENEW_EVERY_MS = 2 * 60 * 1000;
/** A native app may ask for any expiry; nothing stays longer than this. */
const MAX_TTL_MS = 15 * 60 * 1000;
const PUBLISH_DEBOUNCE_MS = 1500;

export interface KnownApp {
    name: string;
    source: "msc4544" | "arrpc";
    allowed: boolean;
    lastSeen: number;
}

interface Held {
    appKey: string;
    entry: RpcEntry;
    /** Discord entries are renewed rather than expiring. */
    renewable: boolean;
    updated: number;
    /** What the app last said, to tell a repeat from a change. */
    raw: string;
}

class RichPresenceState {
    apps = $state<Record<string, KnownApp>>(loadApps());
    status = $state<DesktopRichPresenceStatus | null>(null);
    /** Entries currently held for allowed apps (what we would publish). */
    heldCount = $state(0);
    /** The last publish failure, in words; null when the last write worked. */
    error = $state<string | null>(null);
}

export const richPresenceState = new RichPresenceState();

function loadApps(): Record<string, KnownApp> {
    try {
        const parsed = JSON.parse(readRichPresenceApps() ?? "{}");
        const out: Record<string, KnownApp> = {};
        for (const [key, v] of Object.entries(parsed)) {
            const a = v as Partial<KnownApp>;
            if (typeof a?.name !== "string") continue;
            out[key] = {
                name: a.name,
                source: a.source === "arrpc" ? "arrpc" : "msc4544",
                allowed: a.allowed === true,
                lastSeen: typeof a.lastSeen === "number" ? a.lastSeen : 0,
            };
        }
        return out;
    } catch {
        return {};
    }
}

function saveApps(): void {
    writeRichPresenceApps(JSON.stringify(richPresenceState.apps));
}

const held = new Map<string, Held>();
let unsubscribe: (() => void) | null = null;
let publishTimer: ReturnType<typeof setTimeout> | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
let renewTimer: ReturnType<typeof setInterval> | null = null;
// Writes are strictly one at a time: a new PUT waits for the previous one.
let chain: Promise<void> = Promise.resolve();
let published = false;

const bridge = () =>
    typeof window !== "undefined" ? window.desktop?.richPresence : undefined;

/** Whether this build can send rich presence at all (desktop only). */
export function richPresenceAvailable(): boolean {
    return bridge() != null;
}

/** Start listening, if the settings say so. Returns a stop function. */
export function startRichPresence(): () => void {
    void syncRichPresence();
    return () => stopRichPresence();
}

/** Re-apply the settings: start or stop the local listeners to match. */
export async function syncRichPresence(): Promise<void> {
    const b = bridge();
    if (!b) return;
    const local = settingsState.richPresenceEnabled;
    const arrpc = local && settingsState.richPresenceArrpc;
    const scan = local && settingsState.richPresenceScan;
    if (local && !unsubscribe) unsubscribe = b.onEvent(handleEvent);
    try {
        richPresenceState.status = await b.configure({
            local,
            arrpc,
            scan,
            userId: auth.userId ?? "",
        });
    } catch {
        richPresenceState.status = null;
    }
    if (!local) {
        unsubscribe?.();
        unsubscribe = null;
        clearHeld();
    } else if (!arrpc) {
        // arRPC went off: whatever it reported is gone.
        for (const [k, h] of held) {
            if (richPresenceState.apps[h.appKey]?.source === "arrpc")
                held.delete(k);
        }
        schedulePublish();
    }
}

/** Stop everything and take our presence off the profile (best effort). */
export function stopRichPresence(): void {
    unsubscribe?.();
    unsubscribe = null;
    void bridge()?.configure({
        local: false,
        arrpc: false,
        scan: false,
        userId: "",
    });
    clearHeld();
}

function clearHeld(): void {
    held.clear();
    schedulePublish();
}

export function setAppAllowed(appKey: string, allowed: boolean): void {
    const app = richPresenceState.apps[appKey];
    if (!app) return;
    app.allowed = allowed;
    saveApps();
    if (!allowed) {
        for (const [k, h] of held) if (h.appKey === appKey) held.delete(k);
        schedulePublish();
    }
}

export function forgetApp(appKey: string): void {
    delete richPresenceState.apps[appKey];
    saveApps();
    for (const [k, h] of held) if (h.appKey === appKey) held.delete(k);
    schedulePublish();
}

function handleEvent(ev: DesktopRichPresenceEvent): void {
    if (!settingsState.richPresenceEnabled) return;
    if (ev?.source !== "msc4544" && ev?.source !== "arrpc") return;
    if (typeof ev.presenceId !== "string") return;
    const id = typeof ev.app?.id === "string" ? ev.app.id.slice(0, 128) : "";
    if (!id) return;
    const name =
        (typeof ev.app.name === "string" && ev.app.name.trim().slice(0, 64)) ||
        id;
    const appKey = `${ev.source}:${id}`;
    const heldKey = `${appKey}|${ev.presenceId}`;

    // A removal says nothing new about the app.
    if (ev.presence === null || ev.presence === undefined) {
        if (held.delete(heldKey)) schedulePublish();
        return;
    }

    // Remember the app the first time we see it, blocked until allowed.
    const now = Date.now();
    const known = richPresenceState.apps[appKey];
    if (!known) {
        richPresenceState.apps[appKey] = {
            name,
            source: ev.source,
            allowed: false,
            lastSeen: now,
        };
        saveApps();
    } else if (now - known.lastSeen > 60_000 || known.name !== name) {
        known.name = name;
        known.lastSeen = now;
        saveApps();
    }

    if (!richPresenceState.apps[appKey].allowed) return;

    // The game scanner repeats itself every few seconds; only a change counts.
    let raw = "";
    try {
        raw = JSON.stringify(ev.presence);
    } catch {
        return;
    }
    if (held.get(heldKey)?.raw === raw) return;

    const renewable = ev.source === "arrpc";
    const entry = renewable
        ? discordActivityToEntry(
              ev.presence,
              `${ev.source}-${ev.presenceId}`,
              name,
              now + RENEWABLE_TTL_MS,
          )
        : parseRpcEntry(ev.presence);
    if (!entry) {
        held.delete(heldKey);
        schedulePublish();
        return;
    }
    entry.expiry = Math.min(entry.expiry, now + MAX_TTL_MS);
    if (entry.expiry <= now) return;
    // One id per entry: apps pick their own, so two could collide.
    entry.id = `${id}-${entry.id}`.slice(0, 128);
    const refs = renewable ? discordImageRefs(ev.presence) : {};
    // Pictures already uploaded go straight on; the rest follow when ready.
    const ready = iconsFromCache(id, refs);
    held.set(heldKey, {
        appKey,
        entry: refs.large || refs.small ? withIcons(entry, ready, refs) : entry,
        renewable,
        updated: now,
        raw,
    });
    schedulePublish();
    if ((refs.large && !ready.large) || (refs.small && !ready.small))
        void attachIcons(heldKey, raw, id, refs);
}

// ── Pictures ───────────────────────────────────────────────────────────────
// A game icon or an album cover is fetched by the Electron side (only from
// Discord and Spotify hosts), shrunk, and uploaded once. The result is
// remembered by source, so the same picture is never uploaded twice.

const MAX_CACHED_IMAGES = 200;
const IMAGE_SIDE = 256;
const imageCache = new Map<string, string>(loadImageCache());
const imageJobs = new Map<string, Promise<string | null>>();
let imageChain: Promise<unknown> = Promise.resolve();

function loadImageCache(): [string, string][] {
    try {
        const parsed = JSON.parse(readRichPresenceImages() ?? "{}");
        return Object.entries(parsed).filter(
            (e): e is [string, string] =>
                typeof e[1] === "string" && e[1].startsWith("mxc://"),
        );
    } catch {
        return [];
    }
}

function rememberImage(key: string, mxc: string): void {
    imageCache.set(key, mxc);
    while (imageCache.size > MAX_CACHED_IMAGES) {
        imageCache.delete(imageCache.keys().next().value as string);
    }
    writeRichPresenceImages(JSON.stringify(Object.fromEntries(imageCache)));
}

const imageKey = (appId: string, ref: string) => `${appId}|${ref}`;

function iconsFromCache(
    appId: string,
    refs: DiscordImages,
): { large?: string; small?: string } {
    return {
        large: refs.large
            ? imageCache.get(imageKey(appId, refs.large))
            : undefined,
        small: refs.small
            ? imageCache.get(imageKey(appId, refs.small))
            : undefined,
    };
}

/** Shrink to icon size, or keep the original bytes if the browser cannot. */
async function prepareImage(type: string, data: Uint8Array): Promise<File> {
    try {
        const bitmap = await createImageBitmap(
            new Blob([data as BlobPart], { type }),
        );
        const scale = Math.min(
            1,
            IMAGE_SIDE / Math.max(bitmap.width, bitmap.height),
        );
        const w = Math.max(1, Math.round(bitmap.width * scale));
        const h = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = new OffscreenCanvas(w, h);
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
        const blob = await canvas.convertToBlob({
            type: "image/webp",
            quality: 0.85,
        });
        return new File([blob], "presence.webp", { type: blob.type });
    } catch {
        return new File([data as BlobPart], "presence", { type });
    }
}

/** The mxc URI for a picture, fetching and uploading it if it is new. */
function mxcForImage(appId: string, ref: string): Promise<string | null> {
    const key = imageKey(appId, ref);
    const known = imageCache.get(key);
    if (known) return Promise.resolve(known);
    let job = imageJobs.get(key);
    if (!job) {
        // One upload at a time, so a burst of new games is not a burst of
        // requests.
        job = (imageChain = imageChain.then(async () => {
            try {
                const image = await bridge()?.image(appId, ref);
                if (!image) return null;
                const mxc = await uploadContent(
                    await prepareImage(image.type, image.data),
                );
                rememberImage(key, mxc);
                return mxc;
            } catch {
                return null;
            } finally {
                imageJobs.delete(key);
            }
        })) as Promise<string | null>;
        imageJobs.set(key, job);
    }
    return job;
}

async function attachIcons(
    heldKey: string,
    raw: string,
    appId: string,
    refs: DiscordImages,
): Promise<void> {
    const [large, small] = await Promise.all([
        refs.large ? mxcForImage(appId, refs.large) : null,
        refs.small ? mxcForImage(appId, refs.small) : null,
    ]);
    const current = held.get(heldKey);
    // The app may have moved on, or been blocked, while this uploaded.
    if (!current || current.raw !== raw) return;
    current.entry = withIcons(
        current.entry,
        { large: large ?? undefined, small: small ?? undefined },
        refs,
    );
    schedulePublish();
}

function schedulePublish(): void {
    richPresenceState.heldCount = held.size;
    if (publishTimer) clearTimeout(publishTimer);
    publishTimer = setTimeout(() => {
        publishTimer = null;
        chain = chain.then(publish, publish);
    }, PUBLISH_DEBOUNCE_MS);
}

async function publish(): Promise<void> {
    const now = Date.now();
    // Drop whatever has run out.
    for (const [k, h] of held) if (h.entry.expiry <= now) held.delete(k);
    richPresenceState.heldCount = held.size;

    const entries = pickPublishable(
        [...held.values()].map((h) => ({ entry: h.entry, updated: h.updated })),
        now,
    );
    armTimers(entries);

    // Nothing to say and nothing said before: leave the profile alone.
    if (entries.length === 0 && !published) return;
    try {
        await writeField(
            entries.length > 0 ? entries.map(serializeRpcEntry) : null,
        );
        published = entries.length > 0;
        richPresenceState.error = null;
        if (auth.userId) requestProfile(auth.userId, 0);
    } catch (e) {
        richPresenceState.error =
            e instanceof Error && e.message
                ? e.message
                : t("richPresence.publishFailed");
    }
}

async function writeField(value: unknown[] | null): Promise<void> {
    // Only the unstable key is ever written. A DELETE of a field that was
    // never set is a no-op on a server that has the field at all.
    await setOwnProfileField(PROFILE_FIELDS.rpc.unstable, value);
}

function armTimers(entries: RpcEntry[]): void {
    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = null;
    const soonest = entries.reduce<number | null>(
        (m, e) => (m === null || e.expiry < m ? e.expiry : m),
        null,
    );
    if (soonest !== null) {
        // Let a renewable entry be renewed first; a native one that was not
        // renewed by its app drops off the profile here.
        expiryTimer = setTimeout(
            () => {
                expiryTimer = null;
                chain = chain.then(publish, publish);
            },
            Math.max(1000, soonest - Date.now() + 500),
        );
    }
    const anyRenewable = [...held.values()].some((h) => h.renewable);
    if (anyRenewable && !renewTimer) {
        renewTimer = setInterval(renew, RENEW_EVERY_MS);
    } else if (!anyRenewable && renewTimer) {
        clearInterval(renewTimer);
        renewTimer = null;
    }
}

function renew(): void {
    const now = Date.now();
    let any = false;
    for (const h of held.values()) {
        if (!h.renewable) continue;
        h.entry.expiry = now + RENEWABLE_TTL_MS;
        any = true;
    }
    if (any) chain = chain.then(publish, publish);
}

/** Test hook: forget all module state. */
export function resetRichPresenceForTests(): void {
    held.clear();
    published = false;
    chain = Promise.resolve();
    for (const timer of [publishTimer, expiryTimer])
        if (timer) clearTimeout(timer);
    if (renewTimer) clearInterval(renewTimer);
    publishTimer = expiryTimer = renewTimer = null;
    unsubscribe = null;
}

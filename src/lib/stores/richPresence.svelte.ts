import { t } from "$lib/i18n";
import { setOwnProfileField, uploadContent } from "$lib/matrix/client";
import { auth } from "$lib/stores/auth.svelte";
import { requestProfile } from "$lib/stores/profileFields.svelte";
import {
    readRichPresenceApps,
    readRichPresenceGames,
    readRichPresenceImages,
    setRichPresenceSteam,
    settingsState,
    writeRichPresenceApps,
    writeRichPresenceGames,
    writeRichPresenceImages,
} from "$lib/stores/settings.svelte";
import { PROFILE_FIELDS } from "$lib/utils/extendedProfile";
import {
    GAME_INVITE_LIMITS,
    gameInvitePayload,
    parseGameInvite,
    type GameInvite,
} from "$lib/utils/gameInvite";
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
// Every app is allowed when first seen and can be switched off per app in
// Settings > General (the MSC asks for per-app control).

/** How long a Discord-sourced entry lives. They carry no expiry of their own,
 *  so we renew them while the app keeps its activity set. */
const RENEWABLE_TTL_MS = 5 * 60 * 1000;
const RENEW_EVERY_MS = 2 * 60 * 1000;
/** A native app may ask for any expiry; nothing stays longer than this. */
const MAX_TTL_MS = 15 * 60 * 1000;
const PUBLISH_DEBOUNCE_MS = 1500;

export interface KnownApp {
    name: string;
    source: "msc4544" | "arrpc" | "plugin";
    allowed: boolean;
    lastSeen: number;
    /** Found by the process scanner. */
    viaScan?: boolean;
    /** Reported by the app itself over Discord rich presence. */
    viaRpc?: boolean;
    /** A media player, from the system's now-playing info. */
    viaMedia?: boolean;
    /** A Steam game, read through Steam's local debugging port. */
    viaSteam?: boolean;
}

interface Held {
    appKey: string;
    /** From the process scanner rather than the app itself. */
    scan: boolean;
    /** From a media player's now-playing info. */
    media: boolean;
    /** From Steam's local debugging port. */
    steam: boolean;
    /** Lower-cased app name, to match a scan against an app's own report. */
    appName: string;
    entry: RpcEntry;
    /** Discord entries are renewed rather than expiring. */
    renewable: boolean;
    updated: number;
    /** What the app last said, to tell a repeat from a change. */
    raw: string;
}

/** A game the user registered by hand, for programs Discord's list lacks. */
export interface CustomGame {
    id: string;
    name: string;
    /** Full path of the executable. */
    exe: string;
}

/** A running game the user can invite someone to. `key` is its held key. */
export type InvitableGame = GameInvite & { key: string };

class RichPresenceState {
    apps = $state<Record<string, KnownApp>>(loadApps());
    games = $state<CustomGame[]>(loadGames());
    /** Running games with a join secret, by held key. Kept apart from what is
     *  published, so an invite works for an app that is not shared. */
    invites = $state<Record<string, InvitableGame>>({});
    status = $state<DesktopRichPresenceStatus | null>(null);
    /** Entries currently held for allowed apps (what we would publish). */
    heldCount = $state(0);
    /** What is being sent to the profile right now, for the sidebar card. */
    active = $state<RpcEntry[]>([]);
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
                source:
                    a.source === "arrpc" || a.source === "plugin"
                        ? a.source
                        : "msc4544",
                allowed: a.allowed === true,
                lastSeen: typeof a.lastSeen === "number" ? a.lastSeen : 0,
                viaScan: a.viaScan === true,
                viaRpc: a.viaRpc === true,
                viaMedia: a.viaMedia === true,
                viaSteam: a.viaSteam === true,
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

function loadGames(): CustomGame[] {
    try {
        const parsed = JSON.parse(readRichPresenceGames() ?? "[]");
        return (Array.isArray(parsed) ? parsed : []).filter(
            (g): g is CustomGame =>
                typeof g?.id === "string" &&
                typeof g.name === "string" &&
                typeof g.exe === "string",
        );
    } catch {
        return [];
    }
}

/** A stable id from the path, so adding the same program twice is one game. */
function gameIdFor(exe: string): string {
    let h = 5381;
    for (const ch of exe.toLowerCase().replaceAll("\\", "/"))
        h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
    return `custom-${h.toString(16)}`;
}

/** Programs running now, to pick a game from (empty off the desktop app). */
export async function listRunningPrograms(): Promise<
    { path: string; name: string }[]
> {
    try {
        return (await bridge()?.programs()) ?? [];
    } catch {
        return [];
    }
}

/** Register a program as a game. It is allowed at once: adding it is the
 *  user's say-so, unlike a game the scanner finds by itself. */
export function addCustomGame(name: string, exe: string): void {
    const trimmed = name.trim().slice(0, 64);
    if (!trimmed || !exe) return;
    const id = gameIdFor(exe);
    const games = richPresenceState.games.filter((g) => g.id !== id);
    games.push({ id, name: trimmed, exe });
    richPresenceState.games = games;
    writeRichPresenceGames(JSON.stringify(games));
    richPresenceState.apps[`arrpc:${id}`] = {
        name: trimmed,
        source: "arrpc",
        allowed: true,
        lastSeen: 0,
    };
    saveApps();
    void syncRichPresence();
}

export function removeCustomGame(id: string): void {
    const games = richPresenceState.games.filter((g) => g.id !== id);
    richPresenceState.games = games;
    writeRichPresenceGames(JSON.stringify(games));
    forgetApp(`arrpc:${id}`);
    void syncRichPresence();
}

const held = new Map<string, Held>();
/** The latest event of each blocked app, by held key: not published, only
 *  remembered, so allowing the app does not wait for its next report. */
const blocked = new Map<string, DesktopRichPresenceEvent>();
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

/** Whether a plugin has published here, so its switch has a page to be on. */
export function pluginPresenceKnown(): boolean {
    return Object.values(richPresenceState.apps).some(
        (a) => a.source === "plugin",
    );
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
    const media = local && settingsState.richPresenceMedia;
    const steam = local && settingsState.richPresenceSteam;
    if (local && !unsubscribe) unsubscribe = b.onEvent(handleEvent);
    try {
        richPresenceState.status = await b.configure({
            local,
            arrpc,
            scan,
            media,
            steam,
            fake: settingsState.richPresenceFakeDiscord,
            autoRestartDiscord: settingsState.richPresenceAutoRestartDiscord,
            userId: auth.userId ?? "",
            games: $state.snapshot(richPresenceState.games),
        });
    } catch {
        richPresenceState.status = null;
    }
    watchListDownload();
    if (!local) {
        unsubscribe?.();
        unsubscribe = null;
        clearLocal();
    } else if (!arrpc) {
        // arRPC went off: whatever it reported is gone.
        for (const [k, h] of held) {
            if (richPresenceState.apps[h.appKey]?.source === "arrpc")
                held.delete(k);
        }
        dropInvites(() => true);
        schedulePublish();
    }
    if (!media) dropMedia();
    if (!steam) dropSteam();
}

/** The games that can be invited to right now (see richPresenceState.invites). */
export function invitableGames(): InvitableGame[] {
    return Object.values(richPresenceState.invites);
}

function setInvite(key: string, invite: InvitableGame | null): void {
    if (invite) richPresenceState.invites[key] = invite;
    else delete richPresenceState.invites[key];
}

function dropInvites(match: (invite: InvitableGame) => boolean): void {
    for (const [k, invite] of Object.entries(richPresenceState.invites))
        if (match(invite)) delete richPresenceState.invites[k];
}

/** The invite for one Steam game report, or null when it cannot be joined: it
 *  needs the friend's Steam id and either a lobby or launch arguments. The
 *  electron side adds `steam_id`, `steam_lobby` and `steam_connect`. */
function inviteFor(
    key: string,
    name: string,
    raw: unknown,
    presenceId: string,
): InvitableGame | null {
    if (!raw || typeof raw !== "object") return null;
    const m = /^steam-(\d{1,20})$/.exec(presenceId);
    const r = raw as Record<string, unknown>;
    const steamId = r.steam_id;
    const lobbyId = r.steam_lobby;
    const connect = r.steam_connect;
    if (!m || typeof steamId !== "string") return null;
    if (typeof connect !== "string" && typeof lobbyId !== "string") return null;
    // The presence picture is `steam:<appid>:<icon hash>` when Steam has an icon.
    const picture = (raw as { assets?: { large_image?: unknown } }).assets
        ?.large_image;
    const icon =
        typeof picture === "string"
            ? new RegExp("^steam:" + m[1] + ":([0-9a-f]{40})$").exec(
                  picture,
              )?.[1]
            : undefined;
    const game: GameInvite = {
        name: name.slice(0, GAME_INVITE_LIMITS.name),
        steam: {
            appId: m[1],
            steamId,
            ...(typeof lobbyId === "string" ? { lobbyId } : {}),
            ...(typeof connect === "string" ? { connect } : {}),
            ...(icon ? { icon } : {}),
        },
    };
    // Only a game that would pass the receiver's checks can be invited to.
    if (!parseGameInvite(gameInvitePayload(game))) return null;
    return { key, ...game };
}

/** Media players went off: what they were playing goes too, held or blocked. */
function dropMedia(): void {
    let dropped = false;
    for (const [k, h] of held)
        if (h.media) {
            held.delete(k);
            dropped = true;
        }
    for (const [k, ev] of blocked) if (isMediaEvent(ev)) blocked.delete(k);
    if (dropped) schedulePublish();
}

/** Steam went off: its games go too, held or blocked. */
function dropSteam(): void {
    let dropped = false;
    for (const [k, h] of held)
        if (h.steam) {
            held.delete(k);
            dropped = true;
        }
    for (const [k, ev] of blocked) if (isSteamEvent(ev)) blocked.delete(k);
    // Every invite is a Steam game now.
    dropInvites(() => true);
    if (dropped) schedulePublish();
}

/** Media players report under their own ids (see electron/mediaSession.cjs). */
function isMediaEvent(ev: DesktopRichPresenceEvent): boolean {
    return ev.source === "arrpc" && ev.presenceId.startsWith("media-");
}

/** Steam games report under `steam-<appid>` (see electron/steamPresence.cjs). */
function isSteamEvent(ev: DesktopRichPresenceEvent): boolean {
    return ev.source === "arrpc" && ev.presenceId.startsWith("steam-");
}

let listWatch: ReturnType<typeof setTimeout> | null = null;

/** The game list downloads in the background; look again until it is done so
 *  the settings page shows the result. */
function watchListDownload(tries = 0): void {
    if (listWatch) clearTimeout(listWatch);
    listWatch = null;
    if (!richPresenceState.status?.games?.downloading || tries >= 20) return;
    listWatch = setTimeout(async () => {
        listWatch = null;
        try {
            richPresenceState.status = (await bridge()?.status()) ?? null;
        } catch {
            return;
        }
        watchListDownload(tries + 1);
    }, 1500);
}

/** Stop everything and take our presence off the profile (best effort). */
export function stopRichPresence(): void {
    unsubscribe?.();
    unsubscribe = null;
    void bridge()?.configure({
        local: false,
        arrpc: false,
        scan: false,
        media: false,
        steam: false,
        fake: false,
        autoRestartDiscord: false,
        userId: "",
        games: [],
    });
    clearHeld();
}

function clearHeld(): void {
    held.clear();
    blocked.clear();
    pluginWanted.clear();
    dropInvites(() => true);
    schedulePublish();
}

/** Sharing from this computer went off: plugins have their own switches. */
function clearLocal(): void {
    for (const [k, h] of held)
        if (!h.appKey.startsWith("plugin:")) held.delete(k);
    blocked.clear();
    dropInvites(() => true);
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
        return;
    }
    // Replay what the app was doing while it was blocked, rather than waiting
    // for it to say so again (the game scanner only repeats every 15 seconds).
    for (const [k, ev] of blocked) {
        if (`${ev.source}:${ev.app.id}` !== appKey) continue;
        blocked.delete(k);
        handleEvent(ev);
    }
    for (const [k, w] of pluginWanted) if (w.appKey === appKey) holdPlugin(k);
}

export function forgetApp(appKey: string): void {
    delete richPresenceState.apps[appKey];
    saveApps();
    dropInvites((i) => i.key.startsWith(`${appKey}|`));
    for (const [k, h] of held) if (h.appKey === appKey) held.delete(k);
    for (const [k, ev] of blocked)
        if (`${ev.source}:${ev.app.id}` === appKey) blocked.delete(k);
    for (const [k, w] of pluginWanted)
        if (w.appKey === appKey) pluginWanted.delete(k);
    schedulePublish();
}

// ── Steam ──────────────────────────────────────────────────────────────────
// Steam's debugging port is switched on by writing Steam's debug flag. The
// setting only turns on once that succeeded, and turning it off always tries
// to remove the flag again so the port is not left open.

export interface SteamDebugOutcome {
    ok: boolean;
    cancelled?: boolean;
    error?: string;
}

async function callSteamDebugging(
    enabled: boolean,
): Promise<SteamDebugOutcome> {
    try {
        const res = await bridge()?.setSteamDebugging(enabled);
        return res ?? { ok: false, error: "" };
    } catch (e) {
        return { ok: false, error: String((e as Error)?.message ?? e) };
    }
}

/** Re-read the desktop status, so the settings show what is really set. */
export async function refreshRichPresenceStatus(): Promise<void> {
    try {
        richPresenceState.status = (await bridge()?.status()) ?? null;
    } catch {
        // Keep whatever status we had.
    }
}

/** Write Steam's debug flag, then turn the Steam source on. On failure the
 *  setting stays off and the outcome says why. */
export async function enableSteam(): Promise<SteamDebugOutcome> {
    const res = await callSteamDebugging(true);
    if (!res.ok) return res;
    setRichPresenceSteam(true);
    await syncRichPresence();
    return res;
}

/** Turn the Steam source off, then remove Steam's debug flag. The setting is
 *  off either way; if the flag could not be removed, the outcome says so and
 *  the status is re-read so the settings do not claim it was removed. */
export async function disableSteam(): Promise<SteamDebugOutcome> {
    setRichPresenceSteam(false);
    await syncRichPresence();
    const res = await callSteamDebugging(false);
    if (!res.ok) await refreshRichPresenceStatus();
    return res;
}

// ── Plugins ────────────────────────────────────────────────────────────────
// A plugin (zam.presence) is one more app: listed in Settings, allowed when
// first seen, and switchable. It needs no desktop listener, so it works on
// every build and does not wait for "share from this computer".

/** What each plugin asked for, allowed or not, by held key. */
const pluginWanted = new Map<
    string,
    { appKey: string; name: string; entry: RpcEntry; renewable: boolean }
>();

/**
 * Publish `entry` for a plugin, replacing its earlier entry with the same id.
 * Without an expiry it is renewed until cleared.
 */
export function setPluginPresence(
    pluginId: string,
    pluginName: string,
    entry: RpcEntry,
    hasExpiry: boolean,
): void {
    const appKey = `plugin:${pluginId}`;
    const name = pluginName.trim().slice(0, 64) || pluginId;
    const now = Date.now();
    const known = richPresenceState.apps[appKey];
    if (!known) {
        richPresenceState.apps[appKey] = {
            name,
            source: "plugin",
            allowed: true,
            lastSeen: now,
        };
        saveApps();
    } else if (now - known.lastSeen > 60_000 || known.name !== name) {
        known.name = name;
        known.lastSeen = now;
        saveApps();
    }
    const heldKey = `${appKey}|${entry.id}`;
    const own = { ...entry, id: `${pluginId}-${entry.id}`.slice(0, 128) };
    own.expiry = hasExpiry
        ? Math.min(own.expiry, now + MAX_TTL_MS)
        : now + RENEWABLE_TTL_MS;
    if (own.expiry <= now) {
        clearPluginPresence(pluginId, entry.id);
        return;
    }
    pluginWanted.set(heldKey, {
        appKey,
        name,
        entry: own,
        renewable: !hasExpiry,
    });
    holdPlugin(heldKey);
}

/** Take a plugin's entry (or, with no id, all of them) off the profile. */
export function clearPluginPresence(pluginId: string, id?: string): void {
    const appKey = `plugin:${pluginId}`;
    const matches = (k: string) =>
        id === undefined ? k.startsWith(`${appKey}|`) : k === `${appKey}|${id}`;
    let dropped = false;
    for (const k of [...pluginWanted.keys()])
        if (matches(k)) pluginWanted.delete(k);
    for (const k of [...held.keys()])
        if (matches(k)) dropped = held.delete(k) || dropped;
    if (dropped) schedulePublish();
}

function holdPlugin(heldKey: string): void {
    const w = pluginWanted.get(heldKey);
    if (!w || !richPresenceState.apps[w.appKey]?.allowed) {
        held.delete(heldKey);
    } else {
        held.set(heldKey, {
            appKey: w.appKey,
            scan: false,
            media: false,
            steam: false,
            appName: w.name.toLowerCase(),
            // A renewable entry may have sat blocked past its first expiry.
            entry: w.renewable
                ? { ...w.entry, expiry: Date.now() + RENEWABLE_TTL_MS }
                : { ...w.entry },
            renewable: w.renewable,
            updated: Date.now(),
            raw: "",
        });
    }
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
        blocked.delete(heldKey);
        setInvite(heldKey, null);
        if (held.delete(heldKey)) schedulePublish();
        return;
    }

    const isScan = ev.source === "arrpc" && ev.presenceId.startsWith("scan-");
    const isMedia = isMediaEvent(ev);
    const isSteam = isSteamEvent(ev);
    const isRpc = ev.source === "arrpc" && !isScan && !isMedia && !isSteam;
    // Media players and Steam are only reported once the user has switched
    // them on, so a late report after that is dropped.
    if (isMedia && !settingsState.richPresenceMedia) return;
    if (isSteam && !settingsState.richPresenceSteam) return;

    // Remember the app the first time we see it, allowed by default, and how
    // it was found.
    const now = Date.now();
    const known = richPresenceState.apps[appKey];
    if (!known) {
        richPresenceState.apps[appKey] = {
            name,
            source: ev.source,
            allowed: true,
            lastSeen: now,
            viaScan: isScan,
            viaRpc: isRpc,
            viaMedia: isMedia,
            viaSteam: isSteam,
        };
        saveApps();
    } else if (
        now - known.lastSeen > 60_000 ||
        known.name !== name ||
        (isScan && !known.viaScan) ||
        (isRpc && !known.viaRpc) ||
        (isMedia && !known.viaMedia) ||
        (isSteam && !known.viaSteam)
    ) {
        known.name = name;
        known.lastSeen = now;
        if (isScan) known.viaScan = true;
        if (isRpc) known.viaRpc = true;
        if (isMedia) known.viaMedia = true;
        if (isSteam) known.viaSteam = true;
        saveApps();
    }

    // An app that reports for itself wins over the process scanner's guess,
    // whether the two share a client id or only a name. A Steam game is one of
    // those reports: it replaces a scanner's copy, and the scanner's later
    // reports for it are skipped (they fall under the `!h.scan` check above).
    const nameKey = name.toLowerCase();
    if (isScan) {
        for (const h of held.values())
            if (!h.scan && h.appName === nameKey) return;
    } else if (isRpc || isSteam) {
        let dropped = false;
        for (const [k, h] of held)
            if (h.scan && h.appName === nameKey) {
                held.delete(k);
                dropped = true;
            }
        if (dropped) schedulePublish();
    }

    // Kept whether or not the app is published: an invite is a deliberate
    // action, and the launch arguments only leave this computer inside one.
    if (isSteam)
        setInvite(
            heldKey,
            inviteFor(heldKey, name, ev.presence, ev.presenceId),
        );

    if (!richPresenceState.apps[appKey].allowed) {
        // Kept so allowing the app publishes at once (see setAppAllowed).
        blocked.set(heldKey, ev);
        return;
    }

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
        scan: isScan,
        media: isMedia,
        steam: isSteam,
        appName: nameKey,
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

/** createImageBitmap cannot read SVG, so draw it through an <img> instead. */
async function rasterizeSvg(blob: Blob): Promise<ImageBitmap> {
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        // Vector icons often declare no size: draw them at the target one.
        const canvas = new OffscreenCanvas(IMAGE_SIDE, IMAGE_SIDE);
        canvas.getContext("2d")!.drawImage(img, 0, 0, IMAGE_SIDE, IMAGE_SIDE);
        return await createImageBitmap(canvas);
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** Shrink to icon size, or keep the original bytes if the browser cannot. */
async function prepareImage(type: string, data: Uint8Array): Promise<File> {
    try {
        const source = new Blob([data as BlobPart], { type });
        const bitmap =
            type === "image/svg+xml"
                ? await rasterizeSvg(source)
                : await createImageBitmap(source);
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
    for (const [k, h] of held)
        if (h.entry.expiry <= now) {
            held.delete(k);
            pluginWanted.delete(k);
        }
    richPresenceState.heldCount = held.size;

    const entries = pickPublishable(
        [...held.values()].map((h) => ({ entry: h.entry, updated: h.updated })),
        now,
    );
    armTimers(entries);
    richPresenceState.active = entries;

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
    blocked.clear();
    pluginWanted.clear();
    dropInvites(() => true);
    published = false;
    chain = Promise.resolve();
    for (const timer of [publishTimer, expiryTimer])
        if (timer) clearTimeout(timer);
    if (renewTimer) clearInterval(renewTimer);
    publishTimer = expiryTimer = renewTimer = null;
    unsubscribe = null;
    richPresenceState.active = [];
}

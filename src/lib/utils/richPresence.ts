// Pure helpers for rich presence (MSC4544): the `m.rpc` profile field, the
// objects local apps send us, and the translation from Discord Rich Presence
// (what arRPC hands us) into the same shape.
//
// The MSC is unstable, so we write the field and the type ids under its
// `xyz.extera.msc4544.rpc` prefix and read either spelling.

export const RPC_STABLE_PREFIX = "m.rpc";
export const RPC_UNSTABLE_PREFIX = "xyz.extera.msc4544.rpc";

/** The MSC recommends at most four entries in the field. */
export const MAX_RPC_ENTRIES = 4;
export const MAX_RPC_BUTTONS = 3;
const MAX_TEXT = 128;
const MAX_URL = 2048;
const MAX_ID = 128;

export interface RpcButton {
    label: string;
    url: string;
    requestOpenid: boolean;
}

interface RpcBase {
    id: string;
    /** Unix ms after which the entry no longer counts as current. */
    expiry: number;
    buttons: RpcButton[];
}

export interface RpcActivity extends RpcBase {
    kind: "activity";
    name: string;
    state?: string;
    details?: string;
    since?: number;
    until?: number;
    largeIconUrl?: string;
    smallIconUrl?: string;
    largeIconTooltip?: string;
    smallIconTooltip?: string;
}

export interface RpcMusic extends RpcBase {
    kind: "music";
    track: string;
    artist?: string;
    album?: string;
    playerName?: string;
    coverUrl?: string;
    progress?: { since: number; until: number };
}

export type RpcEntry = RpcActivity | RpcMusic;

/** Who sent an entry (MSC4544's AppIdentifierObject). */
export interface RpcApp {
    id: string;
    name: string;
}

function str(value: unknown, max = MAX_TEXT): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, max) : undefined;
}

function ms(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) && value > 0
        ? Math.floor(value)
        : undefined;
}

function mxc(value: unknown): string | undefined {
    const s = str(value, MAX_URL);
    return s && /^mxc:\/\/[^/\s]+\/[^/\s]+$/.test(s) ? s : undefined;
}

/** http(s) only: a button must never carry a javascript:, file: or app URL. */
export function safeWebUrl(value: unknown): string | undefined {
    const s = str(value, MAX_URL);
    if (!s) return undefined;
    // The OpenID placeholder is not a valid URL character run, so check the
    // scheme by hand instead of parsing.
    return /^https?:\/\/[^\s]+$/i.test(s) ? s : undefined;
}

function parseButtons(value: unknown): RpcButton[] {
    if (!Array.isArray(value)) return [];
    const out: RpcButton[] = [];
    for (const raw of value) {
        if (!raw || typeof raw !== "object") continue;
        const { label, url, request_openid } = raw as Record<string, unknown>;
        const l = str(label, 64);
        const u = safeWebUrl(url);
        if (!l || !u) continue;
        out.push({ label: l, url: u, requestOpenid: request_openid === true });
        if (out.length >= MAX_RPC_BUTTONS) break;
    }
    return out;
}

/** `m.rpc.activity`, `xyz.extera.msc4544.rpc.activity`... to "activity". */
function kindOf(type: unknown): "activity" | "music" | null {
    if (typeof type !== "string") return null;
    for (const prefix of [RPC_STABLE_PREFIX, RPC_UNSTABLE_PREFIX]) {
        if (type === `${prefix}.activity`) return "activity";
        if (type === `${prefix}.music`) return "music";
    }
    return null;
}

/**
 * One PresenceDataObject as we understand it, or null when it is malformed.
 * Does not look at the expiry: callers decide what counts as current.
 */
export function parseRpcEntry(raw: unknown): RpcEntry | null {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const kind = kindOf(o.type);
    const id = str(o.id, MAX_ID);
    const expiry = ms(o.expiry);
    if (!kind || !id || expiry === undefined) return null;
    const base = { id, expiry, buttons: parseButtons(o.buttons) };

    if (kind === "activity") {
        const name = str(o.name);
        if (!name) return null;
        const large = mxc(o.large_icon_url);
        const small = large ? mxc(o.small_icon_url) : undefined;
        return {
            kind,
            ...base,
            name,
            state: str(o.state),
            details: str(o.details),
            since: ms(o.since),
            until: ms(o.until),
            largeIconUrl: large,
            smallIconUrl: small,
            largeIconTooltip: large ? str(o.large_icon_tooltip) : undefined,
            smallIconTooltip: small ? str(o.small_icon_tooltip) : undefined,
        };
    }

    const track = str(o.track);
    if (!track) return null;
    let progress: RpcMusic["progress"];
    if (o.progress && typeof o.progress === "object") {
        const since = ms((o.progress as Record<string, unknown>).since);
        const until = ms((o.progress as Record<string, unknown>).until);
        // Both bounds or neither.
        if (since !== undefined && until !== undefined && until > since)
            progress = { since, until };
    }
    return {
        kind,
        ...base,
        track,
        artist: str(o.artist),
        album: str(o.album),
        playerName: str(o.player_name),
        coverUrl: mxc(o.cover_url),
        progress,
    };
}

/** The entries in a profile's `m.rpc` value that are still current. */
export function parseRpcField(value: unknown, now: number): RpcEntry[] {
    if (!Array.isArray(value)) return [];
    const out: RpcEntry[] = [];
    for (const raw of value) {
        const entry = parseRpcEntry(raw);
        if (entry && entry.expiry > now) out.push(entry);
        if (out.length >= MAX_RPC_ENTRIES) break;
    }
    return out;
}

/** The soonest expiry among `entries`, or null if there are none. */
export function nextRpcExpiry(entries: readonly RpcEntry[]): number | null {
    let soonest: number | null = null;
    for (const e of entries) {
        if (soonest === null || e.expiry < soonest) soonest = e.expiry;
    }
    return soonest;
}

/** An entry back into the wire shape, under the unstable type id. */
export function serializeRpcEntry(entry: RpcEntry): Record<string, unknown> {
    const type = `${RPC_UNSTABLE_PREFIX}.${entry.kind}`;
    const out: Record<string, unknown> = {
        id: entry.id,
        type,
        expiry: entry.expiry,
    };
    if (entry.buttons.length > 0) {
        out.buttons = entry.buttons.map((b) => ({
            label: b.label,
            url: b.url,
            ...(b.requestOpenid ? { request_openid: true } : {}),
        }));
    }
    const set = (key: string, value: unknown) => {
        if (value !== undefined) out[key] = value;
    };
    if (entry.kind === "activity") {
        set("name", entry.name);
        set("state", entry.state);
        set("details", entry.details);
        set("since", entry.since);
        set("until", entry.until);
        set("large_icon_url", entry.largeIconUrl);
        set("large_icon_tooltip", entry.largeIconTooltip);
        set("small_icon_url", entry.smallIconUrl);
        set("small_icon_tooltip", entry.smallIconTooltip);
    } else {
        set("track", entry.track);
        set("artist", entry.artist);
        set("album", entry.album);
        set("player_name", entry.playerName);
        set("cover_url", entry.coverUrl);
        set("progress", entry.progress);
    }
    return out;
}

// ── Discord Rich Presence (arRPC) ──────────────────────────────────────────

interface DiscordActivity {
    name?: unknown;
    details?: unknown;
    state?: unknown;
    type?: unknown;
    application_id?: unknown;
    timestamps?: { start?: unknown; end?: unknown };
    assets?: { large_text?: unknown; small_text?: unknown };
    party?: { size?: unknown };
    buttons?: unknown;
    metadata?: { button_urls?: unknown };
}

/**
 * Turn a Discord activity (as arRPC dispatches it) into an entry that lives
 * until `expiry`. `presenceId` is stable per sending connection so a later
 * update replaces the earlier one. Returns null when there is nothing worth
 * showing. Discord's asset keys are not Matrix media, so icons are left out.
 */
export function discordActivityToEntry(
    raw: unknown,
    presenceId: string,
    appName: string,
    expiry: number,
): RpcEntry | null {
    if (!raw || typeof raw !== "object") return null;
    const a = raw as DiscordActivity;
    const details = str(a.details);
    const state = str(a.state);
    const start = ms(a.timestamps?.start);
    const end = ms(a.timestamps?.end);
    const base = {
        id: presenceId.slice(0, MAX_ID),
        expiry,
        buttons: discordButtons(a),
    };

    // Discord's "Listening to": details is the track, state the artist.
    if (a.type === 2 && details) {
        return {
            kind: "music",
            ...base,
            track: details,
            artist: state?.replace(/^by\s+/i, ""),
            album: str(a.assets?.large_text),
            playerName: str(a.name) ?? appName,
            progress:
                start !== undefined && end !== undefined && end > start
                    ? { since: start, until: end }
                    : undefined,
        };
    }

    const name = str(a.name) ?? appName;
    if (!name) return null;
    // MSC4544 has no party field; show it the way Discord does, after the state.
    const party = partyText(a.party?.size);
    // Nor an activity type: say it in the state instead of "Playing".
    const verb = ACTIVITY_VERBS[a.type as number];
    return {
        kind: "activity",
        ...base,
        name,
        details,
        state:
            [verb, state && (verb ? `· ${state}` : state), party]
                .filter(Boolean)
                .join(" ") || undefined,
        since: start,
        until: end,
    };
}

/** Discord activity types other than playing (0) and listening (2, music). */
const ACTIVITY_VERBS: Record<number, string> = {
    1: "Streaming",
    3: "Watching",
    5: "Competing",
};

/** Discord's party `size` ([current, max]) as "(3 of 4)", or undefined. */
function partyText(size: unknown): string | undefined {
    if (!Array.isArray(size) || size.length < 2) return undefined;
    const [cur, max] = size;
    const ok = (n: unknown): n is number =>
        typeof n === "number" && Number.isInteger(n) && n > 0 && n < 1e6;
    return ok(cur) && ok(max) && cur <= max ? `(${cur} of ${max})` : undefined;
}

function discordButtons(a: DiscordActivity): RpcButton[] {
    const labels = Array.isArray(a.buttons) ? a.buttons : [];
    const urls = Array.isArray(a.metadata?.button_urls)
        ? (a.metadata?.button_urls as unknown[])
        : [];
    const out: RpcButton[] = [];
    for (let i = 0; i < labels.length && out.length < MAX_RPC_BUTTONS; i++) {
        // arRPC flattens buttons to labels plus a parallel list of URLs; a raw
        // client may still send {label, url} objects.
        const entry = labels[i];
        const label =
            typeof entry === "string"
                ? str(entry, 64)
                : str((entry as { label?: unknown })?.label, 64);
        const url = safeWebUrl(
            typeof entry === "object" && entry
                ? (entry as { url?: unknown }).url
                : urls[i],
        );
        if (label && url) out.push({ label, url, requestOpenid: false });
    }
    return out;
}

// ── Choosing what to publish ───────────────────────────────────────────────

/**
 * The entries to put in the field: current ones, the most recently updated
 * first, at most {@link MAX_RPC_ENTRIES}.
 */
export function pickPublishable(
    candidates: readonly { entry: RpcEntry; updated: number }[],
    now: number,
): RpcEntry[] {
    return candidates
        .filter((c) => c.entry.expiry > now)
        .sort((a, b) => b.updated - a.updated)
        .slice(0, MAX_RPC_ENTRIES)
        .map((c) => c.entry);
}

/** Fill `{openid_data}` in a button URL with the URL-encoded token JSON. */
export function fillOpenidPlaceholder(url: string, token: unknown): string {
    return url.replace(
        /\{openid_data\}/g,
        encodeURIComponent(JSON.stringify(token)),
    );
}

// ── Pictures ───────────────────────────────────────────────────────────────

/** The pictures a Discord activity names, and their hover text. */
export interface DiscordImages {
    large?: string;
    small?: string;
    largeText?: string;
    smallText?: string;
}

export function discordImageRefs(raw: unknown): DiscordImages {
    const assets = (raw as { assets?: Record<string, unknown> } | null)?.assets;
    if (!assets || typeof assets !== "object") return {};
    return {
        large: str(assets.large_image, 1024),
        small: str(assets.small_image, 1024),
        largeText: str(assets.large_text),
        smallText: str(assets.small_text),
    };
}

/**
 * `entry` with its pictures set from uploaded media: `large`/`small` are mxc
 * URIs. A small icon only goes with a large one, as the MSC requires, and a
 * music entry has just the one cover.
 */
export function withIcons(
    entry: RpcEntry,
    icons: { large?: string; small?: string },
    text: DiscordImages,
): RpcEntry {
    if (entry.kind === "music") return { ...entry, coverUrl: icons.large };
    return {
        ...entry,
        largeIconUrl: icons.large,
        largeIconTooltip: icons.large ? text.largeText : undefined,
        smallIconUrl: icons.large ? icons.small : undefined,
        smallIconTooltip:
            icons.large && icons.small ? text.smallText : undefined,
    };
}

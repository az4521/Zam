// Pure helpers for extended (MSC4133) profile fields: pronouns (MSC4247),
// biography (MSC4440), status (MSC4426), username colour (MSC4522), timezone
// (MSC4175), banner (MSC4427) and links (MSC4462).
//
// Most of these MSCs are not in a released spec yet, so each field lives under
// its unstable key today. Reads accept either key (stable wins); writes go to
// the unstable key, plus the stable one when the profile already carries it so
// the two never drift apart. `legacy` keys are other clients' pre-MSC formats:
// they are shown on other people's profiles but never written or edited.
import { t } from "$lib/i18n";

export interface FieldKeys {
    stable: string;
    unstable?: string;
    legacy?: readonly string[];
}

export const PROFILE_FIELDS = {
    pronouns: { stable: "m.pronouns", unstable: "io.fsky.nyx.pronouns" },
    biography: {
        stable: "m.biography",
        unstable: "gay.fomx.biography",
        legacy: ["chat.commet.profile_bio"],
    },
    status: {
        stable: "m.status",
        unstable: "org.matrix.msc4426.status",
        legacy: ["chat.commet.profile_status"],
    },
    call: { stable: "m.call", unstable: "org.matrix.msc4426.call" },
    usernameColour: {
        stable: "m.color_preference",
        unstable: "eu.she-a.color",
    },
    timezone: { stable: "m.tz", unstable: "us.cloke.msc4175.tz" },
    banner: { stable: "m.banner_url", unstable: "chat.commet.profile_banner" },
    connections: { stable: "m.connections", unstable: "fyi.cisnt.connections" },
} as const satisfies Record<string, FieldKeys>;

export type ExtendedProfile = Record<string, unknown>;

export interface FieldOp {
    key: string;
    /** `null` deletes the field. */
    value: unknown | null;
}

/** Keys this client reads and writes for a field (not the read-only legacy ones). */
function ownKeys(field: FieldKeys): string[] {
    return field.unstable ? [field.stable, field.unstable] : [field.stable];
}

function present(value: unknown): boolean {
    return value !== undefined && value !== null;
}

/** The stored value under a stable/unstable key, preferring the stable one. */
export function readField(
    profile: ExtendedProfile | null | undefined,
    field: FieldKeys,
): unknown {
    if (!profile) return undefined;
    for (const key of ownKeys(field)) {
        if (present(profile[key])) return profile[key];
    }
    return undefined;
}

/** Like {@link readField}, but falls back to other clients' legacy keys. */
export function readFieldWithLegacy(
    profile: ExtendedProfile | null | undefined,
    field: FieldKeys,
): unknown {
    const value = readField(profile, field);
    if (present(value) || !profile) return value;
    for (const key of field.legacy ?? []) {
        if (present(profile[key])) return profile[key];
    }
    return undefined;
}

/** The PUT/DELETE operations needed to set (or clear, with `null`) a field. */
export function planFieldWrite(
    profile: ExtendedProfile | null | undefined,
    field: FieldKeys,
    value: unknown | null,
): FieldOp[] {
    if (value === null) {
        return ownKeys(field)
            .filter((key) => profile?.[key] !== undefined)
            .map((key) => ({ key, value: null }));
    }
    const keys = new Set<string>([field.unstable ?? field.stable]);
    if (profile?.[field.stable] !== undefined) keys.add(field.stable);
    return [...keys].map((key) => ({ key, value }));
}

// ── Pronouns (MSC4247) ─────────────────────────────────────────────────────

export interface Pronoun {
    summary: string;
    language?: string;
}

export const MAX_PRONOUNS = 10;
export const MAX_PRONOUN_LENGTH = 40;

export function parsePronouns(value: unknown): Pronoun[] {
    if (!Array.isArray(value)) return [];
    const out: Pronoun[] = [];
    for (const entry of value) {
        if (!entry || typeof entry !== "object") continue;
        const { summary, language } = entry as Record<string, unknown>;
        if (typeof summary !== "string" || !summary.trim()) continue;
        out.push({
            summary: summary.trim(),
            ...(typeof language === "string" ? { language } : {}),
        });
    }
    return out;
}

/** Comma-separated editable form, in preference order. */
export function pronounsToText(pronouns: Pronoun[]): string {
    return pronouns.map((p) => p.summary).join(", ");
}

/**
 * Turn the editable text back into entries. Entries whose summary already
 * existed keep their original language tag; new ones get `defaultLanguage`.
 */
export function textToPronouns(
    text: string,
    existing: Pronoun[],
    defaultLanguage: string,
): Pronoun[] {
    const seen = new Set<string>();
    const out: Pronoun[] = [];
    for (const raw of text.split(",")) {
        const summary = raw.trim().slice(0, MAX_PRONOUN_LENGTH);
        if (!summary || seen.has(summary)) continue;
        seen.add(summary);
        const language =
            existing.find((p) => p.summary === summary)?.language ??
            defaultLanguage;
        out.push({ summary, language });
        if (out.length >= MAX_PRONOUNS) break;
    }
    return out;
}

// ── Biography (MSC4440) ────────────────────────────────────────────────────

export const MAX_BIOGRAPHY_LENGTH = 2000;

/**
 * The plaintext form of a biography: the first `m.text` entry without HTML,
 * or Commet's older `{ body }` object.
 */
export function parseBiography(value: unknown): string {
    if (!value || typeof value !== "object") return "";
    const record = value as Record<string, unknown>;
    const text = record["m.text"];
    if (Array.isArray(text)) {
        for (const entry of text) {
            if (!entry || typeof entry !== "object") continue;
            const { body, mimetype } = entry as Record<string, unknown>;
            if (
                typeof body === "string" &&
                (mimetype === undefined || mimetype === "text/plain")
            ) {
                return body;
            }
        }
        return "";
    }
    return typeof record.body === "string" ? record.body : "";
}

export function buildBiography(text: string): unknown | null {
    const body = text.trim();
    return body ? { "m.text": [{ body }] } : null;
}

// ── Status (MSC4426) ───────────────────────────────────────────────────────

export interface UserStatus {
    text: string;
    /** Empty for Commet's text-only legacy statuses. */
    emoji: string;
}

export const MAX_STATUS_TEXT_LENGTH = 64;
export const MAX_STATUS_EMOJI_LENGTH = 8;

export function parseStatus(value: unknown): UserStatus | null {
    if (typeof value === "string") {
        // Commet's legacy status is a bare string.
        return value.trim() ? { text: value.trim(), emoji: "" } : null;
    }
    if (!value || typeof value !== "object") return null;
    const { text, emoji } = value as Record<string, unknown>;
    if (typeof text !== "string" || typeof emoji !== "string") return null;
    return { text, emoji };
}

/** Both parts are required by the MSC, so half a status is a problem. */
export function statusProblem(text: string, emoji: string): string | null {
    const hasText = text.trim() !== "";
    const hasEmoji = emoji.trim() !== "";
    if (hasText === hasEmoji) return null;
    return t("extendedProfile.aStatusNeedsBothAnEmoji");
}

/** One-line form of a status, "🌴 On holiday", for clients without emoji fields. */
export function formatStatusMessage(status: UserStatus | null): string {
    return status ? `${status.emoji} ${status.text}`.trim() : "";
}

/**
 * Whether a presence message just repeats the profile status. Our own client
 * mirrors the status into the presence message ("🌴 On holiday"), so showing
 * both would print it twice. Whitespace is ignored, and a message equal to
 * just the status text counts too.
 */
export function isSameStatus(
    presenceMessage: string | null | undefined,
    status: UserStatus | null,
): boolean {
    const message = presenceMessage?.trim();
    if (!message || !status) return false;
    return (
        message === formatStatusMessage(status) ||
        message === status.text.trim()
    );
}

/**
 * Sable and Commet only show a status stored under Commet's own key, as one
 * plain string, so mirror the status there ("🌴 On holiday"). Clearing deletes
 * it, but only if it exists.
 */
export function planLegacyStatusMirror(
    profile: ExtendedProfile | null | undefined,
    status: UserStatus | null,
): FieldOp[] {
    const key = PROFILE_FIELDS.status.legacy[0];
    if (!status) {
        return profile?.[key] !== undefined ? [{ key, value: null }] : [];
    }
    return [{ key, value: formatStatusMessage(status) }];
}

export function buildStatus(text: string, emoji: string): UserStatus | null {
    if (!text.trim() || !emoji.trim()) return null;
    return { text: text.trim(), emoji: emoji.trim() };
}

// ── Call presence (MSC4426 m.call) ─────────────────────────────────────────

/** A call older than this is assumed to be a stale field, not a real call. */
const MAX_PLAUSIBLE_CALL_MS = 24 * 60 * 60 * 1000;

/** `call_joined_ts` in seconds, or null if the field is absent or invalid. */
export function parseCallJoinedTs(value: unknown): number | null {
    if (!value || typeof value !== "object") return null;
    const ts = (value as Record<string, unknown>).call_joined_ts;
    return typeof ts === "number" && Number.isFinite(ts) && ts > 0 ? ts : null;
}

export function buildCall(joinedAtMs: number): { call_joined_ts: number } {
    return { call_joined_ts: Math.floor(joinedAtMs / 1000) };
}

/**
 * "In a call for 12 min" text, or null when the timestamp is implausible
 * (a call that never got cleared shouldn't read "for 3 days").
 */
export function describeCall(joinedTs: number, nowMs: number): string | null {
    const elapsed = nowMs - joinedTs * 1000;
    if (elapsed > MAX_PLAUSIBLE_CALL_MS) return null;
    const minutes = Math.max(0, Math.floor(elapsed / 60_000));
    if (minutes < 1) return t("extendedProfile.inACall");
    if (minutes < 60) return t("extendedProfile.inACallForMin", { minutes });
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest
        ? t("extendedProfile.inACallForHMin", { hours, minutes: rest })
        : t("extendedProfile.inACallForH", { hours });
}

// ── Username colour (MSC4522) ──────────────────────────────────────────────

export interface ColourPreference {
    on_dark: string;
    on_light: string;
}

export const DEFAULT_COLOUR_ON_DARK = "#f0abfc";
export const DEFAULT_COLOUR_ON_LIGHT = "#86198f";

const HEX_COLOUR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidColour(value: string): boolean {
    return HEX_COLOUR.test(value.trim());
}

/** `#rgb` / `#rrggbb` to lower-case `#rrggbb`, or null if it is neither. */
export function normalizeColour(value: unknown): string | null {
    if (typeof value !== "string" || !isValidColour(value)) return null;
    const hex = value.trim().slice(1).toLowerCase();
    const full =
        hex.length === 3
            ? hex
                  .split("")
                  .map((c) => c + c)
                  .join("")
            : hex;
    return `#${full}`;
}

/** Both halves are needed; a half-valid preference is ignored. */
export function parseColourPreference(value: unknown): ColourPreference | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const onDark = normalizeColour(record.on_dark);
    const onLight = normalizeColour(record.on_light);
    return onDark && onLight ? { on_dark: onDark, on_light: onLight } : null;
}

// ── Timezone (MSC4175) ─────────────────────────────────────────────────────

/** An IANA timezone name the runtime recognises, or null. */
export function parseTimezone(value: unknown): string | null {
    if (typeof value !== "string" || !value.trim()) return null;
    const zone = value.trim();
    try {
        new Intl.DateTimeFormat("en", { timeZone: zone });
        return zone;
    } catch {
        return null;
    }
}

/** Current wall-clock time in `zone`, e.g. "14:05", or null if unknown. */
export function formatLocalTime(zone: string, now: Date): string | null {
    if (!parseTimezone(zone)) return null;
    return new Intl.DateTimeFormat(undefined, {
        timeZone: zone,
        hour: "numeric",
        minute: "2-digit",
    }).format(now);
}

/** Every zone the runtime knows, for suggestions. Empty on old engines. */
export function knownTimezones(): string[] {
    const intl = Intl as unknown as {
        supportedValuesOf?: (key: string) => string[];
    };
    try {
        return intl.supportedValuesOf?.("timeZone") ?? [];
    } catch {
        return [];
    }
}

/** Region for zones with no "/" in their name, such as "UTC". */
export const OTHER_REGION = t("extendedProfile.other");

/** "Europe/London" to { region: "Europe", city: "London" }. */
export function splitTimezone(zone: string): { region: string; city: string } {
    const slash = zone.indexOf("/");
    return slash === -1
        ? { region: OTHER_REGION, city: zone }
        : { region: zone.slice(0, slash), city: zone.slice(slash + 1) };
}

/** Inverse of {@link splitTimezone}. */
export function joinTimezone(region: string, city: string): string {
    return region === OTHER_REGION ? city : `${region}/${city}`;
}

/** "Buenos_Aires" to "Buenos Aires". */
export function timezoneCityLabel(city: string): string {
    return city.replaceAll("_", " ");
}

export interface TimezoneGroups {
    /** Region names, sorted, with "Other" last. */
    regions: string[];
    /** Sorted city names per region. */
    cities: Record<string, string[]>;
}

/**
 * Zones grouped into regions for a two-step picker. `extra` zones (such as one
 * already saved on the profile) are included even if the runtime's list omits
 * them, so a stored alias like Asia/Calcutta never vanishes from the picker.
 */
export function groupTimezones(
    zones: readonly string[],
    extra: ReadonlyArray<string | null | undefined> = [],
): TimezoneGroups {
    const sets = new Map<string, Set<string>>();
    for (const zone of [...zones, ...extra]) {
        if (!zone) continue;
        const { region, city } = splitTimezone(zone);
        if (!sets.has(region)) sets.set(region, new Set());
        sets.get(region)!.add(city);
    }
    const regions = [...sets.keys()].sort((a, b) =>
        a === OTHER_REGION ? 1 : b === OTHER_REGION ? -1 : a.localeCompare(b),
    );
    const cities: Record<string, string[]> = {};
    for (const region of regions) {
        cities[region] = [...sets.get(region)!].sort((a, b) =>
            a.localeCompare(b),
        );
    }
    return { regions, cities };
}

// ── Banner (MSC4427) ───────────────────────────────────────────────────────

/** An mxc URI. Some homeservers return Commet's value wrapped in quotes. */
export function parseBanner(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const uri = value.trim().replace(/^"(.*)"$/, "$1");
    return uri.startsWith("mxc://") ? uri : null;
}

// ── Links (MSC4462) ────────────────────────────────────────────────────────

export interface ProfileConnection {
    description: string;
    uri: string;
}

export const MAX_CONNECTIONS = 20;
export const MAX_CONNECTION_DESCRIPTION = 200;

const ALLOWED_LINK_SCHEMES = new Set(["http:", "https:", "mailto:", "matrix:"]);

/** Whether `uri` parses and uses a scheme the MSC allows. */
export function isSafeConnectionUri(uri: string): boolean {
    try {
        return ALLOWED_LINK_SCHEMES.has(new URL(uri.trim()).protocol);
    } catch {
        return false;
    }
}

/** Valid, truncated links from a profile. Unsafe entries are dropped. */
export function parseConnections(value: unknown): ProfileConnection[] {
    if (!Array.isArray(value)) return [];
    const out: ProfileConnection[] = [];
    for (const entry of value) {
        if (!entry || typeof entry !== "object") continue;
        const { description, uri } = entry as Record<string, unknown>;
        if (typeof uri !== "string" || !isSafeConnectionUri(uri)) continue;
        out.push({
            description:
                typeof description === "string"
                    ? description.slice(0, MAX_CONNECTION_DESCRIPTION)
                    : "",
            uri: uri.trim(),
        });
        if (out.length >= MAX_CONNECTIONS) break;
    }
    return out;
}

/** Problem with an edited list, or null. Blank rows are ignored. */
export function connectionsProblem(rows: ProfileConnection[]): string | null {
    const filled = rows.filter((r) => r.uri.trim() || r.description.trim());
    if (filled.length > MAX_CONNECTIONS) {
        return t("extendedProfile.atMostLinks", { MAX_CONNECTIONS });
    }
    for (const row of filled) {
        if (!isSafeConnectionUri(row.uri)) {
            return t("extendedProfile.linksMustBeHttpHttpsMailto");
        }
    }
    return null;
}

export function buildConnections(
    rows: ProfileConnection[],
): ProfileConnection[] | null {
    const out = rows
        .filter((r) => r.uri.trim())
        .map((r) => ({
            description: r.description
                .trim()
                .slice(0, MAX_CONNECTION_DESCRIPTION),
            uri: r.uri.trim(),
        }));
    return out.length ? out : null;
}

/**
 * Pure helpers for MSC3949 power level tags: a room state event that names
 * and styles power levels (`{ "50": { name, color?, icon? } }`). Parsing is
 * defensive because the content comes from any room member's client.
 * SDK-free so the logic can be unit-tested.
 */

/** Stable event type (MSC3949 once accepted). */
export const POWER_LEVEL_TAGS_EVENT_TYPE = "m.room.power_level_tags";
/** Unstable type this client writes; the stable one is preferred on read. */
export const UNSTABLE_POWER_LEVEL_TAGS_EVENT_TYPE =
    "in.cinny.room.power_level_tags";

const MAX_NAME_LENGTH = 64;
const MAX_ICON_KEY_LENGTH = 256;
const INTEGER_KEY = /^(0|-?[1-9]\d*)$/;
const COLOR_6 = /^#[0-9a-fA-F]{6}$/;
const COLOR_3 = /^#[0-9a-fA-F]{3}$/;

export interface PowerLevelTagIcon {
    /** An emoji, or an `mxc://` URI for an image. */
    key: string;
    /** Image info (w, h, mimetype, size) when the icon is an image. */
    info?: Record<string, unknown>;
}

export interface PowerLevelTag {
    name: string;
    /** Normalised `#rrggbb`, lowercase. */
    color?: string;
    icon?: PowerLevelTagIcon;
}

/** Tags keyed by power level. Negative levels are allowed. */
export type PowerLevelTags = Record<number, PowerLevelTag>;

/** A resolved tag together with the level it was defined for. */
export interface ResolvedPowerLevelTag {
    level: number;
    tag: PowerLevelTag;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

/** Truncate to `max` code points so a surrogate pair is never split. */
function capLength(value: string, max: number): string {
    const chars = Array.from(value);
    return chars.length > max ? chars.slice(0, max).join("") : value;
}

/**
 * Validate a colour and return it as lowercase `#rrggbb`, or undefined.
 * The result is safe to put in a style: only a validated hex ever comes out.
 */
export function safeTagColor(color: unknown): string | undefined {
    if (typeof color !== "string") return undefined;
    if (COLOR_6.test(color)) return color.toLowerCase();
    if (COLOR_3.test(color)) {
        const [r, g, b] = color.slice(1).toLowerCase();
        return `#${r}${r}${g}${g}${b}${b}`;
    }
    return undefined;
}

function parseIcon(value: unknown): PowerLevelTagIcon | undefined {
    if (!isPlainObject(value) || typeof value.key !== "string")
        return undefined;
    const key = capLength(value.key.trim(), MAX_ICON_KEY_LENGTH);
    if (key === "") return undefined;
    const icon: PowerLevelTagIcon = { key };
    if (isPlainObject(value.info)) icon.info = value.info;
    return icon;
}

function parseTag(value: unknown): PowerLevelTag | undefined {
    if (!isPlainObject(value) || typeof value.name !== "string") {
        return undefined;
    }
    const name = capLength(value.name.trim(), MAX_NAME_LENGTH);
    if (name === "") return undefined;
    const tag: PowerLevelTag = { name };
    const color = safeTagColor(value.color);
    if (color !== undefined) tag.color = color;
    const icon = parseIcon(value.icon);
    if (icon !== undefined) tag.icon = icon;
    return tag;
}

/**
 * Parse `m.room.power_level_tags` / unstable content. Keys that are not
 * integer strings and entries without a usable name are dropped; unusable
 * optional fields are dropped without losing the tag.
 */
export function parsePowerLevelTags(content: unknown): PowerLevelTags {
    const tags: PowerLevelTags = {};
    if (!isPlainObject(content)) return tags;
    for (const key of Object.keys(content)) {
        if (!INTEGER_KEY.test(key)) continue;
        const level = Number(key);
        if (!Number.isSafeInteger(level)) continue;
        const tag = parseTag(content[key]);
        if (tag !== undefined) tags[level] = tag;
    }
    return tags;
}

/** Defined levels, highest first. */
export function sortedTagLevels(tags: PowerLevelTags): number[] {
    return Object.keys(tags)
        .map(Number)
        .sort((a, b) => b - a);
}

/**
 * The tag that applies to `level`: its own tag, else the nearest lower
 * defined level's tag, else null (no tag at or below it).
 */
export function tagForPowerLevel(
    tags: PowerLevelTags,
    level: number,
): ResolvedPowerLevelTag | null {
    if (!Number.isSafeInteger(level)) return null;
    if (Object.prototype.hasOwnProperty.call(tags, level)) {
        return { level, tag: tags[level] };
    }
    for (const candidate of sortedTagLevels(tags)) {
        if (candidate < level)
            return { level: candidate, tag: tags[candidate] };
    }
    return null;
}

/** Tags used when a room has no tags event: 0 Member, 50 Moderator, 100 Admin. */
export function defaultPowerLevelTags(labels: {
    admin: string;
    moderator: string;
    member: string;
}): PowerLevelTags {
    return {
        100: { name: labels.admin },
        50: { name: labels.moderator },
        0: { name: labels.member },
    };
}

/** Event content for `tags`: string keys, undefined fields omitted. */
export function serializePowerLevelTags(
    tags: PowerLevelTags,
): Record<string, PowerLevelTag> {
    const out: Record<string, PowerLevelTag> = {};
    for (const level of sortedTagLevels(tags)) {
        const tag = tags[level];
        const entry: PowerLevelTag = { name: tag.name };
        if (tag.color !== undefined) entry.color = tag.color;
        if (tag.icon !== undefined) {
            const icon: PowerLevelTagIcon = { key: tag.icon.key };
            if (tag.icon.info !== undefined) icon.info = tag.icon.info;
            entry.icon = icon;
        }
        out[String(level)] = entry;
    }
    return out;
}

/** Whether the icon is an image (an `mxc://` URI) rather than an emoji. */
export function isMxcIcon(icon: PowerLevelTagIcon | null | undefined): boolean {
    return !!icon && icon.key.startsWith("mxc://");
}

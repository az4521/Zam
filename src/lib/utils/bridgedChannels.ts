// Discord channel tags bridged by ZDMB (Zam Discord-Matrix Bridge).
//
// Every bridged room carries `moe.crafty.zdmb.channel: { type, name }`, both
// as a state event in the room and on its m.space.child event (readable
// before joining). `type` is the Discord channel type; `name` is the room's
// name without the bridge's "[🔊] " / "[⛓️] " prefix (or its custom name).

export const CHANNEL_KEY = "moe.crafty.zdmb.channel";

export const BRIDGED_CHANNEL_TYPES = [
    "text",
    "voice",
    "stage",
    "announcement",
    "forum",
    "media",
    "public_thread",
    "private_thread",
    "announcement_thread",
] as const;

export type BridgedChannelType = (typeof BRIDGED_CHANNEL_TYPES)[number];

export interface BridgedChannel {
    /** null for a type this client does not know yet (a newer bridge). */
    type: BridgedChannelType | null;
    /** The bridge's clean name; empty when it sent none. */
    name: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Validate a channel tag (the state event's content, or the value under
 *  CHANNEL_KEY on an m.space.child event). */
export function parseBridgedChannel(content: unknown): BridgedChannel | null {
    if (!isRecord(content)) return null;
    const type = content["type"];
    const name = content["name"];
    if (typeof type !== "string" || !type) return null;
    return {
        type: (BRIDGED_CHANNEL_TYPES as readonly string[]).includes(type)
            ? (type as BridgedChannelType)
            : null,
        name: typeof name === "string" ? name.trim() : "",
    };
}

/** The channel tag on an m.space.child event, or null for a child without
 *  one or that was removed from the space (no via). */
export function parseSpaceChildChannel(
    childContent: unknown,
): BridgedChannel | null {
    if (!isRecord(childContent)) return null;
    const via = childContent["via"];
    if (!Array.isArray(via) || via.length === 0) return null;
    return parseBridgedChannel(childContent[CHANNEL_KEY]);
}

/** Which icon a channel row shows. */
export type ChannelIconKind =
    | "text"
    | "video"
    | "voice"
    | "stage"
    | "announcement"
    | "forum"
    | "media"
    | "thread"
    | "private_thread";

/**
 * The bridge's type wins; otherwise fall back to what the room itself says
 * (a thread by its thread-parent marker, a call room by its room type).
 */
export function channelIconKind(
    type: BridgedChannelType | null | undefined,
    fallback: { isThread?: boolean; isVideo?: boolean } = {},
): ChannelIconKind {
    switch (type) {
        case "text":
            return "text";
        case "voice":
            return "voice";
        case "stage":
            return "stage";
        case "announcement":
            return "announcement";
        case "forum":
            return "forum";
        case "media":
            return "media";
        case "public_thread":
        case "announcement_thread":
            return "thread";
        case "private_thread":
            return "private_thread";
    }
    if (fallback.isThread) return "thread";
    if (fallback.isVideo) return "video";
    return "text";
}

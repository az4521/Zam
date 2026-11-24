// Pure helpers for showing an open Matrix room widget in rich presence (MSC4544
// `m.rpc`). The entry names the widget and nothing else: never the room, its ID
// or the widget URL, since the profile is public.

import type { RpcActivity } from "$lib/utils/richPresence";

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MAX_NAME = 128;
const MXC = /^mxc:\/\/[^/\s]+\/[^/\s]+$/;

/**
 * A stable short id for one widget in one room: FNV-1a over `roomId|widgetId`,
 * as 8 hex digits. Hashing keeps the room ID off the profile.
 */
export function widgetPresenceKey(roomId: string, widgetId: string): string {
    const s = `${roomId}|${widgetId}`;
    let h = FNV_OFFSET;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, FNV_PRIME) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
}

/**
 * The activity entry for an open widget, or null when the widget has no name
 * to show (then nothing is published). Only the widget's own name, its avatar
 * (when it is an mxc URL) and the timestamps leave the client.
 */
export function widgetPresenceEntry(
    widget: { name: string; avatarUrl: string | null },
    key: string,
    since: number,
    expiry: number,
): RpcActivity | null {
    const name = widget.name.trim().slice(0, MAX_NAME);
    if (!name) return null;
    const entry: RpcActivity = {
        kind: "activity",
        id: `widget-${key}`,
        name,
        since,
        expiry,
        buttons: [],
    };
    if (widget.avatarUrl && MXC.test(widget.avatarUrl))
        entry.largeIconUrl = widget.avatarUrl;
    return entry;
}

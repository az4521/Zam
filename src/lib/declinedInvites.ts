// Invites declined from an Android notification, which the app has not seen.
//
// MessageActionReceiver.java leaves the room on the server, but the app still
// holds the invite in its sync store, and sliding sync never says the invite
// is gone. So it would keep offering it, and Accepting it then fails (the
// server no longer has an invite to honour). The receiver records each
// decline under KEY as a JSON array of { userId, roomId, ts }; the app settles
// them locally on start and whenever it comes back to the foreground.

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

/** Must match MessageActionReceiver.KEY_DECLINED_INVITES. */
export const DECLINED_INVITES_KEY = "moe.crafty.matrix.declined_invites";

/** How long a decline waits for its room to appear in the store. */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

export interface DeclinedInvite {
    userId: string;
    roomId: string;
    ts: number;
}

/** What the store knows of a room: null when it has no such room. */
export type InviteLookup = {
    membership: string;
    /** When the pending invite was sent, if it is one. */
    inviteTs?: number;
} | null;

export function parseDeclinedInvites(raw: string | null): DeclinedInvite[] {
    if (!raw) return [];
    try {
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) return [];
        return list.filter(
            (d): d is DeclinedInvite =>
                !!d &&
                typeof d.userId === "string" &&
                typeof d.roomId === "string" &&
                typeof d.ts === "number",
        );
    } catch {
        return [];
    }
}

/**
 * Which of this account's declines to settle now, and which to keep for
 * later. An invite sent AFTER the decline is a new one and is left alone; a
 * room the store does not have yet keeps its entry (for a week) in case it
 * turns up from the sync cache later. Other accounts' entries are kept.
 */
export function planDeclinedInvites(
    entries: DeclinedInvite[],
    userId: string,
    now: number,
    lookup: (roomId: string) => InviteLookup,
): { settle: string[]; keep: DeclinedInvite[] } {
    const settle: string[] = [];
    const keep: DeclinedInvite[] = [];
    for (const d of entries) {
        if (d.userId !== userId) {
            if (now - d.ts < KEEP_MS) keep.push(d);
            continue;
        }
        const room = lookup(d.roomId);
        if (!room) {
            if (now - d.ts < KEEP_MS) keep.push(d);
        } else if (
            room.membership === "invite" &&
            (room.inviteTs === undefined || room.inviteTs <= d.ts)
        ) {
            settle.push(d.roomId);
        }
        // Any other state (joined, left, a newer invite): nothing to do.
    }
    return { settle, keep };
}

/** Settle this account's notification declines. Never throws. */
export async function consumeNativeDeclines(
    userId: string,
    lookup: (roomId: string) => InviteLookup,
    settle: (roomId: string) => void,
): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
        const { value } = await Preferences.get({ key: DECLINED_INVITES_KEY });
        const entries = parseDeclinedInvites(value);
        if (!entries.length) return;
        const plan = planDeclinedInvites(entries, userId, Date.now(), lookup);
        for (const roomId of plan.settle) settle(roomId);
        if (plan.keep.length === entries.length) return;
        // Re-read so a decline recorded meanwhile is not written over.
        const latest = parseDeclinedInvites(
            (await Preferences.get({ key: DECLINED_INVITES_KEY })).value,
        );
        const done = new Set(
            entries
                .filter((e) => !plan.keep.includes(e))
                .map((e) => `${e.userId}\n${e.roomId}\n${e.ts}`),
        );
        const next = latest.filter(
            (e) => !done.has(`${e.userId}\n${e.roomId}\n${e.ts}`),
        );
        await Preferences.set({
            key: DECLINED_INVITES_KEY,
            value: JSON.stringify(next),
        });
    } catch {
        // Best effort: the invite just stays offered until the next pass.
    }
}

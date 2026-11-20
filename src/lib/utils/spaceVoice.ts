//
// Pure aggregation for the space rail's voice indicators and hover card. The
// caller reads the SDK (call memberships, names, avatars) and the call store,
// then hands plain data in, so this module has no SDK imports and is
// unit-testable. Mirrors the shape of spaceNotifications.ts.

/** One person in a room's call, already resolved to display data. */
export interface VoiceParticipantInput {
    userId: string;
    name: string;
    avatar: string | null;
    /** Device labels, present only when the user is joined from 2+ devices. */
    devices?: string[];
}

/** A room that has at least one device in its call. */
export interface VoiceRoomInput {
    roomId: string;
    name: string;
    /** Earliest-joined first (dedupeParticipants order). */
    participants: VoiceParticipantInput[];
}

/**
 * Screen-share knowledge. The app only knows shares in the call THIS device
 * is in, so `roomId` is that call's room (or null outside a call) and
 * `userIds` are the users publishing a screen share in it.
 */
export interface LiveShareInfo {
    roomId: string | null;
    userIds: ReadonlySet<string>;
}

export interface SpaceVoiceParticipant extends VoiceParticipantInput {
    live: boolean;
}

export interface SpaceVoiceRoom {
    roomId: string;
    name: string;
    participants: SpaceVoiceParticipant[];
}

export interface SpaceVoiceSummary {
    /** Some room in scope has people in a call. */
    active: boolean;
    /** Someone in scope is known to be screen sharing. */
    live: boolean;
    /** Rooms with participants: live rooms first, then busiest, then by name. */
    rooms: SpaceVoiceRoom[];
}

/** How many participants the hover card lists before "+N more". */
export const VOICE_CARD_PREVIEW_COUNT = 6;

const EMPTY: SpaceVoiceSummary = { active: false, live: false, rooms: [] };

/**
 * Fold rooms into a summary. Rooms are deduped by id (first occurrence wins),
 * rooms without participants are dropped, and participants are deduped by
 * user. A participant is live only when they share in the room that is the
 * device's current call, so cross-client shares are never inferred.
 */
export function summarizeVoice(
    rooms: VoiceRoomInput[],
    share: LiveShareInfo,
): SpaceVoiceSummary {
    if (rooms.length === 0) return EMPTY;
    const seenRooms = new Set<string>();
    const out: SpaceVoiceRoom[] = [];
    for (const room of rooms) {
        if (seenRooms.has(room.roomId)) continue;
        seenRooms.add(room.roomId);
        const seenUsers = new Set<string>();
        const participants: SpaceVoiceParticipant[] = [];
        for (const p of room.participants) {
            if (seenUsers.has(p.userId)) continue;
            seenUsers.add(p.userId);
            participants.push({
                userId: p.userId,
                name: p.name,
                avatar: p.avatar,
                ...(p.devices ? { devices: p.devices } : {}),
                live:
                    share.roomId === room.roomId && share.userIds.has(p.userId),
            });
        }
        if (participants.length === 0) continue;
        // Live people first (so they survive the hover card's preview cut),
        // otherwise keep join order.
        participants.sort((a, b) => Number(b.live) - Number(a.live));
        out.push({ roomId: room.roomId, name: room.name, participants });
    }
    if (out.length === 0) return EMPTY;
    out.sort((a, b) => {
        const aLive = a.participants.some((p) => p.live);
        const bLive = b.participants.some((p) => p.live);
        if (aLive !== bLive) return aLive ? -1 : 1;
        if (a.participants.length !== b.participants.length)
            return b.participants.length - a.participants.length;
        return a.name.localeCompare(b.name);
    });
    return {
        active: true,
        live: out.some((r) => r.participants.some((p) => p.live)),
        rooms: out,
    };
}

/** Distinct people across all rooms in a summary (the "N in voice" count). */
export function countVoiceParticipants(summary: SpaceVoiceSummary): number {
    const users = new Set<string>();
    for (const room of summary.rooms)
        for (const p of room.participants) users.add(p.userId);
    return users.size;
}

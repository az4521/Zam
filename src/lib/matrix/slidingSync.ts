/**
 * Sliding sync (MSC4186, served natively by the homeserver): building the
 * connection and its lists, growing the room-list window, the room
 * subscriptions for the viewed and held rooms, and the fixes applied to room
 * data before the SDK sees it (timeline gaps, rooms sent without `initial`).
 *
 * Split out of `client.ts`, whose startSync calls buildSlidingSync and which
 * re-exports the public API. One connection at a time: buildSlidingSync
 * replaces it.
 */
import { t } from "$lib/i18n";
import { NotificationCountType, SlidingSyncEvent } from "matrix-js-sdk";
import type { EventTimeline, MatrixClient } from "matrix-js-sdk";
import {
    SlidingSync,
    SlidingSyncState,
    MSC3575_STATE_KEY_ME,
    MSC3575_STATE_KEY_LAZY,
    type MSC3575List,
    type MSC3575RoomData,
} from "matrix-js-sdk/lib/sliding-sync";
import {
    isSlidingSyncUnsupportedError,
    isSlidingTimelineGap,
    nextWindowEnd,
    roomsWithDroppedTimeline,
    shouldRecoverSkippedEvents,
} from "$lib/utils/slidingSyncHelpers";
import { describeSyncError, logSync } from "$lib/matrix/syncLog";
import { keepSlidingSyncAlive } from "$lib/matrix/slidingSyncKeepAlive";
import { adaptSlidingSyncTimeout } from "$lib/matrix/slidingSyncTimeout";
import {
    isSlidingSyncEnabled,
    setSlidingSyncEnabled,
} from "$lib/matrix/slidingSyncPref";

// Sliding sync tuning. The room list is a window that starts small (fast first
// paint) and grows in the background until every joined room is loaded, so a
// large account never waits on one giant initial response.
const SLIDING_ALL_LIST = "all_rooms";
const SLIDING_INITIAL_WINDOW = 30;
const SLIDING_GROW_STEP = 100;
const SLIDING_LIST_TIMELINE = 1;
const SLIDING_ROOM_TIMELINE = 30;
const SLIDING_TIMEOUT_MS = 30000;

// What the room list / space tree / notification logic need for EVERY room.
// Kept deliberately small: full state is only fetched for the open room.
const SLIDING_LIST_STATE: string[][] = [
    ["m.room.create", ""],
    ["m.room.name", ""],
    ["m.room.avatar", ""],
    ["m.room.canonical_alias", ""],
    ["m.room.topic", ""],
    ["m.room.encryption", ""],
    ["m.room.tombstone", ""],
    ["m.room.join_rules", ""],
    // Who may send, redact or pin. Read for every room, not just the open
    // one: the composer lock, message actions and the room list menus gate
    // on it, and a missing event reads as "everyone is 0, everything is 0".
    ["m.room.power_levels", ""],
    ["m.space.parent", "*"],
    // Space/room emoji packs are offered in every room's picker, not just the
    // room that owns them, so they must be loaded for the whole list.
    ["im.ponies.room_emotes", "*"],
    // The stable MSC2545 name, which Sable writes new packs under.
    ["m.room.image_pack", "*"],
    ["m.room.member", MSC3575_STATE_KEY_ME],
    // Calls: who is in each room's call (room-list rosters, DM ringing) and
    // the member events of whoever just sent something (the caller's join or
    // ring). MatrixRTC ignores a call membership whose sender isn't a known
    // room member, so a DM call couldn't ring until the room was opened.
    ["org.matrix.msc3401.call.member", "*"],
    ["m.room.member", MSC3575_STATE_KEY_LAZY],
];

// The room being viewed gets everything (power levels, pins, members as the
// timeline references them) plus a deeper timeline. tuwunel matches the event
// type literally, so `["*", "*"]` returns nothing there; every type the app
// reads is also named explicitly so it arrives on servers that skip the
// wildcard type.
const SLIDING_ROOM_STATE: string[][] = [
    ["*", "*"],
    ...SLIDING_LIST_STATE,
    ["m.room.pinned_events", ""],
    ["m.room.history_visibility", ""],
    ["m.room.guest_access", ""],
    ["m.room.server_acl", ""],
    ["m.space.child", "*"],
    ["m.call.member", "*"],
    ["m.rtc.member", "*"],
    ["m.room.member", MSC3575_STATE_KEY_ME],
    ["m.room.member", MSC3575_STATE_KEY_LAZY],
];

let activeSlidingSync: SlidingSync | null = null;

/** The live connection, for the sync watchdog's resend; null on classic /sync. */
export function getActiveSlidingSync(): SlidingSync | null {
    return activeSlidingSync;
}

// What the in-flight sliding-sync request is allowed (adaptSlidingSyncTimeout).
let requestTimeoutMs: () => number = () => 0;

/** What the in-flight sliding-sync request is allowed, for the watchdog. */
export function slidingRequestTimeoutMs(): number {
    return requestTimeoutMs();
}

/**
 * The SDK ignores data for a room it doesn't have yet unless the server marks
 * it `initial`, and tuwunel can send a brand-new room without that flag: any
 * subscription or range change aborts the in-flight request (SlidingSync.
 * resend), and when that response already carried the room, the retry from
 * the old pos rolls the room back to that pos rather than to "never sent", so
 * it comes again as a plain update and was dropped. That is what kept a room
 * you just joined (opening it right away changes the subscriptions) out of
 * the sidebar until a later sync or a restart. Treat it as initial so the SDK
 * creates it. Leaves and bans are skipped: the SDK would mark them joined.
 * Mutates `roomData` in place; this listener runs before the SDK's.
 */
function adoptUnknownRoom(roomId: string, roomData: MSC3575RoomData): void {
    if (roomData.initial) return;
    const membership = (roomData as { membership?: string }).membership;
    if (membership === "leave" || membership === "ban") return;
    roomData.initial = true;
    logSync(`adopted ${roomId}: sent without initial for a room we lacked`);
}

let slidingActiveRoomId: string | null = null;
/**
 * Rooms held at full timeline depth regardless of what is on screen, with a
 * count per room since several holders can overlap. See holdSlidingSyncRoom.
 */
const slidingHeldRooms = new Map<string, number>();

/** The room subscription set: the viewed room plus every held one. */
function slidingRoomSubscriptions(): Set<string> {
    const rooms = new Set(slidingHeldRooms.keys());
    if (slidingActiveRoomId) rooms.add(slidingActiveRoomId);
    return rooms;
}

/**
 * Keep a room subscribed at full timeline depth until the returned release is
 * called, even while it isn't the room being viewed. Rooms outside the
 * subscription only get the newest event per sliding-sync update, which drops
 * the rest of a burst; an in-room verification can't survive losing a step, so
 * it holds its DM for as long as it runs. Release is idempotent. No-op on
 * classic /sync beyond the bookkeeping.
 */
export function holdSlidingSyncRoom(roomId: string): () => void {
    slidingHeldRooms.set(roomId, (slidingHeldRooms.get(roomId) ?? 0) + 1);
    activeSlidingSync?.modifyRoomSubscriptions(slidingRoomSubscriptions());
    let released = false;
    return () => {
        if (released) return;
        released = true;
        const count = (slidingHeldRooms.get(roomId) ?? 1) - 1;
        if (count > 0) slidingHeldRooms.set(roomId, count);
        else slidingHeldRooms.delete(roomId);
        activeSlidingSync?.modifyRoomSubscriptions(slidingRoomSubscriptions());
    };
}

// Live timelines whose missing backward token has already been probed. Keyed
// by the timeline object, not the room id: a gappy/limited sync replaces the
// room's live timeline, often again without a prev_batch under sliding sync,
// and a once-per-room guard left that fresh timeline un-paginatable for the
// rest of the session (scroll to the top, nothing loads). A WeakSet also lets
// discarded timelines be collected.
let slidingPrimedTimelines = new WeakSet<EventTimeline>();

/** True the first time a live timeline is offered for a token probe. */
export function claimSlidingProbe(timeline: EventTimeline): boolean {
    if (slidingPrimedTimelines.has(timeline)) return false;
    slidingPrimedTimelines.add(timeline);
    return true;
}

// Set when the account asked for sliding sync but the server can't do it.
let slidingSyncFallbackReason: string | null = null;

/** Why sliding sync was turned off for this session, or null if it wasn't. */
export function getSlidingSyncFallbackReason(): string | null {
    return slidingSyncFallbackReason;
}

/** True while the current client is syncing over sliding sync. */
export function isUsingSlidingSync(): boolean {
    return activeSlidingSync !== null;
}

/** How much of the room list sliding sync has loaded, or null on classic /sync. */
export function getSlidingSyncProgress(): {
    requested: number;
    total: number;
} | null {
    if (!activeSlidingSync) return null;
    const end =
        activeSlidingSync.getListParams(SLIDING_ALL_LIST)?.ranges[0]?.[1];
    const total =
        activeSlidingSync.getListData(SLIDING_ALL_LIST)?.joinedCount ?? 0;
    return { requested: Math.min((end ?? -1) + 1, total), total };
}

/**
 * Subscribe the sliding-sync connection to the room being viewed so it gets
 * full state and a deeper timeline than the room-list window provides. No-op
 * on classic /sync (which already delivers everything).
 */
export function setSlidingSyncActiveRoom(roomId: string | null): void {
    slidingActiveRoomId = roomId;
    activeSlidingSync?.modifyRoomSubscriptions(slidingRoomSubscriptions());
}

/**
 * A SlidingSync (MSC4186 simplified sliding sync, served natively by the
 * homeserver) when this account opted in on the login page, else undefined so
 * the SDK falls back to classic /sync.
 */
export async function buildSlidingSync(
    client: MatrixClient,
    hooks: {
        /** Sliding sync was asked for but the server can't do it. */
        onFallback?: (reason: string) => void;
        /** Every list window now covers its whole list. */
        onListComplete: () => void;
        /** Rooms a response sent events for that kept none (see roomsWithDroppedTimeline). */
        onDroppedTimelines: (roomIds: string[]) => void;
        /** Every room a completed response carried data for. */
        onRoomsUpdated: (roomIds: string[]) => void;
        /**
         * A gap skipped messages that may have deserved an alert (see
         * shouldRecoverSkippedEvents): the ones before `fromToken`, back to
         * `stopAtEventId`, the last event the room had. Called from inside
         * the sync loop; must not block it.
         */
        onSkippedEvents: (
            roomId: string,
            fromToken: string,
            stopAtEventId: string,
        ) => void;
        /**
         * Leave to-device messages on the server: crypto isn't running, and
         * receiving them would acknowledge (and so delete) the room keys in
         * them without storing them anywhere.
         */
        keepToDeviceOnServer?: boolean;
    },
): Promise<SlidingSync | undefined> {
    activeSlidingSync = null;
    slidingSyncFallbackReason = null;
    slidingPrimedTimelines = new WeakSet();
    const userId = client.getUserId();
    if (!userId || !isSlidingSyncEnabled(userId)) return undefined;

    // Ask the server before committing: on one that lacks the endpoint sync
    // would otherwise just sit in an error state with no way back.
    try {
        await client.slidingSync(
            { lists: {}, timeout: 0, clientTimeout: 10000 },
            client.getHomeserverUrl(),
        );
    } catch (err) {
        if (isSlidingSyncUnsupportedError(err)) {
            const reason = t("client.thisHomeserverDoesnTSupportSliding");
            console.warn(
                "[matrix] sliding sync unsupported, falling back",
                err,
            );
            // Turned off so the next boot doesn't probe and warn again; the
            // user can re-enable it from Debug settings if the server changes.
            setSlidingSyncEnabled(userId, false);
            slidingSyncFallbackReason = reason;
            hooks.onFallback?.(reason);
            return undefined;
        }
        // Anything else (network blip, 5xx, rate limit) is not evidence the
        // server can't do it; let the real sync loop retry as it normally does.
    }

    const lists = new Map<string, MSC3575List>([
        [
            SLIDING_ALL_LIST,
            {
                ranges: [[0, SLIDING_INITIAL_WINDOW - 1]],
                sort: ["by_recency"],
                timeline_limit: SLIDING_LIST_TIMELINE,
                required_state: SLIDING_LIST_STATE,
            },
        ],
        [
            // Spaces are few and their m.space.child events define the whole
            // sidebar tree, so they are always fully loaded up front.
            "spaces",
            {
                ranges: [[0, SLIDING_INITIAL_WINDOW - 1]],
                sort: ["by_name"],
                filters: { room_types: ["m.space"] },
                timeline_limit: 0,
                required_state: [...SLIDING_LIST_STATE, ["m.space.child", "*"]],
            },
        ],
        [
            // DMs ring on an incoming call, which needs the caller's member
            // event (see SLIDING_LIST_STATE). A DM has two members, so load
            // them all; the server merges this with the room's other lists.
            "dms",
            {
                ranges: [[0, SLIDING_INITIAL_WINDOW - 1]],
                sort: ["by_recency"],
                filters: { is_dm: true },
                timeline_limit: SLIDING_LIST_TIMELINE,
                required_state: [...SLIDING_LIST_STATE, ["m.room.member", "*"]],
            },
        ],
        [
            // Pending invites must never wait behind the recency window.
            "invites",
            {
                ranges: [[0, SLIDING_INITIAL_WINDOW - 1]],
                sort: ["by_recency"],
                filters: { is_invite: true },
                timeline_limit: 0,
                required_state: SLIDING_LIST_STATE,
            },
        ],
    ]);

    requestTimeoutMs = adaptSlidingSyncTimeout(client, {
        onTimeout: (nextMs) =>
            logSync(
                `request timed out, next allows ${Math.round(nextMs / 1000)}s`,
            ),
    });

    const sliding = new SlidingSync(
        client.getHomeserverUrl(),
        lists,
        {
            timeline_limit: SLIDING_ROOM_TIMELINE,
            required_state: SLIDING_ROOM_STATE,
        },
        client,
        SLIDING_TIMEOUT_MS,
    );

    if (hooks.keepToDeviceOnServer) {
        // The SDK registers its extensions inside startClient().
        const register = sliding.registerExtension.bind(sliding);
        sliding.registerExtension = (ext) => {
            if (ext.name() === "to_device") {
                logSync(
                    "crypto is down: leaving to-device messages on the server",
                );
                return;
            }
            register(ext);
        };
    }

    // A listener that throws inside the loop kills sync for good; restart it
    // instead (see keepSlidingSyncAlive).
    keepSlidingSyncAlive(sliding, (err, retryInMs) => {
        console.error("[sync] sliding sync loop crashed", err);
        logSync(
            `loop crashed, restarting in ${retryInMs}ms: ${describeSyncError(err)}`,
        );
    });

    // Reset a room's live timeline when an update skips events, like classic
    // /sync does (see isSlidingTimelineGap for what the SDK gets wrong). This
    // listener is registered before startClient() builds the SDK's own
    // RoomData listener, and emitPromised calls listeners in order, so the
    // reset lands before the SDK appends the update. The fresh timeline gets
    // the update's prev_batch, so the missing messages page in behind it, and
    // RoomEvent.TimelineReset makes an open MessageArea reload and refill.
    // It runs inside the sync loop, so it must never throw.
    sliding.on(
        SlidingSyncEvent.RoomData,
        (roomId: string, roomData: MSC3575RoomData) => {
            try {
                const room = client.getRoom(roomId);
                if (!room) {
                    adoptUnknownRoom(roomId, roomData);
                    return;
                }
                const gap = isSlidingTimelineGap(
                    {
                        limited: roomData.limited,
                        timelineEventIds: (roomData.timeline ?? [])
                            .map((e) => e.event_id)
                            .filter((id): id is string => !!id),
                    },
                    {
                        liveIsEmpty:
                            room.getLiveTimeline().getEvents().length === 0,
                        isKnown: (id) => !!room.findEventById(id),
                    },
                );
                if (!gap) return;
                // Before the reset (and before the SDK applies the update's
                // counts): what the room held, to tell whether the skipped
                // messages included one worth an alert.
                const lastKnown = room.getLiveTimeline().getEvents().at(-1);
                const recover = shouldRecoverSkippedEvents({
                    encrypted: room.hasEncryptionStateEvent(),
                    prevHighlight: room.getUnreadNotificationCount(
                        NotificationCountType.Highlight,
                    ),
                    prevTotal: room.getUnreadNotificationCount(
                        NotificationCountType.Total,
                    ),
                    highlight: roomData.highlight_count,
                    total: roomData.notification_count,
                    delivered: roomData.timeline?.length ?? 0,
                });
                logSync(`timeline reset (gap) in ${roomId}`);
                room.resetLiveTimeline(roomData.prev_batch ?? null, null);
                if (recover && roomData.prev_batch && lastKnown?.getId())
                    hooks.onSkippedEvents(
                        roomId,
                        roomData.prev_batch,
                        lastKnown.getId()!,
                    );
            } catch (err) {
                console.error("[sync] gap check failed", roomId, err);
                logSync(
                    `gap check failed in ${roomId}: ${describeSyncError(err)}`,
                );
            }
        },
    );

    // Per completed response: grow every list one page until it covers all the
    // rooms the server reports for it (so no list has a hard cap), and backfill
    // rooms whose timeline the SDK emptied. Runs inside the sync loop, so it
    // must never throw.
    sliding.on(
        SlidingSyncEvent.Lifecycle,
        (
            state: SlidingSyncState,
            resp: { rooms?: Record<string, MSC3575RoomData> } | null,
            err?: unknown,
        ) => {
            if (err) {
                logSync(`request failed: ${describeSyncError(err)}`);
                return;
            }
            if (state !== SlidingSyncState.Complete) return;
            try {
                let growing = false;
                for (const key of lists.keys()) {
                    const total = sliding.getListData(key)?.joinedCount ?? 0;
                    const end = sliding.getListParams(key)?.ranges[0]?.[1];
                    const next = nextWindowEnd(end, total, SLIDING_GROW_STEP);
                    if (next !== null) {
                        growing = true;
                        sliding.setListRanges(key, [[0, next]]);
                    }
                }
                // Every window already covered its list: the room list is whole.
                if (!growing && activeSlidingSync === sliding)
                    hooks.onListComplete();
            } catch (e) {
                console.error("[sync] list growth failed", e);
                logSync(`list growth failed: ${describeSyncError(e)}`);
            }
            try {
                const dropped = roomsWithDroppedTimeline(
                    resp?.rooms,
                    (roomId) =>
                        client.getRoom(roomId)?.getLiveTimeline().getEvents()
                            .length === 0,
                );
                if (dropped.length > 0 && activeSlidingSync === sliding) {
                    logSync(
                        `backfilling ${dropped.length} emptied timeline(s)`,
                    );
                    hooks.onDroppedTimelines(dropped);
                }
            } catch (e) {
                console.error("[sync] dropped timeline check failed", e);
            }
            try {
                const updated = Object.keys(resp?.rooms ?? {});
                if (updated.length > 0 && activeSlidingSync === sliding)
                    hooks.onRoomsUpdated(updated);
            } catch (e) {
                console.error("[sync] room update hook failed", e);
            }
        },
    );

    const subscriptions = slidingRoomSubscriptions();
    if (subscriptions.size > 0) sliding.modifyRoomSubscriptions(subscriptions);
    activeSlidingSync = sliding;
    return sliding;
}

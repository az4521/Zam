/**
 * Matrix widget host: the sanctioned SDK boundary for room widgets (see
 * ARCHITECTURE.md "Widgets"). It is the only place that runs a
 * matrix-widget-api `ClientWidgetApi`, feeds it room events, and reads or
 * writes the `im.vector.modular.widgets` / `m.widget` room state. Everything
 * the widget may do is gated by the capabilities the user approved; the
 * driver below answers only for the room the widget was mounted in.
 */
import {
    ClientEvent,
    Direction,
    MatrixError,
    MatrixEventEvent,
    RoomEvent,
    RoomStateEvent,
    type MatrixClient,
    type MatrixEvent,
    type Room,
    UnsupportedStickyEventsEndpointError,
} from "matrix-js-sdk";
import {
    ClientWidgetApi,
    OpenIDRequestState,
    SimpleObservable,
    Widget,
    WidgetDriver,
    type Capability,
    type IGetMediaConfigResult,
    type IMatrixApiError,
    type IModalWidgetOpenRequestData,
    type IModalWidgetReturnData,
    type IOpenIDUpdate,
    type IReadEventRelationsResult,
    type IRoomAccountData,
    type IRoomEvent,
    type ISearchUserDirectoryResult,
    type IRtcTransport,
    type IRtcTransportsResult,
    type ISendDelayedEventDetails,
    type ISendEventDetails,
    type IStickerActionRequestData,
    type IStickyActionResponseData,
    type ITurnServer,
    type IWidgetApiErrorResponseDataDetails,
    type IWidgetApiRequest,
} from "matrix-widget-api";
import { parseMatrixLink } from "$lib/utils/matrixLinks";
import {
    captureClient,
    getClient,
    ownedClient,
    ownedClientOrThrow,
} from "$lib/matrix/runtime";
import type { ClientOwnership } from "$lib/utils/clientGeneration";
import { configuredRtcFoci } from "$lib/matrix/livekitCall";
import { mxcToHttp, fetchMediaBytes, uploadContent } from "$lib/matrix/media";
import {
    WIDGET_STATE_TYPES,
    dedupeWidgets,
    isCallWidget,
    parseWidgetState,
    type RoomWidget,
    type WidgetUrlContext,
} from "$lib/utils/widgets";
import { widgetClosed, widgetOpened } from "$lib/stores/richPresence.svelte";
import {
    STICKY_MAX_DURATION_MS,
    activeStickyEvents,
    emulateStickyMarker,
} from "$lib/utils/stickyEmulation";

export type {
    IModalWidgetOpenRequestData,
    IModalWidgetOpenRequestDataButton,
    IModalWidgetReturnData,
    ModalButtonID,
} from "matrix-widget-api";

const WIDGET_STATE_TYPE = "im.vector.modular.widgets";
const APP_CLIENT_ID = "moe.crafty.zam";
/** Upper bound for a widget-initiated media download. */
const MAX_WIDGET_DOWNLOAD_BYTES = 100 * 1024 * 1024;
/** Bounded memory for the event ids a live feed has already delivered. */
const FED_ID_LIMIT = 500;
/** History pages read to rebuild sticky state on a server without MSC4354. */
const STICKY_HISTORY_PAGES = 10;
const STICKY_HISTORY_PAGE_SIZE = 100;

function isWidgetStateType(type: string): boolean {
    return (WIDGET_STATE_TYPES as readonly string[]).includes(type);
}

/**
 * Capabilities Zam does not implement are dropped before the user is asked,
 * so a prompt never offers something the driver would then reject: LiveKit
 * tokens and delegated leave (MSC4533). Room account data is supported for
 * the widget's own room only.
 */
const UNSUPPORTED_CAPABILITY_PREFIXES = ["org.matrix.msc4533."];

export function isSupportedCapability(cap: string): boolean {
    return !UNSUPPORTED_CAPABILITY_PREFIXES.some((p) => cap.startsWith(p));
}

function rememberId(set: Set<string>, id: string): void {
    set.add(id);
    if (set.size > FED_ID_LIMIT) {
        const oldest = set.values().next().value;
        if (oldest !== undefined) set.delete(oldest);
    }
}

/**
 * The event as a widget sees it. getEffectiveEvent returns a fresh object, so
 * the emulated sticky marker never touches the SDK's own event.
 */
function toRaw(event: MatrixEvent): IRoomEvent {
    return emulateStickyMarker(
        event.getEffectiveEvent() as unknown as IRoomEvent,
    );
}

/** A state event as GET /rooms/{id}/state returns it (no room_id). */
export interface ServerStateEvent {
    type: string;
    state_key: string;
    event_id?: string;
    sender?: string;
    origin_server_ts?: number;
    content: Record<string, unknown>;
    unsigned?: Record<string, unknown>;
}

/**
 * The state events of one type (and, when given, one state key), shaped as
 * widget-API room events for `roomId`. Pure, so the widget read path is testable.
 */
export function filterStateEvents(
    events: readonly ServerStateEvent[],
    roomId: string,
    eventType: string,
    stateKey: string | undefined,
): IRoomEvent[] {
    return events
        .filter(
            (e) =>
                e.type === eventType &&
                (stateKey === undefined || e.state_key === stateKey),
        )
        .map((e) => ({
            type: e.type,
            state_key: e.state_key,
            event_id: e.event_id ?? "",
            sender: e.sender ?? "",
            origin_server_ts: e.origin_server_ts ?? 0,
            content: e.content,
            unsigned: e.unsigned ?? {},
            room_id: roomId,
        }));
}

/**
 * Wraps `fetch` so calls within `ttlMs` of the last one share its promise.
 * A failed fetch is forgotten at once, so the next call retries.
 */
export function coalescedFetch<T>(
    fetch: () => Promise<T>,
    ttlMs: number,
    now: () => number = Date.now,
): () => Promise<T> {
    let last: { at: number; promise: Promise<T> } | null = null;
    return () => {
        const t = now();
        if (last && t - last.at < ttlMs) return last.promise;
        const promise = fetch();
        const entry = { at: t, promise };
        last = entry;
        promise.catch(() => {
            if (last === entry) last = null;
        });
        return promise;
    };
}

/** How long one server state read is shared by the reads around it. */
const STATE_FETCH_TTL_MS = 2000;

// ---------------------------------------------------------------------------
// Room state: reading, watching and writing widget entries.
// ---------------------------------------------------------------------------

/** The widgets in a room, without Element Call widgets, de-duplicated and sorted. */
export function listRoomWidgets(roomId: string): RoomWidget[] {
    const room = getClient()?.getRoom(roomId);
    if (!room) return [];
    const found: RoomWidget[] = [];
    for (const type of WIDGET_STATE_TYPES) {
        for (const ev of room.currentState.getStateEvents(type)) {
            const w = parseWidgetState(
                type,
                ev.getStateKey() ?? "",
                ev.getContent(),
                ev.getSender() ?? "",
            );
            if (w && !isCallWidget(w)) found.push(w);
        }
    }
    return dedupeWidgets(found);
}

/** Calls `cb` when a widget state entry in `roomId` changes. Returns the unsubscribe. */
export function onRoomWidgetsChange(
    roomId: string,
    cb: () => void,
): () => void {
    const client = getClient();
    if (!client) return () => {};
    const handler = (event: MatrixEvent) => {
        if (event.getRoomId() !== roomId) return;
        if (!isWidgetStateType(event.getType())) return;
        cb();
    };
    client.on(RoomStateEvent.Events as never, handler as never);
    return () => {
        client.off(RoomStateEvent.Events as never, handler as never);
    };
}

/** Whether the current user may add or remove widgets in `roomId`. */
export function canManageWidgets(roomId: string): boolean {
    const client = getClient();
    const me = client?.getUserId();
    const room = client?.getRoom(roomId);
    if (!client || !me || !room) return false;
    return room.currentState.maySendStateEvent(WIDGET_STATE_TYPE, me);
}

/** Adds a widget entry to `roomId` and returns its generated id. Throws on failure. */
export async function addRoomWidget(
    roomId: string,
    opts: { url: string; name: string; type?: string },
): Promise<string> {
    const client = ownedClientOrThrow(captureClient());
    const me = client.getUserId();
    if (!me) throw new Error("not logged in");
    const id = `zam_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const content = {
        type: opts.type ?? "m.custom",
        url: opts.url.trim(),
        name: opts.name.trim(),
        data: {},
        creatorUserId: me,
        id,
        waitForIframeLoad: true,
    };
    if (!parseWidgetState(WIDGET_STATE_TYPE, id, content, me)) {
        throw new Error("widget url must be an http(s) address");
    }
    await client.sendStateEvent(
        roomId,
        WIDGET_STATE_TYPE as never,
        content as never,
        id,
    );
    return id;
}

/** Removes a widget entry by sending an empty state event for its key. */
export async function removeRoomWidget(
    roomId: string,
    w: RoomWidget,
): Promise<void> {
    const client = ownedClientOrThrow(captureClient());
    await client.sendStateEvent(
        roomId,
        w.stateType as never,
        {} as never,
        w.id,
    );
}

/** The template variables for `roomId`, taken from the current user and client. */
export function widgetUrlContext(
    roomId: string,
    theme: "light" | "dark",
    language: string,
): WidgetUrlContext | null {
    const client = getClient();
    const userId = client?.getUserId();
    if (!client || !userId) return null;
    const ownMember = client
        .getRoom(roomId)
        ?.currentState.getStateEvents("m.room.member", userId);
    const content = ownMember?.getContent() ?? {};
    const displayName =
        typeof content.displayname === "string" && content.displayname
            ? content.displayname
            : userId;
    // The mxc string is passed through, as Element does.
    const avatarUrl =
        typeof content.avatar_url === "string" ? content.avatar_url : "";
    return {
        userId,
        displayName,
        avatarUrl,
        roomId,
        deviceId: client.getDeviceId() ?? "",
        baseUrl: client.baseUrl,
        theme,
        language,
        clientId: APP_CLIENT_ID,
    };
}

// ---------------------------------------------------------------------------
// Timeline and state reads.
// ---------------------------------------------------------------------------

/**
 * Reads the live timeline of `room`, filtered by type, msgtype and state key.
 * With `since` the events after that id are returned, oldest first. Without
 * it the newest events are returned. `limit` 0 means no limit. Only decrypted
 * events match: an undecrypted event keeps the type m.room.encrypted.
 */
function collectTimeline(
    room: Room,
    q: {
        eventType: string;
        msgtype?: string;
        stateKey?: string;
        limit: number;
        since?: string;
    },
): IRoomEvent[] {
    const all = room.getLiveTimeline().getEvents();
    let candidates = all;
    if (q.since) {
        const idx = all.findIndex((e) => e.getId() === q.since);
        if (idx >= 0) candidates = all.slice(idx + 1);
    }
    const matched = candidates.filter((e) => {
        if (e.getType() !== q.eventType) return false;
        if (q.msgtype !== undefined && e.getContent().msgtype !== q.msgtype)
            return false;
        if (q.stateKey !== undefined && e.getStateKey() !== q.stateKey)
            return false;
        return true;
    });
    const cap = q.limit > 0 ? q.limit : Number.POSITIVE_INFINITY;
    const picked = q.since
        ? matched.slice(0, cap)
        : matched.slice(Math.max(0, matched.length - cap));
    return picked.map(toRaw);
}

// ---------------------------------------------------------------------------
// The driver.
// ---------------------------------------------------------------------------

interface DriverDeps {
    roomId: string;
    owner: ClientOwnership<MatrixClient>;
    requestCapabilities(requested: Set<string>): Promise<Set<string>>;
    requestOpenId(): Promise<boolean>;
    onUnsupportedCapabilities?(caps: string[]): void;
    onNavigate?(uri: string): Promise<void>;
}

/**
 * Answers the widget API for one room. Methods that touch the SDK go through
 * the captured owner, so a widget that outlives its account gets an error
 * instead of acting on the successor's client.
 */
class ZamWidgetDriver extends WidgetDriver {
    private readonly deps: DriverDeps;

    constructor(deps: DriverDeps) {
        super();
        this.deps = deps;
    }

    private client(): MatrixClient {
        return ownedClientOrThrow(this.deps.owner);
    }

    /**
     * The whole room state from the server, shared across rapid reads. A
     * widget reads several types at startup; this makes that one request.
     */
    private readonly fetchRoomState = coalescedFetch(
        () => this.client().roomState(this.deps.roomId),
        STATE_FETCH_TTL_MS,
    );

    /** The bound room only: a widget may not act on another room. */
    private resolveRoom(requested: string | null | undefined): string {
        if (!requested || requested === this.deps.roomId)
            return this.deps.roomId;
        throw new Error("widget may only act on its own room");
    }

    override getKnownRooms(): string[] {
        return [this.deps.roomId];
    }

    /**
     * A Matrix API error from the driver reaches the widget with its status and
     * errcode (rate limits are read this way), as Element passes them on.
     */
    override processError(
        error: unknown,
    ): IWidgetApiErrorResponseDataDetails | undefined {
        if (!(error instanceof MatrixError)) return undefined;
        return {
            matrix_api_error: {
                http_status: error.httpStatus ?? 0,
                http_headers: {},
                url: error.url ?? "",
                response: error.data as unknown as IMatrixApiError["response"],
            },
        };
    }

    override async validateCapabilities(
        requested: Set<Capability>,
    ): Promise<Set<Capability>> {
        const supported = new Set<string>();
        const unsupported: string[] = [];
        for (const cap of requested) {
            if (isSupportedCapability(cap)) supported.add(cap);
            else unsupported.push(cap);
        }
        // Said out loud: a widget that insists on one of these shows its own
        // "missing permissions" screen, and asking again can never fix that.
        if (unsupported.length > 0)
            this.deps.onUnsupportedCapabilities?.(unsupported);
        if (supported.size === 0) return new Set();
        try {
            const approved = await this.deps.requestCapabilities(
                new Set(supported),
            );
            if (!ownedClient(this.deps.owner)) return new Set();
            return new Set([...approved].filter((c) => supported.has(c)));
        } catch (e) {
            console.warn("[zam] widget capability request failed", e);
            return new Set();
        }
    }

    override async sendEvent(
        eventType: string,
        content: unknown,
        stateKey: string | null = null,
        roomId: string | null = null,
    ): Promise<ISendEventDetails> {
        const target = this.resolveRoom(roomId);
        const client = this.client();
        const res =
            stateKey === null
                ? await client.sendEvent(
                      target,
                      eventType as never,
                      content as never,
                  )
                : await client.sendStateEvent(
                      target,
                      eventType as never,
                      content as never,
                      stateKey,
                  );
        return { roomId: target, eventId: res.event_id };
    }

    /**
     * MSC4354 sticky event. A server without sticky events gets an ordinary
     * event instead, as the SDK does for its own call declines: peers on the
     * live timeline still see it, it is just not replayed to late joiners.
     */
    override async sendStickyEvent(
        stickyDurationMs: number,
        eventType: string,
        content: unknown,
        roomId: string | null = null,
    ): Promise<ISendEventDetails> {
        const target = this.resolveRoom(roomId);
        const client = this.client();
        try {
            const res = await client._unstable_sendStickyEvent(
                target,
                stickyDurationMs,
                null,
                eventType as never,
                content as never,
            );
            return { roomId: target, eventId: res.event_id };
        } catch (e) {
            if (!(e instanceof UnsupportedStickyEventsEndpointError)) throw e;
            return this.sendEvent(eventType, content, null, target);
        }
    }

    /** MSC4140 delayed event (timeline or state). */
    override async sendDelayedEvent(
        delay: number,
        eventType: string,
        content: unknown,
        stateKey: string | null = null,
        roomId: string | null = null,
    ): Promise<ISendDelayedEventDetails> {
        const target = this.resolveRoom(roomId);
        const client = this.client();
        const res =
            stateKey === null
                ? await client._unstable_sendDelayedEvent(
                      target,
                      delay,
                      null,
                      eventType as never,
                      content as never,
                  )
                : await client._unstable_sendDelayedStateEvent(
                      target,
                      delay,
                      eventType as never,
                      content as never,
                      stateKey,
                  );
        return { roomId: target, delayId: res.delay_id };
    }

    /** Delayed and sticky; a plain delayed event without sticky support. */
    override async sendDelayedStickyEvent(
        delay: number,
        stickyDurationMs: number,
        eventType: string,
        content: unknown,
        roomId: string | null = null,
    ): Promise<ISendDelayedEventDetails> {
        const target = this.resolveRoom(roomId);
        const client = this.client();
        try {
            const res = await client._unstable_sendStickyDelayedEvent(
                target,
                stickyDurationMs,
                delay,
                null,
                eventType as never,
                content as never,
            );
            return { roomId: target, delayId: res.delay_id };
        } catch (e) {
            if (!(e instanceof UnsupportedStickyEventsEndpointError)) throw e;
            return this.sendDelayedEvent(
                delay,
                eventType,
                content,
                null,
                target,
            );
        }
    }

    override async cancelScheduledDelayedEvent(delayId: string): Promise<void> {
        await this.client()._unstable_cancelScheduledDelayedEvent(delayId);
    }

    override async restartScheduledDelayedEvent(
        delayId: string,
    ): Promise<void> {
        await this.client()._unstable_restartScheduledDelayedEvent(delayId);
    }

    override async sendScheduledDelayedEvent(delayId: string): Promise<void> {
        await this.client()._unstable_sendScheduledDelayedEvent(delayId);
    }

    /**
     * The room's active sticky events. A server without MSC4354 keeps no
     * sticky state, so it is rebuilt from the last hour of room history (the
     * longest a sticky event lives): without it a widget opened late never
     * learns who is already there (NeoBoard ignores their live data).
     */
    override async readStickyEvents(roomId: string): Promise<IRoomEvent[]> {
        const target = this.resolveRoom(roomId);
        const client = this.client();
        const room = client.getRoom(target);
        if (!room) return [];
        if (await client.doesServerSupportUnstableFeature("org.matrix.msc4354"))
            return [...room._unstable_getStickyEvents()].map((e) =>
                toRaw(e as unknown as MatrixEvent),
            );
        return activeStickyEvents(
            await this.readRecentHistory(target, STICKY_MAX_DURATION_MS),
            Date.now(),
        );
    }

    /**
     * The room's events from the last `windowMs`, decrypted where possible,
     * read from the server so the room's own timeline is not paginated.
     * Bounded by STICKY_HISTORY_PAGES.
     */
    private async readRecentHistory(
        roomId: string,
        windowMs: number,
    ): Promise<IRoomEvent[]> {
        const since = Date.now() - windowMs;
        const out: IRoomEvent[] = [];
        let from: string | null = null;
        for (let page = 0; page < STICKY_HISTORY_PAGES; page++) {
            const res = await this.client().createMessagesRequest(
                roomId,
                from,
                STICKY_HISTORY_PAGE_SIZE,
                Direction.Backward,
            );
            const client = this.client();
            // Not re-emitted: these old events must not reach the app's own
            // decryption listeners (unread counts and the like).
            const mapper = client.getEventMapper({ preventReEmit: true });
            let reachedStart = false;
            for (const raw of res.chunk) {
                if ((raw.origin_server_ts ?? 0) < since) {
                    reachedStart = true;
                    break;
                }
                const event = mapper({ ...raw, room_id: roomId });
                if (event.isEncrypted()) {
                    await client.decryptEventIfNeeded(event);
                    this.client();
                    if (event.isDecryptionFailure()) continue;
                }
                out.push(toRaw(event));
            }
            if (reachedStart || !res.end || res.chunk.length === 0) break;
            from = res.end;
        }
        return out;
    }

    /** MSC4143 call transports: the same discovery Zam's own calls use. */
    override async getRtcTransports(): Promise<IRtcTransportsResult> {
        this.client();
        const foci = await configuredRtcFoci();
        if (!ownedClient(this.deps.owner)) throw new Error("client changed");
        const transports = foci.filter(
            (f): f is IRtcTransport =>
                !!f &&
                typeof f === "object" &&
                typeof (f as { type?: unknown }).type === "string",
        );
        return { rtc_transports: transports };
    }

    override async sendToDevice(
        eventType: string,
        encrypted: boolean,
        contentMap: { [userId: string]: { [deviceId: string]: object } },
    ): Promise<void> {
        if (encrypted) {
            for (const [userId, devices] of Object.entries(contentMap)) {
                for (const [deviceId, payload] of Object.entries(devices)) {
                    await this.client().encryptAndSendToDevice(
                        eventType,
                        [{ userId, deviceId }],
                        payload as Record<string, unknown>,
                    );
                }
            }
            return;
        }
        const map = new Map<string, Map<string, Record<string, unknown>>>();
        for (const [userId, devices] of Object.entries(contentMap)) {
            const inner = new Map<string, Record<string, unknown>>();
            for (const [deviceId, payload] of Object.entries(devices)) {
                inner.set(deviceId, payload as Record<string, unknown>);
            }
            map.set(userId, inner);
        }
        await this.client().sendToDevice(eventType, map);
    }

    override async readRoomTimeline(
        roomId: string,
        eventType: string,
        msgtype: string | undefined,
        stateKey: string | undefined,
        limit: number,
        since: string | undefined,
    ): Promise<IRoomEvent[]> {
        if (roomId !== this.deps.roomId) return [];
        const room = this.client().getRoom(roomId);
        if (!room) return [];
        return collectTimeline(room, {
            eventType,
            msgtype,
            stateKey,
            limit,
            since,
        });
    }

    override async readRoomEvents(
        eventType: string,
        msgtype: string | undefined,
        limit: number,
        _roomIds?: string[] | null,
        since?: string,
    ): Promise<IRoomEvent[]> {
        return this.readRoomTimeline(
            this.deps.roomId,
            eventType,
            msgtype,
            undefined,
            limit,
            since,
        );
    }

    /**
     * Pages the server's relations of `eventId`. The library default answers
     * with an empty list, which widgets that keep their data as related events
     * (NeoBoard's snapshots and chunks) read as "nothing saved yet": NeoBoard
     * then started from a blank board and saved it over the real one.
     */
    override async readEventRelations(
        eventId: string,
        roomId?: string,
        relationType?: string,
        eventType?: string,
        from?: string,
        to?: string,
        limit?: number,
        direction?: "f" | "b",
    ): Promise<IReadEventRelationsResult> {
        const target = this.resolveRoom(roomId);
        const { events, nextBatch, prevBatch } = await this.client().relations(
            target,
            eventId,
            relationType ?? null,
            eventType ?? null,
            {
                from,
                to,
                limit,
                dir:
                    direction === "f"
                        ? Direction.Forward
                        : direction === "b"
                          ? Direction.Backward
                          : undefined,
            },
        );
        return {
            chunk: events.map(toRaw),
            nextBatch: nextBatch ?? undefined,
            prevBatch: prevBatch ?? undefined,
        };
    }

    /**
     * Answers from the server, not the local state. Sliding sync loads only the
     * state types in SLIDING_ROOM_STATE, so a widget's own types (NeoBoard's
     * `net.nordeck.whiteboard`) are never in `room.currentState`. An empty answer
     * made NeoBoard create a new board over the existing one. Local state is the
     * fallback when the server cannot be reached. Live changes still arrive via
     * feedStateUpdate.
     */
    override async readRoomState(
        roomId: string,
        eventType: string,
        stateKey: string | undefined,
    ): Promise<IRoomEvent[]> {
        if (roomId !== this.deps.roomId) return [];
        this.client();
        let fetched: ServerStateEvent[] | null = null;
        try {
            fetched = await this.fetchRoomState();
        } catch (e) {
            console.warn("[zam] widget state read fell back to local state", e);
        }
        const client = ownedClientOrThrow(this.deps.owner);
        if (fetched)
            return filterStateEvents(fetched, roomId, eventType, stateKey);
        const room = client.getRoom(roomId);
        if (!room) return [];
        if (stateKey === undefined)
            return room.currentState.getStateEvents(eventType).map(toRaw);
        const ev = room.currentState.getStateEvents(eventType, stateKey);
        return ev ? [toRaw(ev)] : [];
    }

    override async readStateEvents(
        eventType: string,
        stateKey: string | undefined,
        _limit: number,
        _roomIds?: string[] | null,
    ): Promise<IRoomEvent[]> {
        return this.readRoomState(this.deps.roomId, eventType, stateKey);
    }

    /** The widget's own room's account data of one type. `_roomIds` is ignored: other rooms are never read. */
    override async readRoomAccountData(
        eventType: string,
        _roomIds?: string[] | null,
    ): Promise<IRoomAccountData[]> {
        const roomId = this.deps.roomId;
        const room = this.client().getRoom(roomId);
        const ev = room?.getAccountData(eventType);
        if (!ev) return [];
        return [{ type: eventType, room_id: roomId, content: ev.getContent() }];
    }

    override askOpenID(observer: SimpleObservable<IOpenIDUpdate>): void {
        observer.update({ state: OpenIDRequestState.PendingUserConfirmation });
        void this.resolveOpenId(observer);
    }

    private async resolveOpenId(
        observer: SimpleObservable<IOpenIDUpdate>,
    ): Promise<void> {
        let approved = false;
        try {
            approved = await this.deps.requestOpenId();
        } catch {
            approved = false;
        }
        if (!approved) {
            observer.update({ state: OpenIDRequestState.Blocked });
            return;
        }
        try {
            const token = await this.client().getOpenIdToken();
            observer.update({
                state: OpenIDRequestState.Allowed,
                token: {
                    access_token: token.access_token,
                    token_type: token.token_type,
                    matrix_server_name: token.matrix_server_name,
                    expires_in: token.expires_in,
                },
            });
        } catch (e) {
            console.warn("[zam] widget openid failed", e);
            observer.update({ state: OpenIDRequestState.Blocked });
        }
    }

    /** Opens a matrix link in Zam. Other urls are refused. */
    override async navigate(uri: string): Promise<void> {
        this.client();
        if (!parseMatrixLink(uri))
            throw new Error("widget navigation needs a matrix link");
        if (!this.deps.onNavigate) throw new Error("navigation not available");
        await this.deps.onNavigate(uri);
    }

    override async *getTurnServers(): AsyncGenerator<ITurnServer> {
        const client = ownedClient(this.deps.owner);
        if (!client) return;
        for (const server of client.getTurnServers()) {
            yield {
                uris: server.urls,
                username: server.username,
                password: server.credential,
            };
        }
    }

    override async searchUserDirectory(
        searchTerm: string,
        limit?: number,
    ): Promise<ISearchUserDirectoryResult> {
        const res = await this.client().searchUserDirectory({
            term: searchTerm,
            limit,
        });
        return {
            limited: res.limited,
            results: res.results.map((r) => ({
                userId: r.user_id,
                displayName: r.display_name,
                avatarUrl: r.avatar_url,
            })),
        };
    }

    override async getMediaConfig(): Promise<IGetMediaConfigResult> {
        return { ...(await this.client().getMediaConfig()) };
    }

    override async uploadFile(
        file: XMLHttpRequestBodyInit,
    ): Promise<{ contentUri: string }> {
        this.client();
        if (!(file instanceof File))
            throw new Error("widget upload needs a file");
        return { contentUri: await uploadContent(file) };
    }

    override async downloadFile(
        contentUri: string,
    ): Promise<{ file: XMLHttpRequestBodyInit }> {
        this.client();
        const http = mxcToHttp(contentUri);
        if (!http) throw new Error("widget download needs an mxc uri");
        return { file: await fetchMediaBytes(http, MAX_WIDGET_DOWNLOAD_BYTES) };
    }
}

// ---------------------------------------------------------------------------
// Mounting a widget in an iframe.
// ---------------------------------------------------------------------------

export interface MountedWidget {
    dispose(): void;
    setTheme(theme: "light" | "dark"): void;
    setLanguage(code: string): void;
    /** Opener side: tells the modal widget it was closed with `data`. */
    notifyModalClosed(data: IModalWidgetReturnData): void;
    /** Modal side: tells the opener that the button `id` was clicked. */
    notifyButtonClicked(id: string): void;
}

export interface MountWidgetOptions {
    iframe: HTMLIFrameElement;
    widget: RoomWidget;
    roomId: string;
    /** The already-templated url the iframe loads. Set on the iframe only if it has no src yet. */
    url: string;
    /** Ask the user. Gets the requested set, resolves with the approved subset. */
    requestCapabilities(requested: Set<string>): Promise<Set<string>>;
    /** Ask the user whether the widget may get an OpenID token (identity). */
    requestOpenId(): Promise<boolean>;
    /** Told which requested capabilities Zam cannot provide (never asked about). */
    onUnsupportedCapabilities?(caps: string[]): void;
    /** Opens a matrix link the widget navigated to. Without it navigation is refused. */
    onNavigate?(uri: string): Promise<void>;
    /**
     * Opener side: the widget asks to open a modal. Return false when one is
     * already open; the widget is then told so. Without it the library refuses.
     */
    onOpenModal?(data: IModalWidgetOpenRequestData): boolean;
    /** Set when this widget is itself shown as a modal of another widget. */
    modal?: {
        /** Sent to the modal widget as its widget_config once it is ready. */
        config: IModalWidgetOpenRequestData;
        onClose(data: IModalWidgetReturnData): void;
        onSetButtonEnabled(id: string, enabled: boolean): void;
    };
    onReady?(): void;
}

/**
 * Starts the widget API for `opts.widget` in `opts.iframe`. Live room events
 * and to-device messages are fed to the widget once it reports ready.
 * Returns a no-op handle when no client is logged in.
 */
export function mountWidget(opts: MountWidgetOptions): MountedWidget {
    const noop: MountedWidget = {
        dispose() {},
        setTheme() {},
        setLanguage() {},
        notifyModalClosed() {},
        notifyButtonClicked() {},
    };
    let owner: ClientOwnership<MatrixClient>;
    try {
        owner = captureClient();
    } catch {
        console.warn("[zam] widget mount without a client");
        return noop;
    }
    const client = owner.client;
    // A widget the user has open shows in rich presence. A modal of another
    // widget is part of that one, so it does not count again.
    if (!opts.modal) widgetOpened(opts.roomId, opts.widget);

    const widget = new Widget({
        id: opts.widget.id,
        creatorUserId: opts.widget.creatorUserId,
        type: opts.widget.type,
        url: opts.widget.url,
        name: opts.widget.name,
        data: opts.widget.data,
        waitForIframeLoad: opts.widget.waitForIframeLoad,
    });
    const driver = new ZamWidgetDriver({
        roomId: opts.roomId,
        owner,
        requestCapabilities: opts.requestCapabilities,
        requestOpenId: opts.requestOpenId,
        onUnsupportedCapabilities: opts.onUnsupportedCapabilities,
        onNavigate: opts.onNavigate,
    });
    const api = new ClientWidgetApi(widget, opts.iframe, driver);
    // Without a viewed room the API drops every fed event and state update
    // for a widget that has no timeline capability (most of them), and never
    // pushes the initial room state after capabilities are approved: the
    // widget then waits forever. The widget only ever sees its own room.
    api.setViewedRoomId(opts.roomId);
    // The API is listening for the iframe load now, so the caller sets the
    // src next. Setting it here as well would navigate the frame twice (a
    // second assignment of the same src reloads it) and break the handshake.

    let disposed = false;
    let ready = false;
    let theme: "light" | "dark" | null = null;
    let language: string | null = null;
    const modal = opts.modal;
    const unsubs: Array<() => void> = [];
    // Live encrypted events waiting for their decryption, and the ids already fed.
    const pendingEncrypted = new Set<string>();
    const fed = new Set<string>();
    const live = () => !disposed && ownedClient(owner) !== null;

    const feedEvent = (event: MatrixEvent) => {
        const id = event.getId();
        if (id) {
            if (fed.has(id)) return;
            rememberId(fed, id);
        }
        api.feedEvent(toRaw(event)).catch((e) =>
            console.warn("[zam] widget feedEvent failed", e),
        );
    };

    const attachFeeds = () => {
        const onTimeline = (
            event: MatrixEvent,
            room: Room | undefined,
            toStartOfTimeline?: boolean,
            removed?: boolean,
        ) => {
            if (!live() || toStartOfTimeline || removed) return;
            if (!room || room.roomId !== opts.roomId) return;
            // State events are fed here too, as Element does: a widget
            // without MSC2762 update_state only learns of them as send_event,
            // and feedStateUpdate below covers the ones that do support it.
            if (event.getType() === "m.room.encrypted") {
                const id = event.getId();
                if (id) rememberId(pendingEncrypted, id);
                return;
            }
            feedEvent(event);
        };
        const onState = (event: MatrixEvent) => {
            if (!live() || event.getRoomId() !== opts.roomId) return;
            api.feedStateUpdate(toRaw(event)).catch((e) =>
                console.warn("[zam] widget feedStateUpdate failed", e),
            );
        };
        const onDecrypted = (event: MatrixEvent) => {
            if (!live() || event.getRoomId() !== opts.roomId) return;
            const id = event.getId();
            if (!id || !pendingEncrypted.delete(id)) return;
            if (event.getType() === "m.room.encrypted") return;
            feedEvent(event);
        };
        const onToDevice = (event: MatrixEvent) => {
            if (!live() || event.getType() === "m.room.encrypted") return;
            const encrypted = event.getWireType() === "m.room.encrypted";
            api.feedToDevice(
                {
                    type: event.getType(),
                    sender: event.getSender() ?? "",
                    content: event.getContent(),
                },
                encrypted,
            ).catch((e) => console.warn("[zam] widget feedToDevice failed", e));
        };

        client.on(RoomEvent.Timeline as never, onTimeline as never);
        client.on(RoomStateEvent.Events as never, onState as never);
        client.on(MatrixEventEvent.Decrypted as never, onDecrypted as never);
        client.on(ClientEvent.ToDeviceEvent as never, onToDevice as never);
        unsubs.push(() => {
            client.off(RoomEvent.Timeline as never, onTimeline as never);
            client.off(RoomStateEvent.Events as never, onState as never);
            client.off(
                MatrixEventEvent.Decrypted as never,
                onDecrypted as never,
            );
            client.off(ClientEvent.ToDeviceEvent as never, onToDevice as never);
        });
    };

    api.on("ready", () => {
        if (disposed) return;
        ready = true;
        attachFeeds();
        if (theme) applyTheme(theme);
        if (language !== null) applyLanguage(language);
        if (modal) {
            api.sendWidgetConfig(modal.config).catch((e) =>
                console.warn("[zam] widget config failed", e),
            );
        }
        opts.onReady?.();
    });
    api.on("error:preparing", (e: unknown) => {
        console.warn("[zam] widget failed to prepare", e);
    });

    // Sticker sending: the widget's own room only, through the owned client.
    api.on("action:m.sticker", (ev: CustomEvent<IWidgetApiRequest>) => {
        if (!api.hasCapability("m.sticker")) return;
        ev.preventDefault();
        const data = ev.detail.data as Partial<IStickerActionRequestData>;
        const url = data.content?.url;
        if (typeof url !== "string" || !url.startsWith("mxc://")) {
            api.transport.reply(ev.detail, {
                error: { message: "a sticker needs an mxc url" },
            });
            return;
        }
        void (async () => {
            try {
                await ownedClientOrThrow(owner).sendEvent(
                    opts.roomId,
                    "m.sticker" as never,
                    {
                        body: data.description || data.name || "",
                        url,
                        info: data.content?.info ?? {},
                    } as never,
                );
                api.transport.reply(ev.detail, {});
            } catch (e) {
                api.transport.reply(ev.detail, {
                    error: {
                        message:
                            e instanceof Error ? e.message : "sticker not sent",
                        ...driver.processError(e),
                    },
                });
            }
        })();
    });

    // Always on screen: widgets stay mounted while open, so this is acknowledged.
    api.on(
        "action:set_always_on_screen",
        (ev: CustomEvent<IWidgetApiRequest>) => {
            if (
                !api.hasCapability("m.always_on_screen") &&
                !api.hasCapability("org.matrix.msc2931.always_on_screen")
            )
                return;
            ev.preventDefault();
            const res: IStickyActionResponseData = { success: true };
            api.transport.reply(ev.detail, res);
        },
    );

    // Modal widgets (MSC2790). The opener side asks to open one; the modal
    // side answers its close and button-state requests.
    api.on("action:open_modal", (ev: CustomEvent<IWidgetApiRequest>) => {
        if (!opts.onOpenModal) return;
        ev.preventDefault();
        const opened = opts.onOpenModal(
            ev.detail.data as IModalWidgetOpenRequestData,
        );
        api.transport.reply(
            ev.detail,
            opened ? {} : { error: { message: "a modal is already open" } },
        );
    });
    api.on("action:close_modal", (ev: CustomEvent<IWidgetApiRequest>) => {
        if (!modal) return;
        ev.preventDefault();
        api.transport.reply(ev.detail, {});
        modal.onClose(ev.detail.data as IModalWidgetReturnData);
    });
    api.on(
        "action:set_button_enabled",
        (ev: CustomEvent<IWidgetApiRequest>) => {
            if (!modal) return;
            ev.preventDefault();
            const data = ev.detail.data as {
                button?: unknown;
                enabled?: unknown;
            };
            if (
                typeof data.button !== "string" ||
                typeof data.enabled !== "boolean"
            ) {
                api.transport.reply(ev.detail, {
                    error: {
                        message: "set_button_enabled needs button and enabled",
                    },
                });
                return;
            }
            api.transport.reply(ev.detail, {});
            modal.onSetButtonEnabled(data.button, data.enabled);
        },
    );

    const applyTheme = (next: "light" | "dark") => {
        api.updateTheme({ name: next }).catch((e) =>
            console.warn("[zam] widget theme update failed", e),
        );
    };

    const applyLanguage = (code: string) => {
        api.updateLanguage(code).catch((e) =>
            console.warn("[zam] widget language update failed", e),
        );
    };

    return {
        dispose() {
            if (disposed) return;
            disposed = true;
            ready = false;
            if (!modal) widgetClosed(opts.roomId, opts.widget.id);
            for (const off of unsubs) off();
            try {
                api.stop();
            } catch (e) {
                console.warn("[zam] widget stop failed", e);
            }
            api.removeAllListeners();
        },
        setTheme(next) {
            theme = next;
            if (!disposed && ready) applyTheme(next);
        },
        setLanguage(next) {
            language = next;
            if (!disposed && ready) applyLanguage(next);
        },
        notifyModalClosed(data) {
            if (disposed || !ready) return;
            api.notifyModalWidgetClose(data).catch((e) =>
                console.warn("[zam] widget modal close failed", e),
            );
        },
        notifyButtonClicked(id) {
            if (disposed || !ready) return;
            api.notifyModalWidgetButtonClicked(id).catch((e) =>
                console.warn("[zam] widget button notify failed", e),
            );
        },
    };
}

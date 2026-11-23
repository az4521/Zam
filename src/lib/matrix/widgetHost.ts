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
    MatrixEventEvent,
    RoomEvent,
    RoomStateEvent,
    type MatrixClient,
    type MatrixEvent,
    type Room,
} from "matrix-js-sdk";
import {
    ClientWidgetApi,
    EventKind,
    OpenIDRequestState,
    SimpleObservable,
    Widget,
    WidgetDriver,
    WidgetEventCapability,
    type Capability,
    type IGetMediaConfigResult,
    type IOpenIDUpdate,
    type IRoomAccountData,
    type IRoomEvent,
    type ISearchUserDirectoryResult,
    type ISendEventDetails,
    type ITurnServer,
} from "matrix-widget-api";
import {
    captureClient,
    getClient,
    ownedClient,
    ownedClientOrThrow,
} from "$lib/matrix/runtime";
import type { ClientOwnership } from "$lib/utils/clientGeneration";
import { mxcToHttp, fetchMediaBytes, uploadContent } from "$lib/matrix/media";
import {
    WIDGET_STATE_TYPES,
    dedupeWidgets,
    isCallWidget,
    parseWidgetState,
    type RoomWidget,
    type WidgetUrlContext,
} from "$lib/utils/widgets";

const WIDGET_STATE_TYPE = "im.vector.modular.widgets";
const APP_CLIENT_ID = "moe.crafty.zam";
/** Upper bound for a widget-initiated media download. */
const MAX_WIDGET_DOWNLOAD_BYTES = 100 * 1024 * 1024;
/** Bounded memory for the event ids a live feed has already delivered. */
const FED_ID_LIMIT = 500;

function isWidgetStateType(type: string): boolean {
    return (WIDGET_STATE_TYPES as readonly string[]).includes(type);
}

/**
 * Capabilities Zam does not implement are dropped before the user is asked,
 * so a prompt never offers something the driver would then reject:
 * delayed and sticky events, RTC transports and LiveKit tokens, and room
 * account data.
 */
const UNSUPPORTED_CAPABILITY_PREFIXES = [
    "org.matrix.msc4157.",
    "org.matrix.msc4407.",
    "org.matrix.msc4515.",
    "org.matrix.msc4533.",
];

function isSupportedCapability(cap: string): boolean {
    if (UNSUPPORTED_CAPABILITY_PREFIXES.some((p) => cap.startsWith(p)))
        return false;
    const [parsed] = WidgetEventCapability.findEventCapabilities([cap]);
    return parsed?.kind !== EventKind.RoomAccount;
}

function rememberId(set: Set<string>, id: string): void {
    set.add(id);
    if (set.size > FED_ID_LIMIT) {
        const oldest = set.values().next().value;
        if (oldest !== undefined) set.delete(oldest);
    }
}

function toRaw(event: MatrixEvent): IRoomEvent {
    return event.getEffectiveEvent() as unknown as IRoomEvent;
}

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

    /** The bound room only: a widget may not act on another room. */
    private resolveRoom(requested: string | null | undefined): string {
        if (!requested || requested === this.deps.roomId)
            return this.deps.roomId;
        throw new Error("widget may only act on its own room");
    }

    override getKnownRooms(): string[] {
        return [this.deps.roomId];
    }

    override async validateCapabilities(
        requested: Set<Capability>,
    ): Promise<Set<Capability>> {
        const supported = new Set<string>();
        for (const cap of requested)
            if (isSupportedCapability(cap)) supported.add(cap);
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

    override async readRoomState(
        roomId: string,
        eventType: string,
        stateKey: string | undefined,
    ): Promise<IRoomEvent[]> {
        if (roomId !== this.deps.roomId) return [];
        const room = this.client().getRoom(roomId);
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

    override async readRoomAccountData(
        _eventType: string,
        _roomIds?: string[] | null,
    ): Promise<IRoomAccountData[]> {
        // Not offered: room account data is filtered out of the capability prompt.
        return [];
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

    override async navigate(uri: string): Promise<void> {
        // Only matrix.to permalinks. Zam does not route widget navigation yet,
        // so the request is accepted and nothing happens.
        if (!uri.startsWith("https://matrix.to/#/")) {
            throw new Error("widget navigation is limited to matrix.to links");
        }
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
    onReady?(): void;
}

/**
 * Starts the widget API for `opts.widget` in `opts.iframe`. Live room events
 * and to-device messages are fed to the widget once it reports ready.
 * Returns a no-op handle when no client is logged in.
 */
export function mountWidget(opts: MountWidgetOptions): MountedWidget {
    const noop: MountedWidget = { dispose() {}, setTheme() {} };
    let owner: ClientOwnership<MatrixClient>;
    try {
        owner = captureClient();
    } catch {
        console.warn("[zam] widget mount without a client");
        return noop;
    }
    const client = owner.client;

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
    });
    const api = new ClientWidgetApi(widget, opts.iframe, driver);
    // The API is listening for the iframe load now, so the caller sets the
    // src next. Setting it here as well would navigate the frame twice (a
    // second assignment of the same src reloads it) and break the handshake.

    let disposed = false;
    let ready = false;
    let theme: "light" | "dark" | null = null;
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
            // State events reach the widget through RoomStateEvent below.
            if (event.isState()) return;
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
        opts.onReady?.();
    });
    api.on("error:preparing", (e: unknown) => {
        console.warn("[zam] widget failed to prepare", e);
    });

    const applyTheme = (next: "light" | "dark") => {
        api.updateTheme({ name: next }).catch((e) =>
            console.warn("[zam] widget theme update failed", e),
        );
    };

    return {
        dispose() {
            if (disposed) return;
            disposed = true;
            ready = false;
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
    };
}

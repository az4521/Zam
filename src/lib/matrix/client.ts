import {
    createClient,
    ClientEvent,
    RoomEvent,
    RoomMemberEvent,
    PendingEventOrdering,
    EventStatus,
    EventTimeline,
    MatrixEvent,
    NotificationCountType,
    PushRuleKind,
    PushRuleActionName,
    RuleId,
    IndexedDBStore,
    ConditionKind,
    HttpApiEvent,
} from "matrix-js-sdk";
import type { MatrixClient, Room, RoomMember } from "matrix-js-sdk";
import { settingsState } from "$lib/stores/settings.svelte";
import { parseMarkdown } from "$lib/utils/markdown";
import { buildReplyContent } from "$lib/utils/replyContent";
import {
    buildThreadReplyContent,
    isThreadReplyContent,
} from "$lib/utils/threadContent";

let matrixClient: MatrixClient | null = null;
let matrixStore: IndexedDBStore | null = null;

export function getClient(): MatrixClient | null {
    return matrixClient;
}

function getIndexedDBFactory(): IDBFactory | null {
    try {
        return globalThis.indexedDB ?? null;
    } catch {
        return null;
    }
}

function getLocalStorage(): Storage | undefined {
    try {
        return globalThis.localStorage;
    } catch {
        return undefined;
    }
}

function getSyncDbName(userId: string, deviceId: string): string {
    return `matrix-client:${encodeURIComponent(userId)}:${encodeURIComponent(deviceId)}:sync`;
}

async function createAuthenticatedClient(opts: {
    baseUrl: string;
    accessToken: string;
    userId: string;
    deviceId: string;
}): Promise<MatrixClient> {
    matrixClient?.stopClient();
    matrixStore?.destroy().catch(() => {});
    matrixStore = null;

    const indexedDB = getIndexedDBFactory();
    const store = indexedDB
        ? new IndexedDBStore({
              indexedDB,
              localStorage: getLocalStorage(),
              dbName: getSyncDbName(opts.userId, opts.deviceId),
          })
        : null;

    let client = createClient({
        ...opts,
        store: store ?? undefined,
        timelineSupport: true,
    });

    if (store) {
        try {
            await store.startup();
            matrixStore = store;
        } catch (err) {
            console.warn(
                "[matrix] IndexedDB store startup failed; falling back to memory store",
                err,
            );
            client = createClient({
                ...opts,
                timelineSupport: true,
            });
        }
    }

    matrixClient = client;
    return client;
}

async function resolveHomeserver(input: string): Promise<string> {
    const normalized = input.trim().replace(/\/$/, "");
    const withProtocol = normalized.startsWith("http")
        ? normalized
        : `https://${normalized}`;
    try {
        const res = await fetch(`${withProtocol}/.well-known/matrix/client`);
        if (res.ok) {
            const data = await res.json();
            const baseUrl: string | undefined =
                data?.["m.homeserver"]?.["base_url"];
            if (baseUrl) return baseUrl.replace(/\/$/, "");
        }
    } catch {
        // .well-known not available, use input as-is
    }
    return withProtocol;
}

export async function login(
    homeserverUrl: string,
    username: string,
    password: string,
): Promise<{
    userId: string;
    accessToken: string;
    deviceId: string;
    homeserverUrl: string;
}> {
    const resolvedBase = await resolveHomeserver(homeserverUrl);
    const tempClient = createClient({ baseUrl: resolvedBase });

    const response = await tempClient.login("m.login.password", {
        user: username,
        password: password,
        initial_device_display_name: "Matrix Svelte Client",
    });

    const resolvedURL = tempClient.getHomeserverUrl();

    tempClient.stopClient();

    await createAuthenticatedClient({
        baseUrl: resolvedURL,
        accessToken: response.access_token!,
        userId: response.user_id,
        deviceId: response.device_id!,
    });

    return {
        userId: response.user_id,
        accessToken: response.access_token!,
        deviceId: response.device_id!,
        homeserverUrl: resolvedURL,
    };
}

export async function register(
    homeserverUrl: string,
    username: string,
    password: string,
    registrationToken?: string,
): Promise<{
    userId: string;
    accessToken: string;
    deviceId: string;
    homeserverUrl: string;
}> {
    const resolvedBase = await resolveHomeserver(homeserverUrl);
    const tempClient = createClient({ baseUrl: resolvedBase });

    const body: Record<string, unknown> = {
        username,
        password,
        initial_device_display_name: "Matrix Svelte Client",
        inhibit_login: false,
    };

    if (registrationToken) {
        body.auth = {
            type: "m.login.registration_token",
            token: registrationToken,
        };
    }

    const response = await tempClient.registerRequest(body);
    const resolvedURL = tempClient.getHomeserverUrl();
    tempClient.stopClient();

    await createAuthenticatedClient({
        baseUrl: resolvedURL,
        accessToken: response.access_token!,
        userId: response.user_id,
        deviceId: response.device_id!,
    });

    return {
        userId: response.user_id,
        accessToken: response.access_token!,
        deviceId: response.device_id!,
        homeserverUrl: resolvedURL,
    };
}

export async function reconnect(
    homeserverUrl: string,
    userId: string,
    accessToken: string,
    deviceId: string,
): Promise<void> {
    await createAuthenticatedClient({
        baseUrl: homeserverUrl,
        accessToken,
        userId,
        deviceId,
    });
}

// False until the first PREPARED (i.e. the initial sync has finished). Used to
// suppress notification sounds/popups for the backlog of events replayed on
// page load — the user should only be alerted for events that arrive live.
let initialSyncComplete = false;

/** True once the initial sync has finished and incoming events are genuinely new. */
export function isInitialSyncComplete(): boolean {
    return initialSyncComplete;
}

export async function startSync(
    onStateChange: (state: string) => void,
    onSessionExpired?: () => void,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");

    initialSyncComplete = false;
    matrixClient.on(ClientEvent.Sync, (state) => {
        if (state === "PREPARED") initialSyncComplete = true;
        onStateChange(state as string);
    });

    // Fired when any request comes back with M_UNKNOWN_TOKEN (token revoked,
    // password changed, device deleted, server data wiped). Without this the
    // client sits in a permanent sync-error state with no path back to login.
    if (onSessionExpired) {
        matrixClient.on(HttpApiEvent.SessionLoggedOut, onSessionExpired);
    }

    await matrixClient.startClient({
        initialSyncLimit: 8,
        lazyLoadMembers: true,
        pendingEventOrdering: PendingEventOrdering.Detached,
    });
}

/** Retry a failed (NOT_SENT) local echo. */
export async function resendMessage(event: MatrixEvent): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const room = matrixClient.getRoom(event.getRoomId() ?? "");
    if (!room) return;
    await matrixClient.resendEvent(event, room);
}

/** Discard a failed (NOT_SENT) local echo, removing it from the queue. */
export function deleteFailedMessage(event: MatrixEvent): void {
    if (!matrixClient) return;
    matrixClient.cancelPendingEvent(event);
}

const FAV_GIFS_KEY = "m.favourite_gifs";

export interface FavouriteGif {
    url: string;
    previewUrl: string;
    addedAt: number;
}

export function loadFavouriteGifs(): FavouriteGif[] {
    if (!matrixClient) return [];
    const event = matrixClient.getAccountData(FAV_GIFS_KEY);
    return (event?.getContent()?.gifs as FavouriteGif[] | undefined) ?? [];
}

export async function persistFavouriteGifs(
    gifs: FavouriteGif[],
): Promise<void> {
    if (!matrixClient) return;
    await matrixClient.setAccountData(FAV_GIFS_KEY, { gifs });
}

export function onAccountData(callback: (type: string) => void): () => void {
    if (!matrixClient) return () => {};
    const handler = (event: MatrixEvent) => callback(event.getType());
    matrixClient.on(ClientEvent.AccountData, handler as never);
    return () => matrixClient?.off(ClientEvent.AccountData, handler as never);
}

export function onSyncPrepared(callback: () => void): () => void {
    if (!matrixClient) return () => {};
    const handler = (state: string) => {
        if (state === "PREPARED") callback();
    };
    matrixClient.on(ClientEvent.Sync, handler as never);
    return () => matrixClient?.off(ClientEvent.Sync, handler as never);
}

export async function logout(): Promise<void> {
    const client = matrixClient;
    if (client) {
        try {
            // stopClient=true; invalidates the token server-side.
            await client.logout(true);
        } catch {
            // ignore errors on logout
        }
        // Wipe the persisted sync store so the next user on this device can't
        // recover the previous account's cached rooms/messages from IndexedDB.
        try {
            await client.clearStores();
        } catch {
            // ignore
        }
    }
    matrixClient = null;
    matrixStore = null;
}

export function stopClient(): void {
    matrixClient?.stopClient();
    matrixClient = null;
    matrixStore?.destroy().catch(() => {});
    matrixStore = null;
}

const pendingLeaves = new Set<string>();

export function getRooms(): Room[] {
    return (matrixClient?.getRooms() ?? []).filter(
        (r) => r.getMyMembership() === "join" && !pendingLeaves.has(r.roomId),
    );
}

export function getRoom(roomId: string): Room | null {
    return matrixClient?.getRoom(roomId) ?? null;
}

export function getSpaces(): Room[] {
    return getRooms().filter((r) => r.isSpaceRoom());
}

export function getSpaceChildIds(spaceId: string): string[] {
    const space = matrixClient?.getRoom(spaceId);
    if (!space) return [];

    const events = space
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents("m.space.child");
    const arr = Array.isArray(events) ? events : events ? [events] : [];

    return arr
        .filter((e) => {
            const content = e.getContent();
            return content?.via?.length > 0;
        })
        .sort((a, b) => {
            const ao: string | undefined = a.getContent()?.order;
            const bo: string | undefined = b.getContent()?.order;
            if (ao !== undefined && bo !== undefined)
                return ao < bo ? -1 : ao > bo ? 1 : 0;
            if (ao !== undefined) return -1;
            if (bo !== undefined) return 1;
            // Both lack order: sort by room ID for stability
            return (a.getStateKey() ?? "") < (b.getStateKey() ?? "") ? -1 : 1;
        })
        .map((e) => e.getStateKey()!)
        .filter(Boolean);
}

/**
 * Find a space (top-level, joined) that contains the given room as a child.
 * Returns null if the room isn't in any space (i.e. it's a home/DM/orphan room).
 * Used to select the right space when jumping to a room from elsewhere.
 */
export function findSpaceForRoom(roomId: string): string | null {
    for (const space of getSpaces()) {
        if (space.getMyMembership() !== "join") continue;
        if (getSpaceChildIds(space.roomId).includes(roomId)) {
            return space.roomId;
        }
    }
    return null;
}

export function getRoomsInSpace(spaceId: string): Room[] {
    const childIds = getSpaceChildIds(spaceId);
    return childIds
        .map((id) => matrixClient?.getRoom(id))
        .filter(
            (r): r is Room =>
                !!r &&
                !r.isSpaceRoom() &&
                r.getMyMembership() === "join" &&
                !pendingLeaves.has(r.roomId),
        );
}

export function getDirectRoomIds(): Set<string> {
    const directEvent = matrixClient?.getAccountData("m.direct");
    if (!directEvent) return new Set();
    const content = directEvent.getContent() as Record<string, string[]>;
    return new Set(Object.values(content).flat());
}

export function getOrphanRooms(): Room[] {
    const allSpaceChildIds = new Set<string>();
    getSpaces().forEach((space) => {
        getSpaceChildIds(space.roomId).forEach((id) =>
            allSpaceChildIds.add(id),
        );
    });

    const directIds = getDirectRoomIds();

    return getRooms().filter(
        (r) =>
            !r.isSpaceRoom() &&
            !allSpaceChildIds.has(r.roomId) &&
            !directIds.has(r.roomId),
    );
}

export function getDirectRooms(): Room[] {
    const directIds = getDirectRoomIds();
    return getRooms().filter(
        (r) => directIds.has(r.roomId) && !r.isSpaceRoom(),
    );
}

export function getTimelineMessages(room: Room): MatrixEvent[] {
    // Debug mode: surface every timeline event (state events, edits, redacted,
    // reactions, etc) instead of just renderable messages.
    const showAll = settingsState.showAllEvents;
    const filter = (e: MatrixEvent) => {
        if (showAll) return true;
        if (e.isRedacted()) return false;
        if (e.getType() !== "m.room.message" && e.getType() !== "m.sticker")
            return false;
        const rel = e.getContent()?.["m.relates_to"];
        if (rel?.rel_type === "m.replace") return false;
        return true;
    };
    const timeline = room.getLiveTimeline().getEvents().filter(filter);
    // Include pending (local echo) events. Keep NOT_SENT echoes so the user
    // can see a failed send and retry/delete it (see resendMessage /
    // deleteFailedMessage); only drop ones already cancelled.
    const pending = room
        .getPendingEvents()
        .filter((e) => filter(e) && e.status !== EventStatus.CANCELLED);
    return [...timeline, ...pending];
}

export function getLatestTimelineEvent(room: Room): MatrixEvent {
    const timeline = room.getLiveTimeline().getEvents();
    return timeline[timeline.length - 1];
}

// ── Threads (lightweight) ──────────────────────────────────────────────────
// Thread replies (m.thread relations) are read directly from the room's live
// timeline rather than the SDK's Thread model, so they also stay visible
// inline in the main timeline. The relation is read from each event's original
// content, since an edit moves the top-level relation to m.replace.

function eventThreadRoot(event: MatrixEvent): string | null {
    const rel = event.getOriginalContent()?.["m.relates_to"];
    return rel?.rel_type === "m.thread" ? (rel.event_id ?? null) : null;
}

export function getThreadMessages(
    room: Room,
    rootEventId: string,
): MatrixEvent[] {
    const belongs = (e: MatrixEvent) =>
        isThreadReplyContent({
            type: e.getType(),
            isRedacted: e.isRedacted(),
            relatesTo: e.getOriginalContent()?.["m.relates_to"],
            rootEventId,
        });
    const timeline = room.getLiveTimeline().getEvents().filter(belongs);
    const pending = room
        .getPendingEvents()
        .filter((e) => belongs(e) && e.status !== EventStatus.CANCELLED);
    return [...timeline, ...pending];
}

export interface ThreadSummary {
    count: number;
    latestEventId: string | null;
    latestTs: number;
}

export function getThreadSummary(
    room: Room,
    rootEventId: string,
): ThreadSummary {
    const messages = getThreadMessages(room, rootEventId);
    const latest = messages[messages.length - 1] ?? null;
    return {
        count: messages.length,
        latestEventId: latest?.getId() ?? null,
        latestTs: latest?.getTs() ?? 0,
    };
}

export async function sendThreadReply(
    roomId: string,
    rootEventId: string,
    text: string,
    mentions?: { user_ids?: string[]; room?: boolean },
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const room = matrixClient.getRoom(roomId);
    const latestEventId =
        (room && getThreadSummary(room, rootEventId).latestEventId) ||
        rootEventId;
    const { formattedBody, hasFormatting } = parseMarkdown(text);
    const content = buildThreadReplyContent({
        rootEventId,
        latestEventId,
        text,
        formattedText: hasFormatting ? formattedBody : undefined,
        mentions,
    });
    await matrixClient.sendMessage(roomId, content as never);
}

// Fires when a thread reply, an edit, or a redaction lands on the timeline, so
// an open ThreadPanel can re-read. Broad by design — the panel re-derives.
export function onThreadEvent(callback: () => void): () => void {
    if (!matrixClient) return () => {};
    const handler = (event: MatrixEvent) => {
        const isThread = eventThreadRoot(event) !== null;
        const relType = event.getContent()?.["m.relates_to"]?.rel_type;
        const isEdit = relType === "m.replace";
        const isRedaction = event.getType() === "m.room.redaction";
        if (isThread || isEdit || isRedaction) callback();
    };
    matrixClient.on(RoomEvent.Timeline, handler as never);
    return () => matrixClient?.off(RoomEvent.Timeline, handler as never);
}

async function captureVideoThumbnail(file: File): Promise<{
    blob: Blob;
    w: number;
    h: number;
    thumbW: number;
    thumbH: number;
} | null> {
    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        const cleanup = () => URL.revokeObjectURL(objectUrl);
        video.onerror = () => {
            cleanup();
            resolve(null);
        };
        video.onloadedmetadata = () => {
            // Seek to 10% into the video (or 1s, whichever is smaller) to get past black frames
            video.currentTime = Math.min(1, video.duration * 0.1);
        };
        video.onseeked = () => {
            const w = video.videoWidth;
            const h = video.videoHeight;
            const MAX = 800;
            const scale = Math.min(1, MAX / Math.max(w, h));
            const thumbW = Math.round(w * scale);
            const thumbH = Math.round(h * scale);
            const canvas = document.createElement("canvas");
            canvas.width = thumbW;
            canvas.height = thumbH;
            canvas.getContext("2d")!.drawImage(video, 0, 0, thumbW, thumbH);
            canvas.toBlob(
                (blob) => {
                    cleanup();
                    if (blob) resolve({ blob, w, h, thumbW, thumbH });
                    else resolve(null);
                },
                "image/jpeg",
                0.85,
            );
        };
        video.src = objectUrl;
    });
}

export async function sendFile(roomId: string, file: File): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const { content_uri } = await matrixClient.uploadContent(file, {
        name: file.name,
    });
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");
    const msgtype = isImage
        ? "m.image"
        : isVideo
          ? "m.video"
          : isAudio
            ? "m.audio"
            : "m.file";

    const info: Record<string, unknown> = {
        mimetype: file.type,
        size: file.size,
    };

    if (isVideo) {
        const thumb = await captureVideoThumbnail(file);
        if (thumb) {
            const thumbFile = new File([thumb.blob], "thumbnail.jpg", {
                type: "image/jpeg",
            });
            const { content_uri: thumb_uri } = await matrixClient.uploadContent(
                thumbFile,
                { name: "thumbnail.jpg" },
            );
            info.w = thumb.w;
            info.h = thumb.h;
            info.thumbnail_url = thumb_uri;
            info.thumbnail_info = {
                mimetype: "image/jpeg",
                w: thumb.thumbW,
                h: thumb.thumbH,
                size: thumb.blob.size,
            };
        }
    }

    await matrixClient.sendMessage(roomId, {
        msgtype,
        body: file.name,
        url: content_uri,
        info,
    } as never);
}

export async function sendTextMessage(
    roomId: string,
    text: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    // Pass null threadId explicitly — the SDK's overload shim treats any string
    // starting with "$" as a thread ID, which would mangle messages like "$foo".
    await matrixClient.sendTextMessage(roomId, null, text);
}

export async function sendFormattedMessage(
    roomId: string,
    body: string,
    formattedBody: string,
    mentions?: { user_ids?: string[]; room?: boolean },
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.sendMessage(roomId, {
        msgtype: "m.text",
        body,
        format: "org.matrix.custom.html",
        formatted_body: formattedBody,
        ...(mentions ? { "m.mentions": mentions } : {}),
    } as never);
}

export function mxcToHttp(
    mxcUrl: string | null | undefined,
    width = 0,
    height: number | undefined = undefined,
    method = "crop",
): string | null {
    if (!matrixClient || !mxcUrl?.startsWith("mxc://")) return null;
    const match = mxcUrl.match(/^mxc:\/\/([^/]+)\/(.+)$/);
    if (!match) return null;
    const [, serverName, mediaId] = match;
    const baseUrl = matrixClient.getHomeserverUrl();
    if (width > 0) {
        height = height ?? width;
        return `${baseUrl}/_matrix/client/v1/media/thumbnail/${serverName}/${mediaId}?width=${width}&height=${height}&method=${method}`;
    }
    return `${baseUrl}/_matrix/client/v1/media/download/${serverName}/${mediaId}`;
}

/** Fetch an attachment from the homeserver with auth and return an object URL for use in <video/audio src> and file downloads. */
export async function fetchAttachmentBlob(httpUrl: string): Promise<string> {
    const token = matrixClient?.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const resp = await fetch(httpUrl, { headers });
    if (!resp.ok) throw new Error(`Failed to fetch video: ${resp.status}`);
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
}

/** HEAD-request a URL (with auth for homeserver URLs) and return its Content-Type. */
export async function getContentType(url: string): Promise<string | null> {
    if (!matrixClient) return null;
    const accessToken = matrixClient.getAccessToken();
    const baseUrl = matrixClient.getHomeserverUrl();
    const headers: Record<string, string> = {};
    if (accessToken && url.startsWith(baseUrl)) {
        headers.Authorization = `Bearer ${accessToken}`;
    }
    try {
        const res = await fetch(url, { method: "HEAD", headers });
        return res.ok ? res.headers.get("content-type") : null;
    } catch {
        return null;
    }
}

/** Register the service worker and send it the current auth credentials. */
export async function initServiceWorker(): Promise<void> {
    if (!("serviceWorker" in navigator) || !matrixClient) return;
    const token = matrixClient.getAccessToken();
    const hsUrl = matrixClient.getHomeserverUrl();
    if (!token || !hsUrl) return;
    try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({
            type: "SET_AUTH",
            accessToken: token,
            homeserverUrl: hsUrl,
        });
    } catch (e) {
        console.error("[SW] registration failed", e);
    }
}

/** Send updated auth credentials to an already-registered service worker. */
export function updateServiceWorkerAuth(): void {
    if (!matrixClient) return;
    const token = matrixClient.getAccessToken();
    const hsUrl = matrixClient.getHomeserverUrl();
    if (!token || !hsUrl) return;
    navigator.serviceWorker.ready
        .then((reg) => {
            reg.active?.postMessage({
                type: "SET_AUTH",
                accessToken: token,
                homeserverUrl: hsUrl,
            });
        })
        .catch(() => {});
}

/** Tell the service worker to forget the stored access token (on logout). */
export function clearServiceWorkerAuth(): void {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: "CLEAR_AUTH" }))
        .catch(() => {});
}

export interface UrlPreview {
    title?: string;
    description?: string;
    imageUrl?: string;
    videoUrl?: string;
    siteName?: string;
    canonicalUrl?: string;
    /** MIME type or og:type returned by the homeserver preview (e.g. "video/mp4") */
    contentType?: string;
}

/** Returns the raw homeserver URL preview response object, useful for debugging. */
export async function getRawUrlPreview(
    url: string,
): Promise<Record<string, unknown> | null> {
    if (!matrixClient) return null;
    try {
        return (await matrixClient.getUrlPreview(url, Date.now())) as Record<
            string,
            unknown
        >;
    } catch (e) {
        return { error: String(e) };
    }
}

export async function getUrlPreview(url: string): Promise<UrlPreview | null> {
    if (!matrixClient) return null;
    try {
        const data = await matrixClient.getUrlPreview(url, Date.now());
        const ogImage = data["og:image"] as string | undefined;
        const imageUrl = ogImage?.startsWith("mxc://")
            ? (mxcToHttp(ogImage) ?? undefined)
            : ogImage;
        const rawVideo = (data["og:video:secure_url"] ??
            data["og:video:url"] ??
            data["og:video"]) as string | undefined;
        const videoUrl = rawVideo?.startsWith("mxc://")
            ? (mxcToHttp(rawVideo) ?? undefined)
            : rawVideo;
        return {
            title: data["og:title"] as string | undefined,
            description: data["og:description"] as string | undefined,
            imageUrl,

            videoUrl,
            siteName: data["og:site_name"] as string | undefined,
            canonicalUrl: (data["og:url"] as string | undefined) ?? url,
            contentType: data["og:type"] as string | undefined,
        };
    } catch {
        return null;
    }
}

export function getOwnUserId(): string | null {
    return matrixClient?.getUserId() ?? null;
}

/** Returns true if this event matches a push rule that would play a sound. */
export function isLoudEvent(event: MatrixEvent): boolean {
    if (!matrixClient) return false;
    if (event.getSender() === matrixClient.getUserId()) return false;
    try {
        const actions = matrixClient.getPushActionsForEvent(event);
        return !!(actions?.notify && (actions.tweaks as any)?.sound);
    } catch {
        return false;
    }
}

export interface ServerNotification {
    actions: unknown[];
    event: MatrixEvent;
    profile_tag: string | null;
    read: boolean;
    room_id: string;
    ts: number;
}

/**
 * Fetches the user's notification history from the homeserver via
 * `GET /_matrix/client/v3/notifications`. Returns null if the server
 * doesn't support it (e.g. 404).
 */
export async function fetchServerNotifications(
    limit = 50,
    from?: string,
): Promise<{
    notifications: ServerNotification[];
    nextToken?: string;
} | null> {
    if (!matrixClient) return null;
    const params: Record<string, string> = { limit: String(limit) };
    if (from) params.from = from;
    try {
        const res: any = await (matrixClient as any).http.authedRequest(
            "GET",
            "/notifications",
            params,
        );
        const mapper = matrixClient.getEventMapper();
        const notifications: ServerNotification[] = (
            res?.notifications ?? []
        ).map((n: any) => ({
            actions: n.actions ?? [],
            event: mapper(n.event),
            profile_tag: n.profile_tag ?? null,
            read: !!n.read,
            room_id: n.room_id,
            ts: n.ts,
        }));
        return { notifications, nextToken: res?.next_token };
    } catch (err: any) {
        if (err?.httpStatus === 404 || err?.errcode === "M_UNRECOGNIZED") {
            return null;
        }
        console.warn("[notifications] fetch failed:", err);
        return null;
    }
}

export function getOwnAvatarUrl(): string | null {
    const userId = matrixClient?.getUserId();
    if (!userId) return null;
    const mxc = matrixClient?.getUser(userId)?.avatarUrl;
    return mxcToHttp(mxc);
}

// ── Own profile ────────────────────────────────────────────────────────────

export function getOwnDisplayName(): string | null {
    const userId = matrixClient?.getUserId();
    if (!userId) return null;
    return matrixClient?.getUser(userId)?.displayName ?? null;
}

export function getOwnAvatarMxc(): string | null {
    const userId = matrixClient?.getUserId();
    if (!userId) return null;
    return matrixClient?.getUser(userId)?.avatarUrl ?? null;
}

/** Fetch the logged-in user's profile fresh from the server. */
export async function fetchOwnProfile(): Promise<{
    displayName: string | null;
    avatarMxc: string | null;
}> {
    const userId = matrixClient?.getUserId();
    if (!matrixClient || !userId) {
        return { displayName: null, avatarMxc: null };
    }
    const profile = await matrixClient.getProfileInfo(userId);
    return {
        displayName: profile.displayname ?? null,
        avatarMxc: profile.avatar_url ?? null,
    };
}

export async function setOwnDisplayName(name: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.setDisplayName(name);
}

/** Set (mxc URI) or clear (empty string) the logged-in user's avatar. */
export async function setOwnAvatarMxc(mxc: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.setAvatarUrl(mxc);
}

export function getRoomDisplayName(room: Room): string {
    return room.name || room.roomId;
}

export function getMemberName(room: Room, userId: string): string {
    return room.getMember(userId)?.name || userId;
}

export function getMemberAvatar(room: Room, userId: string): string | null {
    const mxc = room.getMember(userId)?.getMxcAvatarUrl();
    return mxcToHttp(mxc);
}

export function getRoomMembers(room: Room): RoomMember[] {
    return room.getMembers().filter((m) => m.membership === "join");
}

export async function loadRoomMembersIfNeeded(room: Room): Promise<void> {
    await room.loadMembersIfNeeded();
}

export function getRoomTopic(room: Room): string | null {
    const topicEvent = room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents("m.room.topic", "");
    return topicEvent?.getContent()?.topic || null;
}

export function getRoomAvatar(room: Room): string | null {
    const avatarEvent = room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents("m.room.avatar", "");
    const mxc = avatarEvent?.getContent()?.url;
    return mxcToHttp(mxc);
}

export function getUnreadCount(room: Room): number {
    return room.getUnreadNotificationCount() ?? 0;
}

export function getHighlightCount(room: Room): number {
    return (
        room.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0
    );
}

const NOTIFICATION_EVENT_TYPES = [
    "m.room.message",
    "m.room.encrypted",
    "m.sticker",
];

function isNotificationEvent(event: MatrixEvent): boolean {
    if (!NOTIFICATION_EVENT_TYPES.includes(event.getType())) return false;
    if (event.isRedacted()) return false;
    if (event.getRelation()?.rel_type === "m.replace") return false;
    return true;
}

/** Returns whether the room has any unread messages and whether any are highlights (mentions). */
export function getRoomUnreadInfo(room: Room): {
    unread: boolean;
    highlight: number;
} {
    const highlight = getHighlightCount(room);
    const userId = matrixClient?.getUserId();
    if (!userId) return { unread: false, highlight };

    if (getUnreadCount(room) >= 1) return { unread: true, highlight };

    const liveEvents = room.getLiveTimeline().getEvents();

    // If the last event was sent by us, we're up to date
    if (liveEvents[liveEvents.length - 1]?.getSender() === userId) {
        return { unread: false, highlight };
    }

    const readUpToId = room.getEventReadUpTo(userId);

    // getEventReadUpTo returns null if the receipt points at an event not in
    // the loaded timeline window (SDK rejects it via receiptPointsAtConsistentEvent).
    // In that case, check if a raw receipt exists at all — if yes, the marker
    // is older than our loaded window, meaning all visible events are already
    // read.
    if (!readUpToId) {
        const hasReceipt =
            !!room.getReadReceiptForUserId(userId) ||
            !!room.getReadReceiptForUserId(
                userId,
                false,
                "m.read.private" as any,
            );
        if (hasReceipt) return { unread: false, highlight };
    }

    for (let i = liveEvents.length - 1; i >= 0; i--) {
        const event = liveEvents[i];
        if (!event) return { unread: false, highlight };
        if (event.getId() === readUpToId) return { unread: false, highlight };
        if (isNotificationEvent(event)) return { unread: true, highlight };
    }
    return { unread: false, highlight };
}

export function onTimelineEvent(
    callback: (event: MatrixEvent, room: Room) => void,
): () => void {
    if (!matrixClient) return () => {};
    const handler = (event: MatrixEvent, room: Room | undefined) => {
        const isReplacement =
            event.getContent()?.["m.relates_to"]?.rel_type === "m.replace";
        if (
            room &&
            (settingsState.showAllEvents ||
                (!isReplacement &&
                    (event.getType() === "m.room.message" ||
                        event.getType() === "m.sticker") &&
                    !event.isRedacted()))
        ) {
            callback(event, room);
        }
    };
    matrixClient.on(RoomEvent.Timeline, handler as never);
    return () => matrixClient?.off(RoomEvent.Timeline, handler as never);
}

export function onLocalEchoUpdated(callback: (room: Room) => void): () => void {
    if (!matrixClient) return () => {};
    const handler = (_event: MatrixEvent, room: Room | undefined) => {
        if (room) callback(room);
    };
    matrixClient.on(RoomEvent.LocalEchoUpdated, handler as never);
    return () =>
        matrixClient?.off(RoomEvent.LocalEchoUpdated, handler as never);
}

export function onEditEvent(
    callback: (event: MatrixEvent, room: Room) => void,
): () => void {
    if (!matrixClient) return () => {};
    const handler = (event: MatrixEvent, room: Room | undefined) => {
        if (
            room &&
            event.getType() === "m.room.message" &&
            event.getContent()?.["m.relates_to"]?.rel_type === "m.replace"
        ) {
            callback(event, room);
        }
    };
    matrixClient.on(RoomEvent.Timeline, handler as never);
    return () => matrixClient?.off(RoomEvent.Timeline, handler as never);
}

// ── Default push rule helpers ──────────────────────────────────────────────

export interface DefaultPushRule {
    ruleId: string;
    kind: PushRuleKind;
    label: string;
    description: string;
    /** Conditions for override/underride rules, or pattern for content rules. Used when creating server-side. */
    conditions?: object[];
    pattern?: string | "USERNAME_LOCALPART";
}

export type PushRuleLevel = "loud" | "silent" | "off";

export const DEFAULT_PUSH_RULES: DefaultPushRule[] = [
    {
        ruleId: RuleId.DM,
        kind: PushRuleKind.Underride,
        label: "Direct messages",
        description: "Messages in direct message rooms",
        conditions: [
            { kind: "room_member_count", is: "2" },
            { kind: "event_match", key: "type", pattern: "m.room.message" },
        ],
    },
    {
        ruleId: RuleId.Message,
        kind: PushRuleKind.Underride,
        label: "Rooms",
        description: "Messages in all other rooms",
        conditions: [
            { kind: "event_match", key: "type", pattern: "m.room.message" },
        ],
    },
    {
        ruleId: RuleId.IsUserMention,
        kind: PushRuleKind.Override,
        label: "Full Matrix ID mentions",
        description: "Messages using your full @user:homeserver ID",
        conditions: [{ kind: "is_user_mention" }],
    },
    {
        ruleId: RuleId.ContainsDisplayName,
        kind: PushRuleKind.Override,
        label: "Display name mentions",
        description: "Messages containing your display name",
        conditions: [{ kind: "contains_display_name" }],
    },
    {
        ruleId: RuleId.ContainsUserName,
        kind: PushRuleKind.ContentSpecific,
        label: "Username mentions",
        description: "Messages containing your username (without server)",
        pattern: "USERNAME_LOCALPART",
    },
    {
        ruleId: RuleId.AtRoomNotification,
        kind: PushRuleKind.Override,
        label: "@room mentions",
        description: "Messages using @room to notify everyone",
        conditions: [
            { kind: "event_match", key: "content.body", pattern: "@room" },
        ],
    },
    {
        ruleId: RuleId.InviteToSelf,
        kind: PushRuleKind.Override,
        label: "Invitations",
        description: "When you are invited to a room",
        conditions: [
            { kind: "event_match", key: "type", pattern: "m.room.member" },
            {
                kind: "event_match",
                key: "content.membership",
                pattern: "invite",
            },
            { kind: "event_match", key: "state_key", pattern: "SELF_USER_ID" },
        ],
    },
];

function getGlobalPushRules(): Record<string, any[]> | undefined {
    return (matrixClient as any)?.pushRules?.global as
        | Record<string, any[]>
        | undefined;
}

function findRule(ruleId: string): any | undefined {
    const global = getGlobalPushRules();
    if (!global) return undefined;
    for (const kindRules of Object.values(global)) {
        const rule = kindRules.find((r: any) => r.rule_id === ruleId);
        if (rule) return rule;
    }
    return undefined;
}

/** Returns whether a rule's actions include a sound tweak. */
function ruleHasSound(rule: any): boolean {
    return (
        (rule.actions as any[])?.some(
            (a: any) => typeof a === "object" && a.set_tweak === "sound",
        ) ?? false
    );
}

export function getDefaultPushRuleLevel(ruleId: string): PushRuleLevel {
    const rule = findRule(ruleId);
    if (!rule || rule.enabled === false) return "off";
    const notifies =
        (rule.actions as any[])?.some(
            (a: any) => a === PushRuleActionName.Notify || a === "notify",
        ) ?? false;
    if (!notifies) return "off";
    return ruleHasSound(rule) ? "loud" : "silent";
}

/**
 * Snapshot of the catch-all push rules that govern background notifications,
 * for diagnostics. "Rooms" (.m.rule.message) notifying = a push for every
 * message in every non-DM room.
 */
export interface PushRuleSummary {
    ruleId: string;
    label: string;
    enabled: boolean;
    level: PushRuleLevel;
}

export function getPushRuleSummary(): PushRuleSummary[] {
    return DEFAULT_PUSH_RULES.map((def) => {
        const rule = findRule(def.ruleId);
        return {
            ruleId: def.ruleId,
            label: def.label,
            enabled: !!rule && rule.enabled !== false,
            level: getDefaultPushRuleLevel(def.ruleId),
        };
    });
}

export async function setDefaultPushRuleLevel(
    ruleId: string,
    kind: PushRuleKind,
    level: PushRuleLevel,
): Promise<void> {
    if (!matrixClient) return;

    // Server-default rules (dotted IDs) cannot be created — only enabled/actions updated.
    // Custom rules that don't exist yet must be created with addPushRule.
    const isServerDefault = ruleId.startsWith(".");

    const createRule = async (actions: any[]) => {
        const ruleDef = DEFAULT_PUSH_RULES.find((r) => r.ruleId === ruleId);
        const userId = matrixClient!.getUserId() ?? "";
        const localpart = userId.startsWith("@")
            ? userId.slice(1).split(":")[0]
            : userId;
        const conditions = ruleDef?.conditions?.map((c: any) =>
            c.pattern === "SELF_USER_ID" ? { ...c, pattern: userId } : c,
        );
        const pattern =
            ruleDef?.pattern === "USERNAME_LOCALPART"
                ? localpart
                : ruleDef?.pattern;
        await matrixClient!.addPushRule("global", kind, ruleId, {
            actions,
            conditions,
            pattern,
        });
    };

    if (level === "off") {
        try {
            await matrixClient.setPushRuleEnabled(
                "global",
                kind,
                ruleId,
                false,
            );
        } catch {
            if (!isServerDefault) {
                const silentActions = [
                    PushRuleActionName.Notify,
                    { set_tweak: "highlight", value: false },
                ];
                await createRule(silentActions);
                await matrixClient.setPushRuleEnabled(
                    "global",
                    kind,
                    ruleId,
                    false,
                );
            }
            // For server-default rules we fall through and update local state optimistically
        }
        const rule = findRule(ruleId);
        if (rule) rule.enabled = false;
    } else {
        const actions: any[] =
            level === "loud"
                ? [
                      PushRuleActionName.Notify,
                      { set_tweak: "sound", value: "default" },
                      { set_tweak: "highlight", value: false },
                  ]
                : [
                      PushRuleActionName.Notify,
                      { set_tweak: "highlight", value: false },
                  ];
        try {
            await matrixClient.setPushRuleActions(
                "global",
                kind,
                ruleId,
                actions,
            );
            await matrixClient.setPushRuleEnabled("global", kind, ruleId, true);
        } catch {
            if (isServerDefault) {
                // Can't create server-default rules — update local state optimistically only
            } else {
                await createRule(actions);
            }
        }
        const rule = findRule(ruleId);
        if (rule) {
            rule.enabled = true;
            rule.actions = actions;
        }
    }
}

// ── Per-room notification settings ────────────────────────────────────────

export type RoomNotificationSetting = "default" | "all" | "mentions" | "mute";

export function getRoomNotificationSetting(
    roomId: string,
): RoomNotificationSetting {
    if (!matrixClient) return "default";
    const global = getGlobalPushRules();
    // Check override rules for a mute entry matching this room
    const overrideRule = (global?.override ?? []).find(
        (r: any) => r.rule_id === roomId,
    );
    if (
        overrideRule &&
        (overrideRule.actions.length === 0 ||
            overrideRule.actions[0] === "dont_notify")
    ) {
        return "mute";
    }
    // Check room-specific rules for an "all messages" entry
    const roomSpecificRule = (global?.room ?? []).find(
        (r: any) => r.rule_id === roomId,
    );
    if (
        roomSpecificRule &&
        roomSpecificRule.actions[0] === PushRuleActionName.Notify
    ) {
        return "all";
    }
    return "default";
}

export async function setRoomNotificationSetting(
    roomId: string,
    setting: RoomNotificationSetting,
): Promise<void> {
    if (!matrixClient) return;
    // Remove any existing room-specific or override rule first
    try {
        await matrixClient.deletePushRule(
            "global",
            PushRuleKind.RoomSpecific,
            roomId,
        );
    } catch {
        /* didn't exist */
    }
    try {
        await matrixClient.deletePushRule(
            "global",
            PushRuleKind.Override,
            roomId,
        );
    } catch {
        /* didn't exist */
    }
    if (setting === "all") {
        await matrixClient.addPushRule(
            "global",
            PushRuleKind.RoomSpecific,
            roomId,
            {
                actions: [PushRuleActionName.Notify],
            },
        );
    } else if (setting === "mute") {
        await matrixClient.addPushRule(
            "global",
            PushRuleKind.Override,
            roomId,
            {
                actions: [],
                conditions: [
                    {
                        kind: ConditionKind.EventMatch,
                        key: "room_id",
                        pattern: roomId,
                    },
                ],
            },
        );
    }
    // "mentions" = no rule = server default
}

export function onAnyReceiptEvent(callback: () => void): () => void {
    if (!matrixClient) return () => {};
    matrixClient.on(RoomEvent.Receipt as never, callback as never);
    return () =>
        matrixClient?.off(RoomEvent.Receipt as never, callback as never);
}

export async function sendEdit(
    roomId: string,
    eventId: string,
    newText: string,
    formattedBody?: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const newContent: Record<string, unknown> = {
        msgtype: "m.text",
        body: newText,
    };
    if (formattedBody) {
        newContent.format = "org.matrix.custom.html";
        newContent.formatted_body = formattedBody;
    }
    await matrixClient.sendEvent(
        roomId,
        "m.room.message" as never,
        {
            msgtype: "m.text",
            body: `* ${newText}`,
            ...(formattedBody
                ? {
                      format: "org.matrix.custom.html",
                      formatted_body: `* ${formattedBody}`,
                  }
                : {}),
            "m.new_content": newContent,
            "m.relates_to": { rel_type: "m.replace", event_id: eventId },
        } as never,
    );
}

export function onRoomUpdate(callback: () => void): () => void {
    if (!matrixClient) return () => {};
    const syncHandler = (state: string) => {
        if (state === "PREPARED" || state === "SYNCING") callback();
    };
    matrixClient.on(ClientEvent.Sync, syncHandler as never);
    matrixClient.on("Room.myMembership" as never, callback as never);
    return () => {
        matrixClient?.off(ClientEvent.Sync, syncHandler as never);
        matrixClient?.off("Room.myMembership" as never, callback as never);
    };
}

export async function loadPreviousMessages(room: Room): Promise<boolean> {
    if (!matrixClient) return false;
    const before = room.getLiveTimeline().getEvents().length;
    await matrixClient.scrollback(room, 30);
    const after = room.getLiveTimeline().getEvents().length;
    return after > before;
}

/** Pages backwards until `eventId` appears in the live timeline or `maxBatches` is exhausted.
 *  Returns true if the event was found. */
export async function loadMessagesUntilEvent(
    room: Room,
    eventId: string,
    maxBatches = 40,
): Promise<boolean> {
    if (!matrixClient) return false;
    for (let i = 0; i < maxBatches; i++) {
        if (
            room
                .getLiveTimeline()
                .getEvents()
                .some((e) => e.getId() === eventId)
        )
            return true;
        const before = room.getLiveTimeline().getEvents().length;
        await matrixClient.scrollback(room, 50);
        const after = room.getLiveTimeline().getEvents().length;
        if (after === before) return false; // no more history
    }
    return room
        .getLiveTimeline()
        .getEvents()
        .some((e) => e.getId() === eventId);
}

/** Loads the timeline context around `eventId` without affecting the live timeline.
 *  Returns filtered message events around that point, or null if unavailable. */
export async function loadContextAroundEvent(
    room: Room,
    eventId: string,
    windowSize = 50,
): Promise<MatrixEvent[] | null> {
    if (!matrixClient) return null;
    const timelineSet = room.getUnfilteredTimelineSet();
    const timeline = await matrixClient.getEventTimeline(timelineSet, eventId);
    if (!timeline) return null;
    const half = Math.floor(windowSize / 2);
    await matrixClient.paginateEventTimeline(timeline, {
        backwards: true,
        limit: half,
    });
    await matrixClient.paginateEventTimeline(timeline, {
        backwards: false,
        limit: half,
    });
    const filter = (e: MatrixEvent) => {
        if (e.isRedacted()) return false;
        if (e.getType() !== "m.room.message" && e.getType() !== "m.sticker")
            return false;
        const rel = e.getContent()?.["m.relates_to"];
        if (rel?.rel_type === "m.replace") return false;
        return true;
    };
    return timeline.getEvents().filter(filter);
}

export async function sendReadReceipt(event: MatrixEvent): Promise<void> {
    if (!matrixClient) return;
    await matrixClient.sendReadReceipt(event);
    await matrixClient.setRoomReadMarkers(event.getRoomId()!, event.getId()!);
}

/** Returns the event ID the current user has read up to in this room, or null. */
export function getReadUpToEventId(room: Room): string | null {
    const userId = matrixClient?.getUserId();
    if (!userId) return null;
    return room.getEventReadUpTo(userId, true) ?? null;
}

export interface ReadReceiptInfo {
    userId: string;
    avatarUrl: string | null;
    name: string;
}

/** Returns the list of other users whose latest read receipt is on this event. */
export function getReceiptsForEvent(
    room: Room,
    event: MatrixEvent,
): ReadReceiptInfo[] {
    const myId = matrixClient?.getUserId();
    const receipts = room.getReceiptsForEvent(event);
    return receipts
        .filter((r) => r.userId !== myId && r.type === "m.read")
        .map((r) => ({
            userId: r.userId,
            avatarUrl: getMemberAvatar(room, r.userId),
            name: getMemberName(room, r.userId),
        }));
}

export async function sendTyping(
    roomId: string,
    isTyping: boolean,
): Promise<void> {
    if (!matrixClient) return;
    try {
        await matrixClient.sendTyping(roomId, isTyping, 5000);
    } catch {
        // ignore typing errors
    }
}

export function onTypingEvent(
    room: Room,
    callback: (userIds: string[]) => void,
): () => void {
    if (!matrixClient) return () => {};
    const myId = matrixClient.getUserId();
    const handler = (_event: unknown, member: RoomMember) => {
        if (member.roomId !== room.roomId) return;
        const typing = room
            .getMembers()
            .filter((m) => m.typing && m.userId !== myId)
            .map((m) => m.userId);
        callback(typing);
    };
    matrixClient.on(RoomMemberEvent.Typing as never, handler as never);
    return () =>
        matrixClient?.off(RoomMemberEvent.Typing as never, handler as never);
}

export interface SpaceChildInfo {
    roomId: string;
    name: string;
    topic?: string;
    avatarUrl?: string;
    numMembers: number;
    isJoined: boolean;
    via: string[];
    isSpace?: boolean;
}

export async function fetchSpaceHierarchy(
    spaceId: string,
): Promise<SpaceChildInfo[]> {
    if (!matrixClient) return [];
    try {
        // depth 1 = direct children only; limit 200 rooms
        const result = (await (
            matrixClient as unknown as Record<string, Function>
        )["getRoomHierarchy"](spaceId, 200, 1)) as {
            rooms: Array<Record<string, unknown>>;
        };

        const joinedIds = new Set(matrixClient.getRooms().map((r) => r.roomId));

        // Build a via-servers map from the space entry's children_state
        const viaMap = new Map<string, string[]>();
        const spaceEntry = result.rooms.find((r) => r["room_id"] === spaceId);
        if (spaceEntry) {
            const childrenState =
                (spaceEntry["children_state"] as Array<
                    Record<string, unknown>
                >) ?? [];
            for (const ev of childrenState) {
                if (ev["type"] === "m.space.child") {
                    const childRoomId = ev["state_key"] as string;
                    const via =
                        ((ev["content"] as Record<string, unknown>)?.[
                            "via"
                        ] as string[]) ?? [];
                    if (childRoomId && via.length) viaMap.set(childRoomId, via);
                }
            }
        }

        // Also fall back to the local room state for via servers
        const spaceRoom = matrixClient.getRoom(spaceId);
        if (spaceRoom) {
            const childEvents =
                spaceRoom
                    .getLiveTimeline()
                    .getState(EventTimeline.FORWARDS)
                    ?.getStateEvents("m.space.child") ?? [];
            for (const ev of childEvents) {
                const childRoomId = ev.getStateKey();
                const via = (ev.getContent()["via"] as string[]) ?? [];
                if (childRoomId && via.length && !viaMap.has(childRoomId)) {
                    viaMap.set(childRoomId, via);
                }
            }
        }

        return result.rooms
            .filter((r) => r["room_id"] !== spaceId)
            .map((r) => {
                const mxcAvatar = r["avatar_url"] as string | undefined;
                const roomId = r["room_id"] as string;
                return {
                    roomId,
                    name: (r["name"] as string) || roomId,
                    topic: r["topic"] as string | undefined,
                    avatarUrl: mxcAvatar
                        ? (mxcToHttp(mxcAvatar) ?? undefined)
                        : undefined,
                    numMembers: (r["num_joined_members"] as number) ?? 0,
                    isJoined: joinedIds.has(roomId),
                    via: viaMap.get(roomId) ?? [],
                    isSpace: r["room_type"] === "m.space",
                };
            });
    } catch (err) {
        console.error("Failed to fetch space hierarchy:", err);
        return [];
    }
}

const SPACE_ORDER_KEY = "im.client.space_order";
const SPACE_LAYOUT_KEY = "im.client.space_layout";

export interface SpaceFolder {
    name: string;
    spaceIds: string[];
    color?: string;
}

export interface SpaceLayout {
    order: string[]; // space IDs and folder IDs mixed
    folders: Record<string, SpaceFolder>;
}

export function getSpaceLayout(): SpaceLayout {
    if (!matrixClient) return { order: [], folders: {} };
    const layout = matrixClient
        .getAccountData(SPACE_LAYOUT_KEY)
        ?.getContent() as SpaceLayout | undefined;
    if (layout?.order?.length) return layout;
    // Migrate from old space_order key
    const oldOrder =
        (matrixClient.getAccountData(SPACE_ORDER_KEY)?.getContent()
            ?.order as string[]) ?? [];
    return { order: oldOrder, folders: {} };
}

export async function setSpaceLayout(layout: SpaceLayout): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.setAccountData(SPACE_LAYOUT_KEY, layout);
}

export function getSpaceOrder(): string[] {
    return getSpaceLayout().order;
}

export async function setSpaceOrder(order: string[]): Promise<void> {
    const layout = getSpaceLayout();
    await setSpaceLayout({ ...layout, order });
}

export async function leaveRoom(roomId: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    pendingLeaves.add(roomId);
    try {
        await matrixClient.leave(roomId);
    } catch (e) {
        pendingLeaves.delete(roomId);
        throw e;
    }
    // Remove from pendingLeaves once the SDK reflects the leave locally
    const check = setInterval(() => {
        const room = matrixClient?.getRoom(roomId);
        if (!room || room.getMyMembership() !== "join") {
            pendingLeaves.delete(roomId);
            clearInterval(check);
        }
    }, 500);
    setTimeout(() => {
        pendingLeaves.delete(roomId);
        clearInterval(check);
    }, 30000);
}

export interface RoomTombstone {
    body: string;
    replacementRoomId: string;
}

export function getTombstone(room: Room): RoomTombstone | null {
    const event = room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents("m.room.tombstone", "");
    if (!event) return null;
    const content = event.getContent();
    if (!content?.replacement_room) return null;
    return {
        body: content.body ?? "This room has been replaced.",
        replacementRoomId: content.replacement_room,
    };
}

export async function joinRoom(roomId: string, via?: string[]): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.joinRoom(
        roomId,
        via?.length ? { viaServers: via } : undefined,
    );
}

export async function joinRoomByAlias(alias: string): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const result = await matrixClient.joinRoom(alias);
    const room = matrixClient.getRoom(result.roomId);
    if (room) await matrixClient.scrollback(room, 30).catch(() => {});
    return result.roomId;
}

export async function createRoom(
    name: string,
    topic: string,
    spaceId?: string,
): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const result = await matrixClient.createRoom({
        name: name || undefined,
        topic: topic || undefined,
        visibility: "private" as any,
        preset: "private_chat" as any,
    });
    const roomId = result.room_id;
    if (spaceId) await addRoomToSpace(spaceId, roomId);
    const room = matrixClient.getRoom(roomId);
    if (room) await matrixClient.scrollback(room, 30).catch(() => {});
    return roomId;
}

export async function createSpace(
    name: string,
    topic: string,
): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const result = await matrixClient.createRoom({
        name: name || undefined,
        topic: topic || undefined,
        visibility: "private" as any,
        preset: "private_chat" as any,
        creation_content: { type: "m.space" },
        power_level_content_override: {
            events: { "m.space.child": 0 },
        },
    });
    return result.room_id;
}

export function canAddRoomToSpace(spaceId: string): boolean {
    const space = matrixClient?.getRoom(spaceId);
    if (!space) return false;
    const myLevel = getMyPowerLevel(space);
    const pl = getRoomPowerLevels(space);
    const required = pl.events["m.space.child"] ?? pl.state_default ?? 50;
    return myLevel >= required;
}

export async function addRoomToSpace(
    spaceId: string,
    roomId: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const userId = matrixClient.getUserId() ?? "";
    const serverName = userId.includes(":") ? userId.split(":")[1] : "";
    await (matrixClient as any).sendStateEvent(
        spaceId,
        "m.space.child",
        { via: serverName ? [serverName] : [] },
        roomId,
    );
}

export async function createDirectMessage(userId: string): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    // Reuse existing DM room if one exists
    const existing = matrixClient.getAccountData("m.direct")?.getContent() as
        | Record<string, string[]>
        | undefined;
    if (existing?.[userId]?.length) {
        const existingRoomId = existing[userId][0];
        if (matrixClient.getRoom(existingRoomId)?.getMyMembership() === "join")
            return existingRoomId;
    }
    const result = await matrixClient.createRoom({
        invite: [userId],
        is_direct: true,
        preset: "trusted_private_chat" as any,
        visibility: "private" as any,
    });
    const roomId = result.room_id;
    // Update m.direct account data so the room shows in DMs
    const dmData: Record<string, string[]> = { ...(existing ?? {}) };
    dmData[userId] = [...(dmData[userId] ?? []), roomId];
    await matrixClient.setAccountData("m.direct", dmData);
    const room = matrixClient.getRoom(roomId);
    if (room) await matrixClient.scrollback(room, 30).catch(() => {});
    return roomId;
}

export function getInvitedRooms(): Room[] {
    if (!matrixClient) return [];
    return matrixClient
        .getRooms()
        .filter((r) => r.getMyMembership() === "invite");
}

export async function acceptInvite(roomId: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.joinRoom(roomId);
    const room = matrixClient.getRoom(roomId);
    if (room) await matrixClient.scrollback(room, 30).catch(() => {});
}

export async function rejectInvite(roomId: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.leave(roomId);
}

export function getInviteSender(room: Room): string | null {
    const me = matrixClient?.getUserId();
    if (!me) return null;
    const member = room.getMember(me);
    return member?.events.member?.getSender() ?? null;
}

export interface ReactionGroup {
    key: string;
    count: number;
    isMine: boolean; // true even while local echo is pending
    myEventId: string | null; // only set once server-confirmed (used for removal)
}

export function getReactions(room: Room, eventId: string): ReactionGroup[] {
    if (!matrixClient) return [];
    try {
        const relations = room.relations.getChildEventsForEvent(
            eventId,
            "m.annotation",
            "m.reaction",
        );
        if (!relations) return [];

        const ownUserId = matrixClient.getUserId();
        const groups: Map<
            string,
            { count: number; isMine: boolean; myEventId: string | null }
        > = new Map();

        for (const e of relations.getRelations()) {
            if (e.isRedacted()) continue;
            const key: string = e.getContent()?.["m.relates_to"]?.key ?? "";
            if (!key) continue;
            const existing = groups.get(key) ?? {
                count: 0,
                isMine: false,
                myEventId: null,
            };
            const isOwn = e.getSender() === ownUserId;
            groups.set(key, {
                count: existing.count + 1,
                isMine: existing.isMine || isOwn,
                myEventId:
                    isOwn && !e.status
                        ? (e.getId() ?? null)
                        : existing.myEventId,
            });
        }

        return Array.from(groups.entries()).map(
            ([key, { count, isMine, myEventId }]) => ({
                key,
                count,
                isMine,
                myEventId,
            }),
        );
    } catch {
        return [];
    }
}

export async function sendReaction(
    roomId: string,
    eventId: string,
    key: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    // Deduplicate: don't send if user already has this reaction (including local echoes)
    const room = matrixClient.getRoom(roomId);
    if (room) {
        const existing = getReactions(room, eventId);
        if (existing.some((g) => g.key === key && g.isMine)) return;
    }
    await matrixClient.sendEvent(
        roomId,
        "m.reaction" as never,
        {
            "m.relates_to": {
                rel_type: "m.annotation",
                event_id: eventId,
                key,
            },
        } as never,
    );
}

export async function removeReaction(
    roomId: string,
    reactionEventId: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.redactEvent(roomId, reactionEventId);
}

export async function deleteMessage(
    roomId: string,
    eventId: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.redactEvent(roomId, eventId);
}

export interface CustomEmoji {
    shortcode: string;
    mxcUrl: string; // mxc:// url (used in formatted_body so other clients can proxy it)
    url: string; // http url (used for display in our own picker)
}

export interface CustomEmojiPack {
    id: string; // 'user' or a room ID
    name: string;
    avatarUrl?: string; // http avatar URL for space packs
    roomId?: string;
    stateKey?: string;
    sourceName?: string;
    inherited?: boolean;
    emojis: CustomEmoji[];
}

interface RoomEmoteImageContent {
    url?: string;
    usage?: string[];
    [key: string]: unknown;
}

interface RoomEmoteContent {
    images?: Record<string, RoomEmoteImageContent>;
    pack?: {
        display_name?: string;
        usage?: string[];
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

// Sticker types mirror emoji types
export type CustomSticker = CustomEmoji;

export type ImageUsage = "emoticon" | "sticker";

export interface CustomPackImage extends CustomEmoji {
    usage: ImageUsage[];
    canEmoji: boolean;
    canSticker: boolean;
}

export interface CustomImagePack {
    id: string;
    name: string;
    avatarUrl?: string;
    roomId?: string;
    stateKey?: string;
    sourceName?: string;
    inherited?: boolean;
    images: CustomPackImage[];
}

export interface CustomStickerPack {
    id: string;
    name: string;
    avatarUrl?: string;
    roomId?: string;
    stateKey?: string;
    sourceName?: string;
    inherited?: boolean;
    stickers: CustomSticker[];
}

// Effective usage: image-level overrides pack-level; absent at both levels means both kinds.
function matchesUsage(
    imageUsage: string[] | undefined,
    packUsage: string[] | undefined,
    kind: ImageUsage,
): boolean {
    const effective =
        imageUsage && imageUsage.length > 0 ? imageUsage : packUsage;
    if (!effective || effective.length === 0) return true;
    return effective.includes(kind);
}

function effectiveUsage(
    imageUsage: string[] | undefined,
    packUsage: string[] | undefined,
): ImageUsage[] {
    const raw =
        imageUsage && imageUsage.length > 0 ? imageUsage : (packUsage ?? []);
    const usage = raw.filter(
        (u): u is ImageUsage => u === "emoticon" || u === "sticker",
    );
    return usage.length > 0 ? usage : ["emoticon", "sticker"];
}

function roomEmoteContentToPackImages(
    content: RoomEmoteContent,
): CustomPackImage[] {
    const images = content.images ?? {};
    const packUsage = content.pack?.usage;
    return Object.entries(images)
        .filter(([, data]) => data?.url?.startsWith("mxc://"))
        .flatMap(([shortcode, data]) => {
            const http = mxcToHttp(data.url!);
            if (!http) return [];
            const usage = effectiveUsage(data.usage, packUsage);
            return [
                {
                    shortcode,
                    mxcUrl: data.url!,
                    url: http,
                    usage,
                    canEmoji: usage.includes("emoticon"),
                    canSticker: usage.includes("sticker"),
                },
            ];
        });
}

function roomEmoteContentToImages(
    content: RoomEmoteContent,
    kind: ImageUsage,
): CustomEmoji[] {
    const images = content.images ?? {};
    const packUsage = content.pack?.usage;
    return Object.entries(images)
        .filter(
            ([, data]) =>
                data?.url?.startsWith("mxc://") &&
                matchesUsage(data.usage, packUsage, kind),
        )
        .flatMap(([shortcode, data]) => {
            const http = mxcToHttp(data.url!);
            return http ? [{ shortcode, mxcUrl: data.url!, url: http }] : [];
        });
}

function getRoomEmotePacksBase(room: Room): CustomImagePack[] {
    const events =
        room
            .getLiveTimeline()
            .getState(EventTimeline.FORWARDS)
            ?.getStateEvents("im.ponies.room_emotes") ?? [];
    const arr = Array.isArray(events) ? events : [events];
    return arr
        .map((event) => {
            const content = event.getContent() as RoomEmoteContent;
            const stateKey = event.getStateKey() ?? "";
            const images = roomEmoteContentToPackImages(content);
            return {
                id: `${room.roomId}:${stateKey}`,
                roomId: room.roomId,
                stateKey,
                name:
                    content.pack?.display_name ||
                    stateKey ||
                    `${room.name || "Room"} Emotes`,
                sourceName: room.name || room.roomId,
                avatarUrl: getRoomAvatar(room) ?? undefined,
                images,
            };
        })
        .filter((pack) => pack.images.length > 0);
}

function getRoomImagePacks(room: Room, kind: ImageUsage): CustomEmojiPack[] {
    const events =
        room
            .getLiveTimeline()
            .getState(EventTimeline.FORWARDS)
            ?.getStateEvents("im.ponies.room_emotes") ?? [];
    const arr = Array.isArray(events) ? events : [events];
    return arr
        .map((event) => {
            const content = event.getContent() as RoomEmoteContent;
            const stateKey = event.getStateKey() ?? "";
            const emojis = roomEmoteContentToImages(content, kind);
            return {
                id: `${room.roomId}:${stateKey}`,
                roomId: room.roomId,
                stateKey,
                name:
                    content.pack?.display_name ||
                    stateKey ||
                    `${room.name || "Room"} ${kind === "sticker" ? "Stickers" : "Emojis"}`,
                sourceName: room.name || room.roomId,
                avatarUrl: getRoomAvatar(room) ?? undefined,
                emojis,
            };
        })
        .filter((pack) => pack.emojis.length > 0);
}

export function getRoomEmotePacks(room: Room): CustomImagePack[] {
    try {
        return getRoomEmotePacksBase(room);
    } catch {
        return [];
    }
}

export function getRoomEmojiPacks(room: Room): CustomEmojiPack[] {
    try {
        return getRoomImagePacks(room, "emoticon");
    } catch {
        return [];
    }
}

export function getRoomEmojiPack(room: Room): CustomEmoji[] {
    return getRoomEmojiPacks(room).flatMap((pack) => pack.emojis);
}

export function getRoomStickerPacks(room: Room): CustomStickerPack[] {
    try {
        return getRoomImagePacks(room, "sticker").map((pack) => ({
            id: pack.id,
            name: pack.name,
            avatarUrl: pack.avatarUrl,
            roomId: pack.roomId,
            stateKey: pack.stateKey,
            sourceName: pack.sourceName,
            inherited: pack.inherited,
            stickers: pack.emojis,
        }));
    } catch {
        return [];
    }
}

export function getParentSpaceIds(roomId: string): string[] {
    if (!matrixClient) return [];
    const result: string[] = [];
    const visited = new Set<string>();

    function add(parentId: string) {
        if (visited.has(parentId)) return;
        visited.add(parentId);
        result.push(parentId);
        visit(parentId);
    }

    function visit(childId: string) {
        const child = matrixClient?.getRoom(childId);
        const parentEvents =
            child
                ?.getLiveTimeline()
                .getState(EventTimeline.FORWARDS)
                ?.getStateEvents("m.space.parent") ?? [];
        const parentArr = Array.isArray(parentEvents)
            ? parentEvents
            : [parentEvents];
        for (const event of parentArr) {
            const parentId = event.getStateKey();
            if (parentId) add(parentId);
        }

        for (const space of getSpaces()) {
            if (!getSpaceChildIds(space.roomId).includes(childId)) continue;
            add(space.roomId);
        }
    }

    visit(roomId);
    return result;
}

export function getAvailableRoomEmojiPacks(room: Room): CustomEmojiPack[] {
    if (!matrixClient) return [];
    const current = getRoomEmojiPacks(room);
    const inherited = getParentSpaceIds(room.roomId).flatMap((spaceId) => {
        const parent = matrixClient!.getRoom(spaceId);
        if (!parent) return [];
        return getRoomEmojiPacks(parent).map((pack) => ({
            ...pack,
            inherited: true,
        }));
    });
    return [...current, ...inherited];
}

export function getAvailableRoomStickerPacks(room: Room): CustomStickerPack[] {
    if (!matrixClient) return [];
    const current = getRoomStickerPacks(room);
    const inherited = getParentSpaceIds(room.roomId).flatMap((spaceId) => {
        const parent = matrixClient!.getRoom(spaceId);
        if (!parent) return [];
        return getRoomStickerPacks(parent).map((pack) => ({
            ...pack,
            inherited: true,
        }));
    });
    return [...current, ...inherited];
}

export function getAvailableRoomEmotePacks(room: Room): CustomImagePack[] {
    if (!matrixClient) return [];
    const current = getRoomEmotePacks(room);
    const inherited = getParentSpaceIds(room.roomId).flatMap((spaceId) => {
        const parent = matrixClient!.getRoom(spaceId);
        if (!parent) return [];
        return getRoomEmotePacks(parent).map((pack) => ({
            ...pack,
            inherited: true,
        }));
    });
    return [...current, ...inherited];
}

function normalizeEmojiShortcode(shortcode: string): string {
    return shortcode.trim().replace(/^:+|:+$/g, "");
}

function isValidEmojiShortcode(shortcode: string): boolean {
    return /^[A-Za-z0-9_.+-]+$/.test(shortcode);
}

export function validateEmojiShortcode(shortcode: string): string | null {
    const normalized = normalizeEmojiShortcode(shortcode);
    if (!normalized) return "Enter a shortcode.";
    if (!isValidEmojiShortcode(normalized)) {
        return "Use only letters, numbers, dots, underscores, pluses, and hyphens.";
    }
    return null;
}

async function fetchRoomEmoteContent(
    roomId: string,
    stateKey: string,
): Promise<RoomEmoteContent> {
    try {
        return ((await matrixClient?.getStateEvent(
            roomId,
            "im.ponies.room_emotes",
            stateKey,
        )) ?? {}) as RoomEmoteContent;
    } catch {
        return {};
    }
}

function withUsage(usage: string[] | undefined, kind: ImageUsage): string[] {
    return [...new Set([...(usage ?? []), kind])];
}

function normalizeUsage(usage: ImageUsage[]): ImageUsage[] {
    return [...new Set(usage)].filter(
        (u): u is ImageUsage => u === "emoticon" || u === "sticker",
    );
}

async function setRoomPackImageUsage(
    roomId: string,
    stateKey: string,
    shortcode: string,
    usage: ImageUsage[],
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const normalized = normalizeEmojiShortcode(shortcode);
    const nextUsage = normalizeUsage(usage);
    if (nextUsage.length === 0) throw new Error("Choose at least one usage.");
    const current = await fetchRoomEmoteContent(roomId, stateKey);
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized];
    if (!existing?.url) throw new Error("Image not found.");
    images[normalized] = {
        ...existing,
        usage: nextUsage,
    };
    await (matrixClient as any).sendStateEvent(
        roomId,
        "im.ponies.room_emotes",
        { ...current, images },
        stateKey,
    );
}

export async function setRoomEmoteUsage(
    roomId: string,
    stateKey: string,
    shortcode: string,
    usage: ImageUsage[],
): Promise<void> {
    await setRoomPackImageUsage(roomId, stateKey, shortcode, usage);
}

async function addRoomPackImage(
    roomId: string,
    stateKey: string,
    shortcode: string,
    mxcUrl: string,
    packName: string,
    kind: ImageUsage,
): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const normalized = normalizeEmojiShortcode(shortcode);
    const error = validateEmojiShortcode(normalized);
    if (error) throw new Error(error);

    const current = await fetchRoomEmoteContent(roomId, stateKey);
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized] ?? {};
    images[normalized] = {
        ...existing,
        url: mxcUrl,
        usage: withUsage(existing.usage, kind),
    };

    await (matrixClient as any).sendStateEvent(
        roomId,
        "im.ponies.room_emotes",
        {
            ...current,
            pack: {
                ...(current.pack ?? {}),
                display_name: current.pack?.display_name ?? packName,
            },
            images,
        },
        stateKey,
    );
    return normalized;
}

export async function addRoomEmote(
    roomId: string,
    stateKey: string,
    shortcode: string,
    mxcUrl: string,
    packName: string,
    usage: ImageUsage[],
): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const normalized = normalizeEmojiShortcode(shortcode);
    const error = validateEmojiShortcode(normalized);
    const nextUsage = normalizeUsage(usage);
    if (error) throw new Error(error);
    if (nextUsage.length === 0) throw new Error("Choose at least one usage.");

    const current = await fetchRoomEmoteContent(roomId, stateKey);
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized] ?? {};
    images[normalized] = {
        ...existing,
        url: mxcUrl,
        usage: nextUsage,
    };
    await (matrixClient as any).sendStateEvent(
        roomId,
        "im.ponies.room_emotes",
        {
            ...current,
            pack: {
                ...(current.pack ?? {}),
                display_name: current.pack?.display_name ?? packName,
            },
            images,
        },
        stateKey,
    );
    return normalized;
}

export async function addRoomEmoji(
    roomId: string,
    stateKey: string,
    shortcode: string,
    mxcUrl: string,
    packName: string,
): Promise<string> {
    return addRoomPackImage(
        roomId,
        stateKey,
        shortcode,
        mxcUrl,
        packName,
        "emoticon",
    );
}

export async function addRoomSticker(
    roomId: string,
    stateKey: string,
    shortcode: string,
    mxcUrl: string,
    packName: string,
): Promise<string> {
    return addRoomPackImage(
        roomId,
        stateKey,
        shortcode,
        mxcUrl,
        packName,
        "sticker",
    );
}

async function removeRoomPackImage(
    roomId: string,
    stateKey: string,
    shortcode: string,
    kind: ImageUsage,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const normalized = normalizeEmojiShortcode(shortcode);
    const current = await fetchRoomEmoteContent(roomId, stateKey);
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized];

    if (existing) {
        const usage = existing.usage?.length ? existing.usage : undefined;
        const packUsage = current.pack?.usage?.length
            ? current.pack.usage
            : undefined;
        const otherKind = kind === "emoticon" ? "sticker" : "emoticon";
        if (usage?.includes(otherKind)) {
            images[normalized] = {
                ...existing,
                usage: usage.filter((u) => u !== kind),
            };
        } else if (!usage && (!packUsage || packUsage.includes(otherKind))) {
            images[normalized] = {
                ...existing,
                usage: [otherKind],
            };
        } else {
            delete images[normalized];
        }
    }

    await (matrixClient as any).sendStateEvent(
        roomId,
        "im.ponies.room_emotes",
        { ...current, images },
        stateKey,
    );
}

export async function removeRoomEmoji(
    roomId: string,
    stateKey: string,
    shortcode: string,
): Promise<void> {
    await removeRoomPackImage(roomId, stateKey, shortcode, "emoticon");
}

export async function removeRoomSticker(
    roomId: string,
    stateKey: string,
    shortcode: string,
): Promise<void> {
    await removeRoomPackImage(roomId, stateKey, shortcode, "sticker");
}

export async function removeRoomEmoteImage(
    roomId: string,
    stateKey: string,
    shortcode: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const normalized = normalizeEmojiShortcode(shortcode);
    const current = await fetchRoomEmoteContent(roomId, stateKey);
    const images = { ...(current.images ?? {}) };
    delete images[normalized];
    await (matrixClient as any).sendStateEvent(
        roomId,
        "im.ponies.room_emotes",
        { ...current, images },
        stateKey,
    );
}

function getUserPackImages(kind: ImageUsage): CustomEmoji[] {
    if (!matrixClient) return [];
    try {
        const accountData = matrixClient.getAccountData(
            "im.ponies.user_emotes",
        );
        if (!accountData) return [];
        const content = accountData.getContent();
        const images = content?.images as
            | Record<string, { url?: string; usage?: string[] }>
            | undefined;
        if (!images) return [];
        const packUsage = (content?.pack as { usage?: string[] } | undefined)
            ?.usage;
        return Object.entries(images)
            .filter(
                ([, data]) =>
                    data?.url?.startsWith("mxc://") &&
                    matchesUsage(data.usage, packUsage, kind),
            )
            .flatMap(([shortcode, data]) => {
                const http = mxcToHttp(data.url!);
                return http
                    ? [{ shortcode, mxcUrl: data.url!, url: http }]
                    : [];
            });
    } catch {
        return [];
    }
}

function getUserEmoteContent(): RoomEmoteContent {
    if (!matrixClient) return {};
    return (
        (matrixClient.getAccountData("im.ponies.user_emotes")?.getContent() as
            | RoomEmoteContent
            | undefined) ?? {}
    );
}

export function getUserEmotePack(): CustomPackImage[] {
    return roomEmoteContentToPackImages(getUserEmoteContent());
}

async function fetchUserEmoteContent(): Promise<RoomEmoteContent> {
    return getUserEmoteContent();
}

async function addUserPackImage(
    shortcode: string,
    mxcUrl: string,
    packName: string,
    kind: ImageUsage,
): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const normalized = normalizeEmojiShortcode(shortcode);
    const error = validateEmojiShortcode(normalized);
    if (error) throw new Error(error);

    const current = await fetchUserEmoteContent();
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized] ?? {};
    images[normalized] = {
        ...existing,
        url: mxcUrl,
        usage: withUsage(existing.usage, kind),
    };

    await matrixClient.setAccountData("im.ponies.user_emotes", {
        ...current,
        pack: {
            ...(current.pack ?? {}),
            display_name: current.pack?.display_name ?? packName,
        },
        images,
    });
    return normalized;
}

export async function addUserEmote(
    shortcode: string,
    mxcUrl: string,
    usage: ImageUsage[],
): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const normalized = normalizeEmojiShortcode(shortcode);
    const error = validateEmojiShortcode(normalized);
    const nextUsage = normalizeUsage(usage);
    if (error) throw new Error(error);
    if (nextUsage.length === 0) throw new Error("Choose at least one usage.");

    const current = await fetchUserEmoteContent();
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized] ?? {};
    images[normalized] = {
        ...existing,
        url: mxcUrl,
        usage: nextUsage,
    };
    await matrixClient.setAccountData("im.ponies.user_emotes", {
        ...current,
        pack: {
            ...(current.pack ?? {}),
            display_name: current.pack?.display_name ?? "My Emotes",
        },
        images,
    });
    return normalized;
}

export async function setUserEmoteUsage(
    shortcode: string,
    usage: ImageUsage[],
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const normalized = normalizeEmojiShortcode(shortcode);
    const nextUsage = normalizeUsage(usage);
    if (nextUsage.length === 0) throw new Error("Choose at least one usage.");
    const current = await fetchUserEmoteContent();
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized];
    if (!existing?.url) throw new Error("Image not found.");
    images[normalized] = {
        ...existing,
        usage: nextUsage,
    };
    await matrixClient.setAccountData("im.ponies.user_emotes", {
        ...current,
        images,
    });
}

async function removeUserPackImage(
    shortcode: string,
    kind: ImageUsage,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const normalized = normalizeEmojiShortcode(shortcode);
    const current = await fetchUserEmoteContent();
    const images = { ...(current.images ?? {}) };
    const existing = images[normalized];

    if (existing) {
        const usage = existing.usage?.length ? existing.usage : undefined;
        const packUsage = current.pack?.usage?.length
            ? current.pack.usage
            : undefined;
        const otherKind = kind === "emoticon" ? "sticker" : "emoticon";
        if (usage?.includes(otherKind)) {
            images[normalized] = {
                ...existing,
                usage: usage.filter((u) => u !== kind),
            };
        } else if (!usage && (!packUsage || packUsage.includes(otherKind))) {
            images[normalized] = {
                ...existing,
                usage: [otherKind],
            };
        } else {
            delete images[normalized];
        }
    }

    await matrixClient.setAccountData("im.ponies.user_emotes", {
        ...current,
        images,
    });
}

export function getUserEmojiPack(): CustomEmoji[] {
    return getUserPackImages("emoticon");
}

export function getUserStickerPack(): CustomSticker[] {
    return getUserPackImages("sticker");
}

export async function addUserEmoji(
    shortcode: string,
    mxcUrl: string,
): Promise<string> {
    return addUserPackImage(shortcode, mxcUrl, "My Emojis", "emoticon");
}

export async function removeUserEmoji(shortcode: string): Promise<void> {
    await removeUserPackImage(shortcode, "emoticon");
}

export async function addUserSticker(
    shortcode: string,
    mxcUrl: string,
): Promise<string> {
    return addUserPackImage(shortcode, mxcUrl, "My Stickers", "sticker");
}

export async function removeUserSticker(shortcode: string): Promise<void> {
    await removeUserPackImage(shortcode, "sticker");
}

export async function removeUserEmoteImage(shortcode: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const normalized = normalizeEmojiShortcode(shortcode);
    const current = await fetchUserEmoteContent();
    const images = { ...(current.images ?? {}) };
    delete images[normalized];
    await matrixClient.setAccountData("im.ponies.user_emotes", {
        ...current,
        images,
    });
}

function uniquePacks<T extends { id: string }>(packs: T[]): T[] {
    const seen = new Set<string>();
    return packs.filter((pack) => {
        if (seen.has(pack.id)) return false;
        seen.add(pack.id);
        return true;
    });
}

// Returns custom emoji packs (emoticons only): user pack first, then active space.
export function getCustomEmojiPacks(
    activeSpaceId: string | null,
    _spaces: Room[],
    room?: Room | null,
): CustomEmojiPack[] {
    if (!matrixClient) return [];
    const packs: CustomEmojiPack[] = [];

    const userEmojis = getUserPackImages("emoticon");
    if (userEmojis.length > 0)
        packs.push({ id: "user", name: "My Emojis", emojis: userEmojis });

    if (room) {
        packs.push(...getAvailableRoomEmojiPacks(room));
    }

    if (activeSpaceId) {
        const spaceRoom = matrixClient.getRoom(activeSpaceId);
        if (spaceRoom) {
            packs.push(...getAvailableRoomEmojiPacks(spaceRoom));
        }
    }

    return uniquePacks(packs);
}

// Returns custom sticker packs: user pack first, then active space.
export function getCustomStickerPacks(
    activeSpaceId: string | null,
    room?: Room | null,
): CustomStickerPack[] {
    if (!matrixClient) return [];
    const packs: CustomStickerPack[] = [];

    const userStickers = getUserPackImages("sticker");
    if (userStickers.length > 0)
        packs.push({ id: "user", name: "My Stickers", stickers: userStickers });

    if (room) {
        packs.push(...getAvailableRoomStickerPacks(room));
    }

    if (activeSpaceId) {
        const spaceRoom = matrixClient.getRoom(activeSpaceId);
        if (spaceRoom) {
            packs.push(...getAvailableRoomStickerPacks(spaceRoom));
        }
    }

    return uniquePacks(packs);
}

// Flat list of all custom emojis (emoticons only) — used at send time to resolve shortcodes.
export function getCustomEmojis(
    room?: Room,
    activeSpaceId?: string | null,
): CustomEmoji[] {
    if (!matrixClient) return [];
    const seen = new Set<string>();
    const result: CustomEmoji[] = [];
    const add = (emojis: CustomEmoji[]) => {
        for (const e of emojis) {
            if (!seen.has(e.shortcode)) {
                seen.add(e.shortcode);
                result.push(e);
            }
        }
    };

    add(getUserPackImages("emoticon"));
    if (room) {
        add(getAvailableRoomEmojiPacks(room).flatMap((pack) => pack.emojis));
    }
    if (activeSpaceId) {
        const spaceRoom = matrixClient.getRoom(activeSpaceId);
        if (spaceRoom) {
            add(
                getAvailableRoomEmojiPacks(spaceRoom).flatMap(
                    (pack) => pack.emojis,
                ),
            );
        }
    }

    return result;
}

// ── Admin / moderation helpers ────────────────────────────────────────────────

export function getMyPowerLevel(room: Room): number {
    const me = matrixClient?.getUserId();
    if (!me) return 0;
    return room.getMember(me)?.powerLevel ?? 0;
}

export interface PowerLevels {
    ban: number;
    kick: number;
    redact: number;
    invite: number;
    events_default: number;
    state_default: number;
    users_default: number;
    events: Record<string, number>;
    users: Record<string, number>;
}

export function getRoomPowerLevels(room: Room): PowerLevels {
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const content =
        state?.getStateEvents("m.room.power_levels", "")?.getContent() ?? {};
    return {
        ban: (content.ban as number) ?? 50,
        kick: (content.kick as number) ?? 50,
        redact: (content.redact as number) ?? 50,
        invite: (content.invite as number) ?? 50,
        events_default: (content.events_default as number) ?? 0,
        state_default: (content.state_default as number) ?? 50,
        users_default: (content.users_default as number) ?? 0,
        events: (content.events as Record<string, number>) ?? {},
        users: (content.users as Record<string, number>) ?? {},
    };
}

export function getPinnedEventIds(room: Room): string[] {
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const content = state
        ?.getStateEvents("m.room.pinned_events", "")
        ?.getContent();
    return (content?.pinned as string[]) ?? [];
}

async function fetchPinnedEventIds(roomId: string): Promise<string[]> {
    try {
        const state = await matrixClient?.getStateEvent(
            roomId,
            "m.room.pinned_events",
            "",
        );
        return (state?.pinned as string[]) ?? [];
    } catch {
        return [];
    }
}

export async function pinMessage(room: Room, eventId: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const current = await fetchPinnedEventIds(room.roomId);
    const pinned = [...new Set([...current, eventId])];
    await (matrixClient as any).sendStateEvent(
        room.roomId,
        "m.room.pinned_events",
        { pinned },
        "",
    );
}

export async function unpinMessage(room: Room, eventId: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const current = await fetchPinnedEventIds(room.roomId);
    const pinned = current.filter((id) => id !== eventId);
    await (matrixClient as any).sendStateEvent(
        room.roomId,
        "m.room.pinned_events",
        { pinned },
        "",
    );
}

export async function setRoomPowerLevels(
    room: Room,
    updated: Partial<PowerLevels>,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const current =
        state?.getStateEvents("m.room.power_levels", "")?.getContent() ?? {};
    await (matrixClient as any).sendStateEvent(
        room.roomId,
        "m.room.power_levels",
        { ...current, ...updated },
    );
}

export async function setUserPowerLevel(
    room: Room,
    userId: string,
    level: number,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const pl = getRoomPowerLevels(room);
    await setRoomPowerLevels(room, { users: { ...pl.users, [userId]: level } });
}

export async function kickUser(
    roomId: string,
    userId: string,
    reason?: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.kick(roomId, userId, reason);
}

export async function banUser(
    roomId: string,
    userId: string,
    reason?: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.ban(roomId, userId, reason);
}

export async function unbanUser(roomId: string, userId: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.unban(roomId, userId);
}

export function getBannedMembers(room: Room): RoomMember[] {
    return room.getMembers().filter((m) => m.membership === "ban");
}

export async function setRoomName(roomId: string, name: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.setRoomName(roomId, name);
}

export async function setRoomTopic(
    roomId: string,
    topic: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await matrixClient.setRoomTopic(roomId, topic);
}

export async function uploadContent(file: File): Promise<string> {
    if (!matrixClient) throw new Error("Not logged in");
    const { content_uri } = await matrixClient.uploadContent(file, {
        name: file.name,
    });
    return content_uri;
}

export async function setRoomAvatar(
    roomId: string,
    mxcUrl: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await (matrixClient as any).sendStateEvent(roomId, "m.room.avatar", {
        url: mxcUrl,
    });
}

export function getJoinRule(room: Room): string {
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    return (
        state?.getStateEvents("m.room.join_rules", "")?.getContent()
            ?.join_rule ?? "invite"
    );
}

export async function setJoinRule(roomId: string, rule: string): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await (matrixClient as any).sendStateEvent(roomId, "m.room.join_rules", {
        join_rule: rule,
    });
}

export function getHistoryVisibility(room: Room): string {
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    return (
        state?.getStateEvents("m.room.history_visibility", "")?.getContent()
            ?.history_visibility ?? "shared"
    );
}

export async function setHistoryVisibility(
    roomId: string,
    visibility: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await (matrixClient as any).sendStateEvent(
        roomId,
        "m.room.history_visibility",
        { history_visibility: visibility },
    );
}

export interface SpaceChildEntry {
    roomId: string;
    name: string;
    order: string;
    via: string[];
    avatarUrl: string | null;
    isJoined: boolean;
}

export function getSpaceChildren(room: Room): SpaceChildEntry[] {
    if (!matrixClient) return [];
    const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const childEvents = state?.getStateEvents("m.space.child") ?? [];
    const joined = new Set(matrixClient.getRooms().map((r) => r.roomId));
    return (childEvents as MatrixEvent[])
        .filter((ev) => (ev.getContent()?.via as string[])?.length)
        .map((ev) => {
            const childId = ev.getStateKey()!;
            const child = matrixClient!.getRoom(childId);
            return {
                roomId: childId,
                name: child ? getRoomDisplayName(child) : childId,
                order: (ev.getContent()?.order as string) ?? "",
                via: (ev.getContent()?.via as string[]) ?? [],
                avatarUrl: child ? getRoomAvatar(child) : null,
                isJoined: joined.has(childId),
            };
        })
        .sort((a, b) => {
            if (a.order && b.order) return a.order.localeCompare(b.order);
            if (a.order) return -1;
            if (b.order) return 1;
            return a.name.localeCompare(b.name);
        });
}

export async function setSpaceChildOrder(
    spaceId: string,
    childRoomId: string,
    order: string,
    via: string[],
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    const existing =
        matrixClient
            .getRoom(spaceId)
            ?.getLiveTimeline()
            .getState(EventTimeline.FORWARDS)
            ?.getStateEvents("m.space.child", childRoomId)
            ?.getContent() ?? {};
    await (matrixClient as any).sendStateEvent(
        spaceId,
        "m.space.child",
        {
            ...existing,
            via,
            order: order || undefined,
        },
        childRoomId,
    );
}

export async function removeSpaceChild(
    spaceId: string,
    childRoomId: string,
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");
    await (matrixClient as any).sendStateEvent(
        spaceId,
        "m.space.child",
        {},
        childRoomId,
    );
}

// ── End admin helpers ─────────────────────────────────────────────────────────

export async function sendSticker(
    roomId: string,
    sticker: CustomSticker,
): Promise<void> {
    if (!matrixClient) throw new Error("Not connected");
    await matrixClient.sendEvent(roomId, "m.sticker" as any, {
        body: sticker.shortcode,
        url: sticker.mxcUrl,
        info: {},
    });
}

export function onReactionEvent(
    callback: (event: MatrixEvent, room: Room) => void,
): () => void {
    if (!matrixClient) return () => {};
    const handler = (event: MatrixEvent, room: Room | undefined) => {
        if (room && event.getType() === "m.reaction") {
            callback(event, room);
        }
    };
    matrixClient.on(RoomEvent.Timeline, handler as never);
    return () => matrixClient?.off(RoomEvent.Timeline, handler as never);
}

export function onRedactionEvent(
    room: Room,
    callback: (event: MatrixEvent, room: Room) => void,
): () => void {
    const handler = (event: MatrixEvent, r: Room) => callback(event, r);
    room.on(RoomEvent.Redaction as never, handler as never);
    return () => room.off(RoomEvent.Redaction as never, handler as never);
}

export function onReceiptEvent(room: Room, callback: () => void): () => void {
    room.on(RoomEvent.Receipt as never, callback as never);
    return () => room.off(RoomEvent.Receipt as never, callback as never);
}

/**
 * Fires when the room's live timeline is reset. This happens on a "limited"
 * (gappy) sync — e.g. after reconnecting or resuming the PWA from a
 * notification — where the server reports a gap between our last known event
 * and the new ones. The SDK discards the old in-memory timeline and starts a
 * fresh one, so the displayed message list must be reloaded from scratch to
 * avoid stitching stale events onto the post-gap events.
 */
export function onTimelineReset(room: Room, callback: () => void): () => void {
    room.on(RoomEvent.TimelineReset as never, callback as never);
    return () => room.off(RoomEvent.TimelineReset as never, callback as never);
}

export function findEventById(room: Room, eventId: string): MatrixEvent | null {
    const timelineSet = room.getUnfilteredTimelineSet();
    return timelineSet.findEventById(eventId) ?? null;
}

export async function fetchEventById(
    roomId: string,
    eventId: string,
): Promise<MatrixEvent | null> {
    if (!matrixClient) return null;
    try {
        const raw = await matrixClient.fetchRoomEvent(roomId, eventId);
        return new MatrixEvent(raw);
    } catch {
        return null;
    }
}

export async function sendReply(
    roomId: string,
    text: string,
    replyToEvent: MatrixEvent,
    formattedText?: string,
    mentions?: { user_ids?: string[]; room?: boolean },
): Promise<void> {
    if (!matrixClient) throw new Error("Not logged in");

    const replyContent = replyToEvent.getContent();
    const content = buildReplyContent({
        roomId: replyToEvent.getRoomId() ?? roomId,
        replyEventId: replyToEvent.getId()!,
        replySender: replyToEvent.getSender() ?? "",
        replyBody: replyContent?.body ?? "",
        replyFormattedBody: replyContent?.formatted_body,
        text,
        formattedText,
        mentions,
    });

    await matrixClient.sendMessage(roomId, content as never);
}

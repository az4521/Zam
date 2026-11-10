/**
 * Plugin host bridge: the ONLY plugin-facing Matrix surface. `hostApi.ts`
 * wraps these, and the plugin boot glue reads/writes plugin sync through
 * them. Returns plain summaries, never live SDK objects.
 *
 * Split out of `client.ts` (audit ARCH-01). It reads the client slot from
 * `runtime.ts` and reuses the room/media helpers `client.ts` exports.
 */
import { t } from "$lib/i18n";
import { EventTimeline } from "matrix-js-sdk";
import type {
    PluginRoomSummary,
    PluginMemberSummary,
    PluginTimelineMessage,
    PluginEventSummary,
    PluginPresenceState,
} from "../plugins/types";
import {
    selectRecentMessages,
    type PluginTimelineRecord,
} from "../plugins/pluginTimeline";
import { exceedsUploadLimit, FileTooLargeError } from "$lib/utils/uploadLimits";
import { isMidiAttachment, midiSendMimetype } from "$lib/utils/midi";
import { withThreadRelation } from "$lib/utils/threadContent";
import {
    createMediaOwnership,
    mxcUrlsInContent,
} from "$lib/utils/mediaOwnership";
import { captureClient, matrixClient, ownedClientOrThrow } from "./runtime";
import {
    fetchAttachmentBlob,
    fetchDecryptedAttachmentBlob,
    getMediaUploadSizeLimit,
    uploadAttachment,
} from "./media";
import {
    deleteMessage,
    getJoinRule,
    getRoom,
    getRoomAvatar,
    getRoomMembers,
    getRoomTopic,
    getRooms,
    getTimelineMessages,
    getUserPresence,
    mxcToHttp,
    threadRelationParams,
    type PluginSyncAccountData,
} from "./client";

const PLUGIN_SYNC_KEY = "moe.crafty.matrix.plugins";

// mxc → client generation for every `uploadPluginMedia` result, so a plugin
// cannot upload as one account and send the mxc as the next one.
const pluginMediaOwners = createMediaOwnership();

/** Throw when any of `urls` was uploaded under an earlier client generation. */
function assertMediaOwned(urls: string[], generation: number): void {
    if (urls.some((url) => pluginMediaOwners.isForeign(url, generation))) {
        throw new Error(t("pluginHost.mediaWasUploadedByADifferent"));
    }
}

/** Push the manual plugin-sync payload to the user's account data. No-op when
 *  logged out. */
export async function persistPluginSync(
    content: PluginSyncAccountData,
): Promise<void> {
    if (!matrixClient) return;
    await matrixClient.setAccountData(PLUGIN_SYNC_KEY, content);
}

/** Read the manual plugin-sync payload from account data, or null if absent. */
export function loadPluginSync(): PluginSyncAccountData | null {
    if (!matrixClient) return null;
    const event = matrixClient.getAccountData(PLUGIN_SYNC_KEY);
    if (!event) return null;
    return event.getContent() as PluginSyncAccountData;
}

/** Send a fully-built event content object. 2-arg sendMessage form ONLY (the
 *  threadId overload mangles $-prefixed text — CLAUDE.md landmine). */
export async function sendEventContent(
    roomId: string,
    content: Record<string, unknown>,
): Promise<string> {
    const owner = captureClient();
    assertMediaOwned(mxcUrlsInContent(content), owner.generation);
    const res = await owner.client.sendMessage(roomId, content as never);
    return res.event_id;
}

/** Plain room summary for plugins — never returns a live Room. */
export function getPluginRoomSummary(roomId: string): PluginRoomSummary | null {
    const room = getRoom(roomId);
    if (!room) return null;
    return {
        roomId,
        name: room.name ?? roomId,
        topic: getRoomTopic(room),
        memberCount: getRoomMembers(room).length,
        avatarUrl: getRoomAvatar(room),
        joinRule: getJoinRule(room),
        isSpace: room.isSpaceRoom(),
    };
}

/** Plain summaries of every joined room and space. */
export function getPluginRooms(): PluginRoomSummary[] {
    return getRooms().flatMap((r) => {
        const s = getPluginRoomSummary(r.roomId);
        return s ? [s] : [];
    });
}

/** State event types a plugin may not write through `setState`: they are
 *  what Zam's own settings and moderation UI own, and a stray write can lock
 *  everyone out of a room. `unsafe.getClient()` remains for the rare plugin
 *  that truly needs one. */
const CORE_STATE_TYPES = new Set([
    "m.room.create",
    "m.room.member",
    "m.room.power_levels",
    "m.room.encryption",
    "m.room.tombstone",
    "m.room.server_acl",
    "m.room.join_rules",
    "m.room.history_visibility",
    "m.room.guest_access",
]);

/** Event types `sendEvent` refuses: state goes through setState, and these
 *  have dedicated, checked paths (redactOwn, react, the call stack). */
const RESERVED_SEND_TYPES = new Set([
    "m.room.redaction",
    "m.room.encrypted",
    "m.reaction",
    "m.call.invite",
    "m.call.answer",
    "m.call.hangup",
    "m.call.candidates",
]);

/** Send a non-state event of any type for a plugin. */
export async function sendPluginEvent(
    roomId: string,
    type: string,
    content: Record<string, unknown>,
): Promise<string> {
    if (typeof type !== "string" || type === "")
        throw new Error("sendEvent: type must be a non-empty string");
    if (RESERVED_SEND_TYPES.has(type))
        throw new Error(`sendEvent: ${type} can't be sent this way`);
    if (type === "m.room.message") return sendEventContent(roomId, content);
    const owner = captureClient();
    assertMediaOwned(mxcUrlsInContent(content), owner.generation);
    const res = await owner.client.sendEvent(
        roomId,
        type as never,
        content as never,
    );
    return res.event_id;
}

/** One loaded event as a plain summary. */
export function getPluginEvent(
    roomId: string,
    eventId: string,
): PluginEventSummary | null {
    const ev = getRoom(roomId)?.findEventById(eventId);
    if (!ev) return null;
    return {
        eventId,
        roomId,
        sender: ev.getSender() ?? "",
        type: ev.getType(),
        content: { ...(ev.getContent() ?? {}) },
        timestamp: ev.getTs(),
        isRedacted: ev.isRedacted(),
        isOwn: ev.getSender() === matrixClient?.getUserId(),
    };
}

export function getPluginState(
    roomId: string,
    type: string,
    stateKey = "",
): Record<string, unknown> | null {
    const ev = getRoom(roomId)
        ?.getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents(type, stateKey);
    const content = ev?.getContent();
    return content && Object.keys(content).length > 0 ? { ...content } : null;
}

export function listPluginState(
    roomId: string,
    type: string,
): { stateKey: string; sender: string; content: Record<string, unknown> }[] {
    const evs =
        getRoom(roomId)
            ?.getLiveTimeline()
            .getState(EventTimeline.FORWARDS)
            ?.getStateEvents(type) ?? [];
    return evs
        .filter((e) => Object.keys(e.getContent() ?? {}).length > 0)
        .map((e) => ({
            stateKey: e.getStateKey() ?? "",
            sender: e.getSender() ?? "",
            content: { ...e.getContent() },
        }));
}

export function canSetPluginState(roomId: string, type: string): boolean {
    const me = matrixClient?.getUserId();
    const state = getRoom(roomId)
        ?.getLiveTimeline()
        .getState(EventTimeline.FORWARDS);
    if (!me || !state) return false;
    return state.maySendStateEvent(type, me);
}

export async function setPluginState(
    roomId: string,
    type: string,
    content: Record<string, unknown>,
    stateKey = "",
): Promise<void> {
    if (CORE_STATE_TYPES.has(type))
        throw new Error(
            `setState: ${type} is managed by Zam; use the room settings`,
        );
    const owner = captureClient();
    assertMediaOwned(mxcUrlsInContent(content), owner.generation);
    await owner.client.sendStateEvent(
        roomId,
        type as never,
        content as never,
        stateKey,
    );
}

/** Account data types Zam itself relies on; a plugin writing one would
 *  corrupt DMs, ignores, push rules or key backup. */
function isProtectedAccountData(type: string): boolean {
    return (
        type === "m.direct" ||
        type === "m.ignored_user_list" ||
        type === "m.push_rules" ||
        type === "m.fully_read" ||
        type.startsWith("m.secret_storage") ||
        type.startsWith("m.cross_signing") ||
        type.startsWith("m.megolm_backup") ||
        type.startsWith("m.org.matrix.custom.backup") ||
        type === PLUGIN_SYNC_KEY
    );
}

export function getPluginAccountData(
    type: string,
    roomId?: string,
): Record<string, unknown> | null {
    if (!matrixClient) return null;
    const ev = roomId
        ? getRoom(roomId)?.getAccountData(type)
        : matrixClient.getAccountData(type as never);
    const content = ev?.getContent();
    return content ? { ...content } : null;
}

export async function setPluginAccountData(
    type: string,
    content: Record<string, unknown>,
    roomId?: string,
): Promise<void> {
    if (isProtectedAccountData(type))
        throw new Error(`setAccountData: ${type} is managed by Zam`);
    const owner = captureClient();
    if (roomId)
        await owner.client.setRoomAccountData(
            roomId,
            type as never,
            content as never,
        );
    else await owner.client.setAccountData(type as never, content as never);
}

export async function getPluginProfile(
    userId: string,
): Promise<{ displayName: string | null; avatarUrl: string | null }> {
    const owner = captureClient();
    const p = await owner.client.getProfileInfo(userId);
    return {
        displayName: p.displayname ?? null,
        avatarUrl: mxcToHttp(p.avatar_url ?? null),
    };
}

export function getPluginPresence(userId: string): PluginPresenceState | null {
    const info = getUserPresence(userId);
    if (!info) return null;
    const p = info.presence;
    const lastActive = matrixClient?.getUser(userId)?.getLastActiveTs() ?? 0;
    return {
        presence:
            p === "online" || p === "unavailable" ? p : ("offline" as const),
        statusMsg: info.statusMsg ?? null,
        lastActiveAt: lastActive > 0 ? lastActive : null,
        currentlyActive: info.currentlyActive ?? false,
    };
}

/** Plain joined-member summaries for plugins — never returns live RoomMembers. */
export function getPluginRoomMembers(roomId: string): PluginMemberSummary[] {
    const room = getRoom(roomId);
    if (!room) return [];
    return getRoomMembers(room).map((m) => ({
        userId: m.userId,
        displayName: m.name ?? null,
        avatarUrl: mxcToHttp(m.getMxcAvatarUrl() ?? null),
        powerLevel: m.powerLevel ?? 0,
    }));
}

/** Last `limit` renderable messages as plain summaries for plugins. */
export function getPluginRecentMessages(
    roomId: string,
    limit?: number,
): PluginTimelineMessage[] {
    const room = getRoom(roomId);
    if (!room) return [];
    const ownUserId = matrixClient?.getUserId() ?? null;
    const records: PluginTimelineRecord[] = getTimelineMessages(room).map(
        (e) => {
            const content = e.getContent() ?? {};
            return {
                eventId: e.getId() ?? "",
                sender: e.getSender() ?? "",
                msgtype:
                    typeof content.msgtype === "string"
                        ? content.msgtype
                        : e.getType(),
                body: typeof content.body === "string" ? content.body : "",
                timestamp: e.getTs() ?? 0,
                isRedacted: e.isRedacted(),
            };
        },
    );
    return selectRecentMessages(records, limit, ownUserId);
}

/** Upload a Blob/File; resolve to its mxc:// URL (plugin media pipeline). */
export async function uploadPluginMedia(
    file: Blob,
    name: string,
    type?: string,
): Promise<string> {
    const owner = captureClient();
    const { content_uri } = await owner.client.uploadContent(file, {
        name,
        type: type ?? (file as File).type ?? undefined,
    });
    // Recorded under the generation that STARTED the upload: if the account
    // switched mid-upload, a later send of this mxc is refused.
    pluginMediaOwners.record(content_uri, owner.generation);
    return content_uri;
}

/**
 * Upload a blob (encrypting in encrypted rooms) and send it as a media message
 * (m.image/m.video/m.audio/m.file). This is the plugin API's encryption-aware
 * media send; prefer it over `uploadMedia` + `sendImage` in plugin code.
 */
export async function sendPluginMedia(
    roomId: string,
    blob: Blob,
    opts: { name?: string; type?: string; body?: string; msgtype?: string },
): Promise<void> {
    const owner = captureClient();
    const maxUploadSize = await getMediaUploadSizeLimit();
    ownedClientOrThrow(owner);
    const fileName = opts.name ?? "upload";
    if (exceedsUploadLimit(blob.size, maxUploadSize)) {
        throw new FileTooLargeError(
            fileName,
            blob.size,
            maxUploadSize as number,
        );
    }
    const fileType = midiSendMimetype(
        opts.type || blob.type || "application/octet-stream",
        fileName,
    );
    const isImage = fileType.startsWith("image/");
    const isVideo = fileType.startsWith("video/");
    const isAudio =
        fileType.startsWith("audio/") || isMidiAttachment(fileType, fileName);
    if (
        opts.msgtype &&
        !["m.image", "m.video", "m.audio", "m.file"].includes(opts.msgtype)
    ) {
        throw new Error(`sendMedia: unsupported msgtype ${opts.msgtype}`);
    }
    const msgtype =
        opts.msgtype ??
        (isImage
            ? "m.image"
            : isVideo
              ? "m.video"
              : isAudio
                ? "m.audio"
                : "m.file");

    const uploadResult = await uploadAttachment(owner, roomId, blob, {
        name: fileName,
        type: fileType,
        msgtype,
    });

    await ownedClientOrThrow(owner).sendMessage(roomId, {
        msgtype,
        body: opts.body ?? fileName,
        ...uploadResult, // { url } or { file } — never both
        info: { mimetype: fileType, size: blob.size },
        "m.mentions": {},
    } as never);
}

/** Redact one of the user's OWN events. Throws if the event is not the
 *  caller's own (a plugin must not redact others' messages via this surface). */
export async function redactOwnEvent(
    roomId: string,
    eventId: string,
    reason?: string,
): Promise<void> {
    if (!matrixClient) throw new Error(t("pluginHost.notLoggedIn"));
    const room = getRoom(roomId);
    const ev = room?.findEventById(eventId);
    const sender = ev?.getSender();
    const me = matrixClient.getUserId();
    if (!sender || sender !== me) {
        throw new Error("redactOwn: event is not yours (or not found)");
    }
    await deleteMessage(roomId, eventId, reason);
}

/** Plugin-facing sticker send (host API `zam.matrix.sendSticker`). Same
 *  `m.sticker` content shape as `sendSticker`, but accepts the minimal plain
 *  payload a plugin passes (no `url` field required). */
export async function sendPluginSticker(
    roomId: string,
    sticker: {
        mxcUrl: string;
        body?: string;
        shortcode?: string;
        info?: object;
    },
    thread?: { rootEventId: string },
): Promise<void> {
    if (!matrixClient) throw new Error(t("pluginHost.notConnected"));
    const owner = captureClient();
    const content: Record<string, unknown> = {
        body: sticker.body || sticker.shortcode || "sticker",
        url: sticker.mxcUrl,
        info: sticker.info ?? {},
        "m.mentions": {},
    };
    assertMediaOwned(mxcUrlsInContent(content), owner.generation);
    const finalContent = thread
        ? withThreadRelation(
              content,
              threadRelationParams(roomId, thread.rootEventId),
          )
        : content;
    await matrixClient.sendEvent(roomId, "m.sticker" as any, finalContent);
}

/** The attachment of a media event as a Blob (decrypted when the room is
 *  encrypted), for host API `zam.matrix.getMedia`. */
export async function getPluginMedia(
    roomId: string,
    eventId: string,
): Promise<{ blob: Blob; mimetype: string }> {
    const ev = getRoom(roomId)?.findEventById(eventId);
    if (!ev) throw new Error("getMedia: event not found");
    const content = ev.getContent() ?? {};
    const info = content.info as { mimetype?: string } | undefined;
    const file = content.file as
        | (Parameters<typeof fetchDecryptedAttachmentBlob>[0] | undefined)
        | undefined;
    let objectUrl: string;
    if (file?.url) {
        objectUrl = await fetchDecryptedAttachmentBlob(file, info?.mimetype);
    } else {
        const http =
            typeof content.url === "string" ? mxcToHttp(content.url) : null;
        if (!http) throw new Error("getMedia: event has no attachment");
        objectUrl = await fetchAttachmentBlob(http);
    }
    try {
        const blob = await (await fetch(objectUrl)).blob();
        return { blob, mimetype: blob.type || info?.mimetype || "" };
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

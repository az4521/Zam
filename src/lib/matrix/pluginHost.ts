/**
 * Plugin host bridge: the ONLY plugin-facing Matrix surface. `hostApi.ts`
 * wraps these, and the plugin boot glue reads/writes plugin sync through
 * them. Returns plain summaries, never live SDK objects.
 *
 * Split out of `client.ts` (audit ARCH-01). It reads the client slot from
 * `runtime.ts` and reuses the room/media helpers `client.ts` exports.
 */
import type {
    PluginRoomSummary,
    PluginMemberSummary,
    PluginTimelineMessage,
} from "../plugins/types";
import {
    selectRecentMessages,
    type PluginTimelineRecord,
} from "../plugins/pluginTimeline";
import { exceedsUploadLimit, FileTooLargeError } from "$lib/utils/uploadLimits";
import { withThreadRelation } from "$lib/utils/threadContent";
import {
    createMediaOwnership,
    mxcUrlsInContent,
} from "$lib/utils/mediaOwnership";
import { captureClient, matrixClient, ownedClientOrThrow } from "./runtime";
import {
    deleteMessage,
    getJoinRule,
    getMediaUploadSizeLimit,
    getRoom,
    getRoomAvatar,
    getRoomMembers,
    getRoomTopic,
    getTimelineMessages,
    mxcToHttp,
    threadRelationParams,
    uploadAttachment,
    type PluginSyncAccountData,
} from "./client";

const PLUGIN_SYNC_KEY = "moe.crafty.matrix.plugins";

// mxc → client generation for every `uploadPluginMedia` result, so a plugin
// cannot upload as one account and send the mxc as the next one.
const pluginMediaOwners = createMediaOwnership();

/** Throw when any of `urls` was uploaded under an earlier client generation. */
function assertMediaOwned(urls: string[], generation: number): void {
    if (urls.some((url) => pluginMediaOwners.isForeign(url, generation))) {
        throw new Error("Media was uploaded by a different account");
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
    const fileType = opts.type || blob.type || "application/octet-stream";
    const isImage = fileType.startsWith("image/");
    const isVideo = fileType.startsWith("video/");
    const isAudio = fileType.startsWith("audio/");
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
    if (!matrixClient) throw new Error("Not logged in");
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
    if (!matrixClient) throw new Error("Not connected");
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

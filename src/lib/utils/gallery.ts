/**
 * MSC4274 inline media galleries: one `m.room.message` whose `msgtype` is
 * `m.gallery` (unstable `dm.filament.gallery`) carrying a shared caption in
 * `body`/`formatted_body` and an ordered `itemtypes` array. Each item has the
 * schema of an `m.image`/`m.video`/`m.audio`/`m.file` content, with `itemtype`
 * in place of `msgtype`.
 *
 * https://github.com/matrix-org/matrix-spec-proposals/pull/4274
 *
 * Pure and SDK-free. Everything here treats the event as untrusted: items that
 * are not objects or carry an unknown itemtype are dropped, never thrown on.
 */

/** Stable msgtype, once the MSC is merged. */
export const GALLERY_MSGTYPE = "m.gallery";
/** Unstable msgtype the MSC asks implementations to use until then. */
export const GALLERY_MSGTYPE_UNSTABLE = "dm.filament.gallery";

/** What this client sends. Switch to GALLERY_MSGTYPE when the MSC lands. */
export const GALLERY_SEND_MSGTYPE = GALLERY_MSGTYPE_UNSTABLE;

/**
 * Most items one sent gallery holds. The MSC estimates ~1 KB per encrypted
 * item against the 64 KiB event limit (about 60); a long caption and long file
 * names eat into that, so stay well under. A bigger batch is split into
 * several galleries.
 */
export const GALLERY_MAX_ITEMS = 40;

export type GalleryItemType = "m.image" | "m.video" | "m.audio" | "m.file";

const ITEM_TYPES: ReadonlySet<string> = new Set([
    "m.image",
    "m.video",
    "m.audio",
    "m.file",
]);

type Content = Record<string, unknown> | null | undefined;

/** True for both the stable and the unstable gallery msgtype. */
export function isGalleryMsgtype(msgtype: unknown): boolean {
    return msgtype === GALLERY_MSGTYPE || msgtype === GALLERY_MSGTYPE_UNSTABLE;
}

/** True when `content` is a gallery message. */
export function isGalleryContent(content: Content): boolean {
    return !!content && isGalleryMsgtype(content.msgtype);
}

/**
 * The gallery's valid items, in order, each as an ordinary media content with
 * `msgtype` set from its `itemtype` (so every existing helper that reads an
 * `m.image`/`m.video`/... content can take it as is). The `itemtype` key is
 * kept as well. Empty for non-gallery content or a missing/garbled array.
 */
export function galleryItems(
    content: Content,
): (Record<string, unknown> & { msgtype: GalleryItemType })[] {
    if (!isGalleryContent(content)) return [];
    const raw = content!.itemtypes;
    if (!Array.isArray(raw)) return [];
    const out: (Record<string, unknown> & { msgtype: GalleryItemType })[] = [];
    for (const item of raw) {
        if (typeof item !== "object" || item === null || Array.isArray(item))
            continue;
        const itemtype = (item as Record<string, unknown>).itemtype;
        if (typeof itemtype !== "string" || !ITEM_TYPES.has(itemtype)) continue;
        out.push({
            ...(item as Record<string, unknown>),
            msgtype: itemtype as GalleryItemType,
        });
    }
    return out;
}

/**
 * Turn a fully built single-media content (as sendFile would send it, with
 * `msgtype`) into a gallery item: `itemtype` instead of `msgtype`, and no
 * caption, relation or mention fields, which belong to the gallery event.
 * A captioned item's `filename` becomes its `body`, as for an uncaptioned
 * upload.
 */
export function toGalleryItem(
    content: Record<string, unknown>,
): Record<string, unknown> {
    const {
        msgtype,
        body,
        filename,
        format: _format,
        formatted_body: _formattedBody,
        "m.mentions": _mentions,
        "m.relates_to": _relatesTo,
        ...rest
    } = content;
    const name =
        typeof filename === "string" && filename
            ? filename
            : typeof body === "string"
              ? body
              : "";
    return { itemtype: msgtype, body: name, ...rest };
}

/**
 * The content of a gallery message from already-built gallery items (see
 * toGalleryItem). With no caption `body` is the empty string, as the MSC's
 * `body` is the caption and carries no fallback.
 */
export function buildGalleryContent(
    items: Record<string, unknown>[],
    caption?: {
        body: string;
        formattedBody?: string | null;
        mentions?: { user_ids?: string[]; room?: boolean };
    },
): Record<string, unknown> {
    const content: Record<string, unknown> = {
        msgtype: GALLERY_SEND_MSGTYPE,
        body: caption?.body ?? "",
        itemtypes: items,
        // Always present, as for single media: disables legacy body-scan pushes.
        "m.mentions": caption?.mentions ?? {},
    };
    if (caption?.formattedBody) {
        content.format = "org.matrix.custom.html";
        content.formatted_body = caption.formattedBody;
    }
    return content;
}

/** Split `items` into consecutive chunks of at most GALLERY_MAX_ITEMS. */
export function chunkGalleryItems<T>(items: readonly T[]): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += GALLERY_MAX_ITEMS)
        out.push(items.slice(i, i + GALLERY_MAX_ITEMS));
    return out;
}

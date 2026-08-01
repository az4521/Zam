/**
 * Identity keys for the emoji and sticker picker options.
 *
 * `anchoredActiveIndex` (utils/listboxAnchor.ts) needs, for each rendered
 * option, "whatever the component would act on if the user pressed Enter". A
 * GIF had that ready-made — its URL — but an emoji does not: the flat list
 * mixes custom images with standard unicode characters, and the same shortcode
 * legitimately appears in two different packs.
 *
 * The keys are therefore namespaced (`s` for standard, `c` for custom) and
 * built from NUL-joined segments, so no combination of a pack id, a shortcode
 * and an mxc url can spell another option's key. NUL is used because it cannot
 * occur in practice: shortcodes and mxc urls arrive raw from remote pack state
 * and are only validated on write, never on read, so nothing here structurally
 * excludes it -- but no server or client emits one, and the worst a hostile
 * pack could buy with a smuggled NUL is a cursor that reads as inactive.
 */

const SEP = "\u0000";

export type EmojiOptionLike =
    | {
          kind: "custom";
          data: { packId: string; shortcode: string; mxcUrl: string };
      }
    | { kind: "standard"; data: { emoji: string } };

export type StickerOptionLike = { shortcode: string; mxcUrl: string };

/** Key for one custom image (emoji or sticker). `packId` may be empty when the
 *  caller's flat list has already discarded pack identity — shortcode + mxc url
 *  still identify the image that would be sent. Not the whole payload, though:
 *  `sendSticker` (matrix/client.ts) also sends `body` and `info`, so two
 *  entries agreeing on these two segments send the same image, possibly under a
 *  different caption. That residual is acceptable here — the anchor exists to
 *  stop Enter sending a *different picture* than the one the ring is on. */
function customImageKey(
    packId: string,
    shortcode: string,
    mxcUrl: string,
): string {
    return "c" + SEP + packId + SEP + shortcode + SEP + mxcUrl;
}

/** Option keys for EmojiPicker's flat list, in render order. */
export function emojiOptionKeys(items: readonly EmojiOptionLike[]): string[] {
    return items.map((item) =>
        item.kind === "custom"
            ? customImageKey(
                  item.data.packId,
                  item.data.shortcode,
                  item.data.mxcUrl,
              )
            : "s" + SEP + item.data.emoji,
    );
}

/** Option keys for StickerPicker's flat list, in render order. */
export function stickerOptionKeys(
    items: readonly StickerOptionLike[],
): string[] {
    return items.map((s) => customImageKey("", s.shortcode, s.mxcUrl));
}

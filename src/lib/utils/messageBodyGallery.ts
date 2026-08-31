/**
 * Pure helpers for paging a single message's OWN inline images in the shared
 * lightbox.
 *
 * A standard `m.image` event carries exactly one image, so the only place a
 * single message holds several images is a rich/bridged `formatted_body` with
 * multiple inline `<img>` tags. This picks the real photo/media images out of a
 * body's `<img>` list, dropping Twemoji unicode-emoji images and `data-mx-
 * emoticon` custom emotes (both render as `<img>` but are not gallery media).
 *
 * Kept free of the DOM and the SDK so it is unit-testable; the caller (a Svelte
 * action over the live `.message-body`) reads the attributes into these plain
 * descriptors. `galleryNav` is re-exported so the caller imports every gallery
 * helper from one module.
 */
import { galleryNav } from "./mediaGallery";

export { galleryNav };

export interface BodyImageInput {
    /** Resolved http src of the `<img>` (the sanitizer rewrites mxc → http). */
    src: string | null | undefined;
    alt?: string | null;
    /** A custom emote (`data-mx-emoticon`) — excluded from the gallery. */
    emoticon: boolean;
    /** A Twemoji unicode-emoji image (`class="twemoji"` / `/twemoji/` src) —
     *  excluded from the gallery. */
    twemoji: boolean;
}

export interface GalleryImage {
    src: string;
    alt: string;
}

/** A body `<img>` counts as gallery media iff it has a real src and is neither
 *  a Twemoji emoji nor a custom emote. */
export function isGalleryImage(img: BodyImageInput): boolean {
    if (img.emoticon || img.twemoji) return false;
    return typeof img.src === "string" && img.src.length > 0;
}

/** A message body's real (photo/media) images in DOM order, with emoji and
 *  emotes removed. Duplicate srcs are kept as separate entries. */
export function collectBodyGalleryImages(
    imgs: readonly BodyImageInput[],
): GalleryImage[] {
    const out: GalleryImage[] = [];
    for (const img of imgs) {
        if (!isGalleryImage(img)) continue;
        out.push({ src: img.src as string, alt: img.alt ?? "" });
    }
    return out;
}

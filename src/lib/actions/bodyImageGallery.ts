/**
 * Svelte action: page a single message's OWN inline body images in the shared
 * lightbox. Attach to a `.message-body` container. On a plain left click of a
 * real media image (not a Twemoji emoji or a `data-mx-emoticon` emote), it
 * collects the container's media images and calls `onOpen(images, index)` at
 * the clicked image's index.
 *
 * Delegated (one listener on the container) so images rendered later — after an
 * edit or a late decryption swaps the `{@html}` body — are covered too, exactly
 * like the sibling `matrixLinks` action. Attach it AFTER `use:matrixLinks`:
 * matrixLinks runs first and ignores non-matrix anchors (parseMatrixLink returns
 * null); this handler then runs and, for a media image, opens the lightbox and
 * calls preventDefault so a wrapping plain (https) anchor does not navigate.
 *
 * The image `src` is already the resolved full-res http URL: the sanitizer
 * rewrites body `img` mxc → http via `mxcToHttp` (no thumbnail dimensions).
 */
import {
    collectBodyGalleryImages,
    isGalleryImage,
    type BodyImageInput,
    type GalleryImage,
} from "$lib/utils/messageBodyGallery";

export interface BodyImageGalleryParams {
    onOpen: (images: GalleryImage[], index: number) => void;
}

function describe(img: HTMLImageElement): BodyImageInput {
    return {
        src: img.currentSrc || img.getAttribute("src"),
        alt: img.getAttribute("alt"),
        emoticon: img.hasAttribute("data-mx-emoticon"),
        twemoji:
            img.classList.contains("twemoji") ||
            img.classList.contains("name-twemoji"),
    };
}

export function bodyImageGallery(
    node: HTMLElement,
    params: BodyImageGalleryParams,
) {
    let onOpen = params.onOpen;

    function onClick(e: MouseEvent) {
        if (e.defaultPrevented) return;
        // Let modified / middle clicks keep the browser default (open in tab).
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)
            return;
        const img = (e.target as Element | null)?.closest?.(
            "img",
        ) as HTMLImageElement | null;
        if (!img || !node.contains(img)) return;
        if (!isGalleryImage(describe(img))) return;
        // A spoiler-wrapped image must stay behind its spoiler: the sibling
        // `spoilers` action (registered first) reveals it on click; opening the
        // lightbox here would expose it on the first tap. Leave spoilered images
        // to inline reveal only.
        const spoiler = img.closest("[data-mx-spoiler]");
        if (spoiler && node.contains(spoiler)) return;
        // Don't hijack a text-selection drag that happens to release on an image.
        const sel =
            typeof window !== "undefined" && window.getSelection
                ? window.getSelection()
                : null;
        if (sel && !sel.isCollapsed) return;

        // Media images of this body, in DOM order, and the clicked one's index.
        const gallery: { el: HTMLImageElement; input: BodyImageInput }[] = [];
        for (const el of Array.from(node.querySelectorAll("img"))) {
            const input = describe(el as HTMLImageElement);
            if (isGalleryImage(input))
                gallery.push({ el: el as HTMLImageElement, input });
        }
        const index = gallery.findIndex((g) => g.el === img);
        if (index < 0) return;
        const images = collectBodyGalleryImages(gallery.map((g) => g.input));
        if (images.length === 0) return;

        e.preventDefault();
        e.stopPropagation();
        onOpen(images, index);
    }

    node.addEventListener("click", onClick);
    return {
        update(next: BodyImageGalleryParams) {
            onOpen = next.onOpen;
        },
        destroy() {
            node.removeEventListener("click", onClick);
        },
    };
}

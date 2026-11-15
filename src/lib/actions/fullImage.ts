// Marks an inline image tile with where its full-size original lives, so the
// desktop right-click "Copy image" / "Save image as" act on the original
// rather than the downscaled copy or server thumbnail the tile shows (see
// desktopContextMenu.ts). A tile without this falls back to guessing from
// its src.
import type { EncryptedFileInfo } from "$lib/utils/decryptAttachment";

export type FullImageSource = (
    | /** An http(s) media URL (fetched with auth when it is the homeserver's)
       *  or a blob: URL the page already holds. */
      { kind: "url"; url: string }
      /** An encrypted attachment still to be fetched and decrypted. */
    | {
          kind: "encrypted";
          file: EncryptedFileInfo & { url: string };
          mimetype?: string;
      }
) & {
    /** File name to save under, when the tile's alt text isn't it. */
    name?: string;
};

/** Called at click time, so it reports whatever is current then (e.g. a
 *  decrypted original that has landed since the tile mounted). */
type Getter = () => FullImageSource | null | undefined;

const sources = new WeakMap<Element, Getter>();

export function fullImage(node: HTMLElement, get: Getter) {
    sources.set(node, get);
    return {
        update(next: Getter) {
            sources.set(node, next);
        },
        destroy() {
            sources.delete(node);
        },
    };
}

/** The full-size source marked on `el`, or null when it carries none. */
export function fullImageSourceOf(el: Element | null): FullImageSource | null {
    if (!el) return null;
    return sources.get(el)?.() ?? null;
}

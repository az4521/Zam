/**
 * The app's one preview bundler (utils/previewBundler.ts), wired to this
 * device's page fetch, the homeserver's /preview_url and the media repo.
 */
import { createPreviewBundler, MAX_BUNDLED } from "$lib/utils/previewBundler";
import {
    previewableBodyUrls,
    type BundledEntries,
} from "$lib/utils/urlPreviews";
import { settingsState } from "$lib/stores/settings.svelte";
import type { UploadedPreviewImage } from "$lib/utils/bundledPreview";
import { canFetchLinkPages, fetchLinkPage } from "$lib/linkPageFetch";
import { homeserverPreviewUrl } from "$lib/utils/linkPreviewFetch";
import { getRawUrlPreview } from "./client";
import { uploadPreviewImage } from "./media";

async function measure(
    bytes: Uint8Array,
    type: string,
): Promise<{ width: number; height: number } | null> {
    if (typeof createImageBitmap !== "function") return null;
    try {
        const bitmap = await createImageBitmap(
            new Blob([bytes as BlobPart], { type }),
        );
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return size.width > 0 && size.height > 0 ? size : null;
    } catch {
        return null;
    }
}

export const previewBundler = createPreviewBundler({
    fetchPage: (url, mode) =>
        canFetchLinkPages() ? fetchLinkPage(url, mode) : Promise.resolve(null),
    homeserverPreview: async (url) => {
        const data = await getRawUrlPreview(homeserverPreviewUrl(url));
        return data && !("error" in data) ? data : null;
    },
    upload: async (roomId, bytes, type) =>
        (await uploadPreviewImage(roomId, bytes, type)) as UploadedPreviewImage,
    measure,
});

function contentUrls(content: Record<string, unknown>): string[] {
    const body = content.body;
    if (typeof body !== "string") return [];
    const html =
        typeof content.formatted_body === "string"
            ? content.formatted_body
            : null;
    return previewableBodyUrls(body, html);
}

/** Links worth preparing: http(s) links outside code and `<...>`, minus
 *  matrix.to links (those render as message embeds, not page previews). */
export function bundlableUrls(text: string): string[] {
    return previewableBodyUrls(text).filter(
        (u) => !/^https:\/\/matrix\.to\//i.test(u),
    );
}

/** Start preparing the links in composer `text` for `roomId`. */
export function prepareComposerPreviews(text: string, roomId: string): void {
    if (!settingsState.sendLinkPreviews) return;
    for (const url of bundlableUrls(text).slice(0, MAX_BUNDLED))
        void previewBundler.prepare(url, roomId);
}

/** The finished bundled previews for an outgoing content's links. */
export function readyBundledPreviews(
    content: Record<string, unknown>,
    roomId: string,
): BundledEntries | undefined {
    if (!settingsState.sendLinkPreviews) return undefined;
    return previewBundler.ready(contentUrls(content), roomId);
}

/** As readyBundledPreviews, waiting briefly for links still being prepared.
 *  Only for sends whose order does not matter (scheduled messages). */
export async function collectBundledPreviews(
    content: Record<string, unknown>,
    roomId: string,
): Promise<BundledEntries | undefined> {
    if (!settingsState.sendLinkPreviews) return undefined;
    return previewBundler.collect(contentUrls(content), roomId);
}

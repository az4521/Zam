<script lang="ts">
    import { t } from "$lib/i18n";
    import { untrack } from "svelte";
    import type { Room } from "matrix-js-sdk";
    import {
        fetchRoomMediaPage,
        getIndexedMedia,
        isEventIndexActive,
        fetchAttachmentBlob,
        fetchDecryptedAttachmentBlob,
        mxcToHttp,
        type RoomMediaPage,
    } from "$lib/matrix/client";
    import {
        fetchDecryptedAttachment,
        fetchDecryptedAttachmentFromPrefix,
        fetchThumbnailPrefix,
    } from "$lib/matrix/media";
    import {
        decryptedBlobs,
        type HeldBlob,
    } from "$lib/utils/decryptedBlobCache";
    import { createTileImage } from "$lib/utils/tileImage";
    import { saveObjectUrl, revokeLater } from "$lib/utils/saveFile";
    import {
        mergeMediaPages,
        splitMediaItems,
        formatMediaSize,
        formatMediaDuration,
        mediaThumbnailMxc,
        mediaTileSource,
        mediaViewerItem,
        mediaItemKey,
        type RoomMediaItem,
    } from "$lib/utils/roomMedia";
    import { galleryPositionLabel } from "$lib/utils/mediaGallery";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import Lightbox from "$lib/components/ui/Lightbox.svelte";

    interface Props {
        room: Room;
        onClose: () => void;
    }

    let { room, onClose }: Props = $props();

    let items = $state<RoomMediaItem[]>([]);
    let nextToken = $state<string | null>(null);
    let loading = $state(true);
    let loadingMore = $state(false);
    let error = $state<string | null>(null);
    // Kept apart from `error`: a failed "Load more" must NOT replace an already
    // populated grid with the full-panel error branch (and its "Try again",
    // which re-fetches from scratch). Shown as an inline strip instead.
    let loadMoreError = $state<string | null>(null);
    let exhausted = $state(false);
    let tab = $state<"media" | "files">("media");
    let viewerIndex = $state<number | null>(null);
    // Event ids whose tile thumbnail 404'd or otherwise failed to decode. Most
    // videos carry no info.thumbnail_url and most servers cannot thumbnail a
    // video, so this is the ORDINARY path for them, not an error case: the tile
    // swaps to a placeholder instead of showing a broken-image glyph.
    let thumbFailed = $state<Record<string, boolean>>({});
    // Decrypted encrypted thumbnails, keyed by mediaItemKey.
    let decryptedThumbs = $state<Record<string, string>>({});
    // Decrypted full image for the viewer and its neighbours, keyed by
    // mediaItemKey. Each URL is held in `heldFull` from the shared cache.
    let decryptedFull = $state<Record<string, string>>({});
    const prefetchPending = new Set<string>();
    // Encrypted tiles that have come near the viewport: only these decrypt.
    let nearIds = $state<Record<string, boolean>>({});
    // The holds on full images, by item key (see decryptedBlobCache.ts).
    const heldFull = new Map<string, HeldBlob>();
    // The items the viewer shows or steps to. A decrypt that lands for any
    // other item lets go of it at once.
    let liveIds = new Set<string>();

    const split = $derived(splitMediaItems(items));
    const visible = $derived(tab === "media" ? split.visual : split.files);
    const hasMore = $derived(!exhausted);

    // "…in this room yet." would assert something the Load-more button directly
    // beneath it contradicts, so only claim it once history is exhausted.
    const emptyMessage = $derived(
        hasMore
            ? tab === "media"
                ? t("roomMediaPanel.noMediaFoundInTheLast")
                : t("roomMediaPanel.noFilesFoundInTheLast")
            : tab === "media"
              ? t("roomMediaPanel.noImagesOrVideosInThis")
              : t("roomMediaPanel.noFilesInThisRoomYet"),
    );

    // Everything in the Media tab is viewable: the Lightbox renders an image or
    // a native player depending on `kind`, so prev/next steps across a mixed
    // image/video set in the order the grid shows them.
    const gallery = $derived(split.visual);

    // Each load keeps paging until the open tab gained about a screenful (a
    // 3-wide grid, 8 rows) or history runs out. Stopping at the first page
    // with anything in it showed one or two tiles per click: in an encrypted
    // room a page is 100 messages of any kind, and media is a few of them.
    // Capped so a media-less room cannot spin forever on one load.
    const FILL_TARGET = 24;
    const MAX_PAGES_PER_LOAD = 10;

    // Identifies the pull that currently owns the panel's state. A plain `let`,
    // deliberately NOT $state: pull() both reads and increments it, and pull()
    // is called from the room-change $effect, so a reactive read there would
    // register a dependency that pull's own `++` immediately invalidates.
    let pullGen = 0;

    async function pull(reset: boolean): Promise<void> {
        const gen = ++pullGen;
        loadMoreError = null;
        if (reset) {
            items = [];
            nextToken = null;
            exhausted = false;
            error = null;
            // A viewer left open over the old room's images would otherwise
            // re-mount on whatever lands at that index next.
            viewerIndex = null;
            thumbFailed = {};
            releaseDecryptedBlobs();
            loading = true;
        } else {
            loadingMore = true;
        }
        const roomId = room.roomId;
        try {
            // Encrypted room with the on-device index: show what it holds at
            // once, then page the server only from where its crawler stopped.
            if (
                reset &&
                isEventIndexActive() &&
                room.hasEncryptionStateEvent()
            ) {
                const indexed = await getIndexedMedia(roomId);
                if (gen !== pullGen || room.roomId !== roomId) return;
                items = mergeMediaPages(items, indexed.items);
                if (indexed.complete) {
                    exhausted = true;
                    return;
                }
                if (indexed.resumeFrom !== null) {
                    nextToken = indexed.resumeFrom;
                    if (tabCount() >= FILL_TARGET) return;
                    reset = false;
                }
            }
            const startCount = tabCount();
            for (let page = 0; page < MAX_PAGES_PER_LOAD; page++) {
                const res: RoomMediaPage = await fetchRoomMediaPage(
                    roomId,
                    reset && page === 0 ? null : nextToken,
                );
                // Superseded while awaiting — the panel lives in a shared
                // sidebar slot, so a room switch REPLACES the prop instead of
                // remounting us, and an A→B→A switch leaves roomId equal. Only
                // the generation counter reliably says "someone else owns the
                // state now"; bail without touching any of it.
                if (gen !== pullGen || room.roomId !== roomId) return;
                items = mergeMediaPages(items, res.items);
                nextToken = res.nextToken;
                if (res.nextToken === null) {
                    exhausted = true;
                    break;
                }
                // Count what landed in the tab being looked at: duplicates and
                // the other tab's items don't fill the screen.
                if (tabCount() - startCount >= FILL_TARGET) break;
            }
        } catch (e) {
            // SDK errors read like `MatrixError: [403] …` — log the real one,
            // show the user something they can act on.
            console.error("Failed to load room media", e);
            if (gen === pullGen) {
                if (reset) error = t("roomMediaPanel.couldNotLoadMedia");
                else loadMoreError = t("roomMediaPanel.couldNotLoadMoreMedia");
            }
        } finally {
            // Never clear a flag a newer pull set: the guard above `return`s
            // through this block, and without the check a late response from
            // the previous room would drop the current room's spinner.
            if (gen === pullGen) {
                loading = false;
                loadingMore = false;
            }
        }
    }

    function tabCount(): number {
        const s = splitMediaItems(items);
        return (tab === "media" ? s.visual : s.files).length;
    }

    // Load more on its own when the end of the list scrolls into view.
    let loadMoreEl = $state<HTMLElement | null>(null);
    $effect(() => {
        const el = loadMoreEl;
        if (!el) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting) && !loadingMore)
                void pull(false);
        });
        observer.observe(el);
        return () => observer.disconnect();
    });

    // Reload from scratch whenever the panel is pointed at a different room.
    // `room.roomId` is read OUTSIDE untrack so the prop is the effect's one and
    // only dependency; pull() is untracked because it writes items/nextToken/
    // loading/exhausted synchronously and calls into the SDK boundary, and a
    // dependency picked up in there would make those writes re-enter the effect
    // (effect_update_depth_exceeded).
    $effect(() => {
        void room.roomId;
        untrack(() => {
            void pull(true);
        });
    });

    function openViewer(item: RoomMediaItem): void {
        const key = mediaItemKey(item);
        const index = gallery.findIndex((i) => mediaItemKey(i) === key);
        if (index === -1) return;
        viewerIndex = index;
    }

    function step(delta: number): void {
        if (viewerIndex === null) return;
        const next = viewerIndex + delta;
        if (next < 0 || next >= gallery.length) return;
        viewerIndex = next;
    }

    async function download(item: RoomMediaItem, quiet = false): Promise<void> {
        try {
            const blobUrl =
                item.encrypted && item.encryptedFile
                    ? await fetchDecryptedAttachmentBlob(
                          item.encryptedFile,
                          item.mimetype ?? undefined,
                      )
                    : await fetchAttachmentBlob(mxcToHttp(item.url)!);
            try {
                await saveObjectUrl(blobUrl, item.name, { quiet });
            } finally {
                revokeLater(blobUrl);
            }
        } catch (e) {
            console.error("Failed to download attachment", e);
            showErrorToast(t("roomMediaPanel.failedToDownloadAttachment"));
        }
    }

    // Blob URLs this panel makes for its tiles are released together when the
    // panel switches room or unmounts. Bumping `blobGen` (a plain let, never
    // reactive) orphans any decrypt still in flight: its result is released
    // instead of written into the new room's maps. Full images are held from
    // the shared decryptedBlobs cache, which keeps them warm for the next view.
    let blobGen = 0;
    const thumbPending = new Set<string>();
    function releaseDecryptedBlobs(): void {
        blobGen++;
        thumbPending.clear();
        prefetchPending.clear();
        for (const url of Object.values(decryptedThumbs))
            URL.revokeObjectURL(url);
        for (const held of heldFull.values()) held.release();
        heldFull.clear();
        liveIds = new Set();
        nearIds = {};
        decryptedThumbs = {};
        decryptedFull = {};
    }
    $effect(() => () => releaseDecryptedBlobs());

    /** Marks an encrypted tile as near the viewport, which lets it decrypt. Once
     *  near it stays marked: a tile is a small copy, not the full file. */
    function nearViewport(node: HTMLElement, id: string) {
        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries.some((e) => e.isIntersecting)) return;
                nearIds[id] = true;
                observer.disconnect();
            },
            { rootMargin: "300px" },
        );
        observer.observe(node);
        return { destroy: () => observer.disconnect() };
    }

    /** The decrypted full image of an encrypted item: held from the shared
     *  cache when it is there, else decrypted now and cached. The caller owns
     *  the hold and must release it or keep it (keepFull). */
    function heldFullOf(media: RoomMediaItem): Promise<HeldBlob> {
        const file = media.encryptedFile!;
        const hit = decryptedBlobs.get(file.url);
        if (hit) return Promise.resolve(hit);
        return fullBlobOf(media).then((blob) =>
            decryptedBlobs.hold(file.url, blob),
        );
    }

    /** The decrypted prefix thumbnail of an item (thumbnailPrefix.ts): the whole
     *  thumbnail for decoding, and the shared prefix for the resume. Null when it
     *  has none, or it does not check out as the declared shape. */
    function prefixOf(
        media: RoomMediaItem,
    ): Promise<{ thumb: Uint8Array; prefix: Uint8Array } | null> {
        const thumb = media.encryptedThumbnailFile;
        if (!media.thumbnailPrefix || !thumb) return Promise.resolve(null);
        return fetchThumbnailPrefix(
            { thumbnail_file: thumb },
            media.thumbnailPrefix,
        ).catch(() => null);
    }

    /** The full image of an encrypted item, fetched from where its prefix
     *  thumbnail ends when it has one. */
    async function fullBlobOf(media: RoomMediaItem): Promise<Blob> {
        const file = media.encryptedFile!;
        const got = await prefixOf(media);
        if (got) {
            return fetchDecryptedAttachmentFromPrefix(
                file,
                got.prefix,
                media.mimetype ?? undefined,
                { expectedSize: media.size },
            );
        }
        return fetchDecryptedAttachment(file, media.mimetype ?? undefined, {
            expectedSize: media.size,
        });
    }

    /** A blob URL for an encrypted tile, owned by the caller. An image sent with
     *  a thumbnail decrypts that thumbnail; one sent without gets a tile cut from
     *  its full image, so the grid never holds a full-size decode. A video uses
     *  its thumbnail_file (never the video itself; see mediaTileSource). */
    async function tileUrlOf(media: RoomMediaItem): Promise<string> {
        // A prefix thumbnail is the top of a full-size JPEG: cut it down to a
        // tile, never show it as it is. The tile decodes the whole thumbnail.
        const got =
            media.kind === "image" && media.thumbnailPrefix
                ? await prefixOf(media)
                : null;
        if (got) {
            const blob = new Blob([got.thumb as BlobPart], {
                type: "image/jpeg",
            });
            const tile =
                (await createTileImage(blob).catch(() => null)) ?? blob;
            return URL.createObjectURL(tile);
        }
        if (
            media.kind === "image" &&
            (!media.encryptedThumbnailFile || media.thumbnailPrefix)
        ) {
            const held = await heldFullOf(media);
            try {
                const tile = (await createTileImage(held.blob)) ?? held.blob;
                return URL.createObjectURL(tile);
            } finally {
                held.release();
            }
        }
        const source = mediaTileSource(media);
        if (source?.kind !== "encrypted") throw new Error("no encrypted tile");
        return fetchDecryptedAttachmentBlob(
            source.file,
            source.mimetype ?? undefined,
        );
    }

    // Decrypt each encrypted tile once, and only once it is near the viewport.
    // Re-runs as tiles scroll in and on "Load more"; skips anything already
    // decrypted or in flight.
    $effect(() => {
        const wanted = split.visual.filter(
            (m) =>
                !!nearIds[mediaItemKey(m)] &&
                !!m.encrypted &&
                mediaTileSource(m)?.kind === "encrypted",
        );
        untrack(() => {
            const gen = blobGen;
            for (const media of wanted) {
                const id = mediaItemKey(media);
                if (
                    decryptedThumbs[id] ||
                    thumbPending.has(id) ||
                    thumbFailed[id]
                )
                    continue;
                thumbPending.add(id);
                tileUrlOf(media)
                    .then((url) => {
                        if (gen !== blobGen) {
                            URL.revokeObjectURL(url);
                            return;
                        }
                        decryptedThumbs[id] = url;
                    })
                    .catch(() => {
                        if (gen === blobGen) thumbFailed[id] = true;
                    })
                    .finally(() => {
                        if (gen === blobGen) thumbPending.delete(id);
                    });
            }
        });
    });

    /** Keeps a decrypted full image for the viewer or a neighbour, or lets go of
     *  it when nothing wants it any more (stale, or not on screen). */
    function keepFull(id: string, gen: number, held: HeldBlob): void {
        if (gen !== blobGen || !liveIds.has(id)) {
            held.release();
            return;
        }
        const have = heldFull.get(id);
        if (have) held.release();
        else heldFull.set(id, held);
        decryptedFull[id] = (have ?? held).url;
    }

    // Decrypt the full image when the viewer opens on an encrypted image. Until
    // it lands the viewer shows the tile as its stand-in (see the template).
    $effect(() => {
        if (viewerIndex === null) return;
        const item = gallery[viewerIndex];
        if (!item || !item.encrypted || !item.encryptedFile) return;
        // An encrypted video is decrypted by the viewer itself, which can
        // start playing while it is still downloading.
        if (item.kind === "video") return;
        const id = mediaItemKey(item);
        if (untrack(() => decryptedFull[id])) return;
        const gen = blobGen;
        heldFullOf(item)
            .then((held) => keepFull(id, gen, held))
            .catch(() => {
                /* the stand-in stays up; nothing else to show */
            });
    });

    // Decrypt the encrypted images either side of the viewed one, so a swipe
    // lands on a loaded image, and let go of every full image that is no longer
    // the viewed one or a neighbour. Closing the viewer keeps none of them.
    $effect(() => {
        const idx = viewerIndex;
        const current = idx === null ? null : gallery[idx];
        const near =
            idx === null
                ? []
                : [gallery[idx - 1], gallery[idx + 1]].filter(
                      (m): m is RoomMediaItem => !!m,
                  );
        const wanted = near.filter(
            (m) => m.kind === "image" && !!m.encrypted && !!m.encryptedFile,
        );
        untrack(() => {
            const keep = new Set(
                [current, ...near]
                    .filter((m): m is RoomMediaItem => !!m)
                    .map((m) => mediaItemKey(m)),
            );
            liveIds = keep;
            for (const [id, held] of heldFull) {
                if (keep.has(id)) continue;
                held.release();
                heldFull.delete(id);
            }
            for (const id of Object.keys(decryptedFull))
                if (!keep.has(id)) delete decryptedFull[id];
            const gen = blobGen;
            for (const media of wanted) {
                const id = mediaItemKey(media);
                if (decryptedFull[id] || prefetchPending.has(id)) continue;
                prefetchPending.add(id);
                heldFullOf(media)
                    .then((held) => keepFull(id, gen, held))
                    .catch(() => {
                        /* a failed prefetch just means no warm copy */
                    })
                    .finally(() => {
                        if (gen === blobGen) prefetchPending.delete(id);
                    });
            }
        });
    });

    /** The tile thumbnail the grid shows for an item: the same URL, so the
     *  viewer's stand-in comes from the browser cache. */
    function tileThumb(item: RoomMediaItem): string | null {
        const id = mediaItemKey(item);
        if (thumbFailed[id]) return null;
        return item.encrypted
            ? (decryptedThumbs[id] ?? null)
            : mxcToHttp(mediaThumbnailMxc(item), 160, 160);
    }

    /** A swipe neighbour: its full src ("" while not ready, or for a video,
     *  which the viewer does not preload), plus its tile thumbnail. */
    function neighbourOf(item: RoomMediaItem | undefined) {
        if (!item) return null;
        const id = mediaItemKey(item);
        const src =
            item.kind !== "image"
                ? ""
                : item.encrypted
                  ? (decryptedFull[id] ?? "")
                  : (mxcToHttp(item.url) ?? "");
        return { src, placeholders: [tileThumb(item)] };
    }

    const viewerNeighbours = $derived(
        viewerIndex === null
            ? undefined
            : {
                  prev: neighbourOf(gallery[viewerIndex - 1]),
                  next: neighbourOf(gallery[viewerIndex + 1]),
              },
    );
</script>

<div
    class="{interfaceState.isMobile
        ? ''
        : 'w-72'} h-full flex flex-col bg-zam-backgroundSecondary border-l border-zam-divider"
>
    <div
        class="h-12 flex items-center gap-2 px-4 py-3 border-b border-zam-divider flex-shrink-0"
    >
        <h3
            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide flex-1"
        >
            {t("roomMediaPanel.media")}
        </h3>
        <button
            onclick={onClose}
            class="text-zam-textMuted hover:text-zam-textPrimary transition-colors"
            title={t("common.close")}
            aria-label={t("roomMediaPanel.closeMediaPanel")}
        >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"
                ><path
                    d="M18.3 5.71 12 12.01l-6.3-6.3-1.42 1.42 6.3 6.3-6.3 6.3 1.42 1.42 6.3-6.3 6.3 6.3 1.42-1.42-6.3-6.3 6.3-6.3z"
                /></svg
            >
        </button>
    </div>

    <div
        class="flex items-center gap-1 px-2 py-2 border-b border-zam-divider flex-shrink-0"
        role="tablist"
    >
        <button
            id="room-media-tab-media"
            role="tab"
            aria-selected={tab === "media"}
            aria-controls="room-media-tabpanel"
            onclick={() => (tab = "media")}
            class="flex-1 py-1 text-xs rounded transition-colors {tab ===
            'media'
                ? 'bg-zam-messageHover text-zam-textPrimary'
                : 'text-zam-textMuted hover:text-zam-textPrimary'}"
        >
            {t("roomMediaPanel.media2", {
                length: split.visual.length,
                value: hasMore ? "+" : "",
            })}
        </button>
        <button
            id="room-media-tab-files"
            role="tab"
            aria-selected={tab === "files"}
            aria-controls="room-media-tabpanel"
            onclick={() => (tab = "files")}
            class="flex-1 py-1 text-xs rounded transition-colors {tab ===
            'files'
                ? 'bg-zam-messageHover text-zam-textPrimary'
                : 'text-zam-textMuted hover:text-zam-textPrimary'}"
        >
            {t("roomMediaPanel.files", {
                length: split.files.length,
                value: hasMore ? "+" : "",
            })}
        </button>
    </div>

    <div
        id="room-media-tabpanel"
        role="tabpanel"
        aria-labelledby={tab === "media"
            ? "room-media-tab-media"
            : "room-media-tab-files"}
        class="flex-1 overflow-y-auto"
    >
        {#if loading}
            <div class="flex justify-center mt-8">
                <div
                    class="w-5 h-5 border-2 border-zam-accent border-t-transparent rounded-full animate-spin"
                ></div>
            </div>
        {:else if error}
            <p class="text-sm text-zam-danger text-center mt-8 px-4">
                {error}
            </p>
            <div class="px-2 pt-2">
                <button
                    onclick={() => pull(true)}
                    class="w-full py-1.5 text-xs text-zam-accent hover:underline disabled:opacity-50"
                >
                    {t("roomMediaPanel.tryAgain")}
                </button>
            </div>
        {:else if visible.length === 0}
            <p class="text-sm text-zam-textMuted text-center mt-8 px-4">
                {emptyMessage}
            </p>
        {:else if tab === "media"}
            <div class="grid grid-cols-3 gap-1 p-2">
                {#each split.visual as media (mediaItemKey(media))}
                    {@const thumbMxc = mediaThumbnailMxc(media)}
                    {@const thumb = thumbFailed[mediaItemKey(media)]
                        ? null
                        : media.encrypted
                          ? (decryptedThumbs[mediaItemKey(media)] ?? null)
                          : mxcToHttp(thumbMxc, 160, 160)}
                    {@const duration = formatMediaDuration(media.durationMs)}
                    <button
                        onclick={() => openViewer(media)}
                        use:nearViewport={mediaItemKey(media)}
                        class="relative aspect-square rounded overflow-hidden bg-zam-background hover:opacity-80 transition-opacity"
                        title={media.kind === "video"
                            ? t("roomMediaPanel.play", { name: media.name })
                            : media.name}
                    >
                        {#if thumb}
                            <!-- Decrypted or unencrypted thumbnail -->
                            <img
                                src={thumb}
                                alt={media.name}
                                loading="lazy"
                                class="w-full h-full object-cover"
                                onerror={() =>
                                    (thumbFailed[mediaItemKey(media)] = true)}
                            />
                        {:else if media.kind === "video"}
                            <!-- Nothing to show: a flat tile that lets the play
                                 badge below carry the meaning on its own. -->
                            <div
                                class="w-full h-full bg-zam-backgroundTertiary"
                            ></div>
                        {/if}
                        {#if media.kind === "video"}
                            <!-- Play affordance: a still tile that reads as
                                 playable, with no media element behind it. -->
                            <span
                                class="absolute inset-0 flex items-center justify-center"
                            >
                                <span
                                    class="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center"
                                >
                                    <svg
                                        class="w-4 h-4 text-white ms-0.5"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                        ><path d="M8 5v14l11-7z" /></svg
                                    >
                                </span>
                            </span>
                            <span
                                class="absolute bottom-1 end-1 px-1 rounded bg-black/60 text-white text-[0.625rem]"
                                >{duration || t("roomMediaPanel.video")}</span
                            >
                        {/if}
                    </button>
                {/each}
            </div>
        {:else}
            <div class="p-2 space-y-1">
                {#each split.files as file (mediaItemKey(file))}
                    <button
                        onclick={(e) => download(file, e.shiftKey)}
                        class="w-full text-start p-2 rounded-lg hover:bg-zam-messageHover transition-colors"
                    >
                        <p
                            class="text-xs font-semibold text-zam-textPrimary truncate"
                        >
                            {file.name}
                        </p>
                        <p class="text-xs text-zam-textMuted">
                            {formatMediaSize(file.size) ||
                                (file.kind === "audio"
                                    ? t("roomMediaPanel.audio")
                                    : t("roomMediaPanel.file"))}
                        </p>
                    </button>
                {/each}
            </div>
        {/if}

        {#if loadMoreError}
            <!-- Inline, not the full-panel error branch: whatever already
                 loaded stays on screen and "Load more" can simply be retried. -->
            <p class="text-xs text-zam-danger text-center px-2 pb-1">
                {loadMoreError}
            </p>
        {/if}

        {#if !loading && !error && hasMore}
            <div class="px-2 pb-2" bind:this={loadMoreEl}>
                <button
                    onclick={() => pull(false)}
                    disabled={loadingMore}
                    class="w-full py-1.5 text-xs text-zam-accent hover:underline disabled:opacity-50"
                >
                    {loadingMore ? t("common.loading") : t("common.loadMore")}
                </button>
            </div>
        {/if}
    </div>
</div>

{#if viewerIndex !== null && gallery[viewerIndex]}
    {@const item = gallery[viewerIndex]}
    {@const view = mediaViewerItem(item, {
        // An encrypted item resolves only once decrypted: its mxc holds
        // ciphertext, which the viewer would download and fail to show. Until
        // then "" (not null, which would drop the viewer): the tile stands in.
        full: (mxc) =>
            item.encrypted && item.kind !== "video"
                ? (decryptedFull[mediaItemKey(item)] ?? "")
                : mxcToHttp(mxc),
        // "scale" rather than the default crop: a poster must match the video's
        // own aspect ratio or the player letterboxes a distorted still.
        poster: (mxc) =>
            item.encrypted && decryptedThumbs[mediaItemKey(item)]
                ? decryptedThumbs[mediaItemKey(item)]
                : mxcToHttp(mxc, 800, 600, "scale"),
    })}
    {#if view}
        <!-- Shown at once: an encrypted image's src is "" until its full copy
             has decrypted, and the tile stands in behind it (placeholders). -->
        <Lightbox
            src={view.src}
            alt={view.filename}
            kind={view.kind}
            poster={item.encrypted
                ? // An encrypted video has no thumbnail_url, so mediaViewerItem
                  // never asks for one: use the decrypted thumbnail_file tile.
                  view.kind === "video"
                    ? (decryptedThumbs[mediaItemKey(item)] ?? null)
                    : null
                : view.poster}
            filename={view.filename}
            encryptedFile={item.encrypted && item.kind === "video"
                ? item.encryptedFile
                : undefined}
            mimetype={item.mimetype}
            sizeHint={item.size}
            onClose={() => (viewerIndex = null)}
            onPrev={viewerIndex > 0 ? () => step(-1) : undefined}
            onNext={viewerIndex < gallery.length - 1
                ? () => step(1)
                : undefined}
            position={galleryPositionLabel(
                gallery.length,
                viewerIndex,
                hasMore,
            )}
            placeholders={[tileThumb(item)]}
            neighbours={viewerNeighbours}
        />
    {:else}
        <!-- mediaViewerItem resolved to nothing (bad mxc / signed-out media
             endpoint): without this branch the tile click set viewerIndex but
             nothing rendered, so the click looked dead. Show a dismissable
             notice instead of silently no-op'ing. -->
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={t("roomMediaPanel.mediaCouldNotBeLoaded")}
        >
            <div
                class="bg-zam-backgroundSecondary rounded-lg p-6 max-w-sm text-center shadow-lg"
            >
                <p class="text-sm text-zam-textPrimary mb-4">
                    {t("roomMediaPanel.couldNotLoadThisMedia")}
                </p>
                <button
                    onclick={() => (viewerIndex = null)}
                    class="px-4 py-1.5 text-sm rounded bg-zam-accent text-white hover:opacity-90 transition-opacity"
                >
                    {t("common.close")}
                </button>
            </div>
        </div>
    {/if}
{/if}

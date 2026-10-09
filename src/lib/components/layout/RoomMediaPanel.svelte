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
    import { saveObjectUrl, revokeLater } from "$lib/utils/saveFile";
    import {
        mergeMediaPages,
        splitMediaItems,
        formatMediaSize,
        formatMediaDuration,
        mediaThumbnailMxc,
        mediaTileSource,
        mediaViewerItem,
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
    // Decrypted encrypted thumbnails, keyed by eventId.
    let decryptedThumbs = $state<Record<string, string>>({});
    // Decrypted full media for the lightbox viewer, keyed by eventId.
    let decryptedFull = $state<Record<string, string>>({});
    let viewerDecrypting = $state(false);

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
        const index = gallery.findIndex((i) => i.eventId === item.eventId);
        if (index === -1) return;
        viewerIndex = index;
    }

    function step(delta: number): void {
        if (viewerIndex === null) return;
        const next = viewerIndex + delta;
        if (next < 0 || next >= gallery.length) return;
        viewerIndex = next;
    }

    async function download(item: RoomMediaItem): Promise<void> {
        try {
            const blobUrl =
                item.encrypted && item.encryptedFile
                    ? await fetchDecryptedAttachmentBlob(
                          item.encryptedFile,
                          item.mimetype ?? undefined,
                      )
                    : await fetchAttachmentBlob(mxcToHttp(item.url)!);
            try {
                await saveObjectUrl(blobUrl, item.name);
            } finally {
                revokeLater(blobUrl);
            }
        } catch (e) {
            console.error("Failed to download attachment", e);
            showErrorToast(t("roomMediaPanel.failedToDownloadAttachment"));
        }
    }

    // Decrypted blob URLs live until the panel switches room or unmounts, and
    // are released together here. Bumping `blobGen` (a plain let, never
    // reactive) orphans any decrypt still in flight: it revokes its own URL
    // instead of writing into the new room's maps.
    let blobGen = 0;
    const thumbPending = new Set<string>();
    function releaseDecryptedBlobs(): void {
        blobGen++;
        thumbPending.clear();
        for (const url of Object.values(decryptedThumbs))
            URL.revokeObjectURL(url);
        for (const url of Object.values(decryptedFull))
            URL.revokeObjectURL(url);
        decryptedThumbs = {};
        decryptedFull = {};
        viewerDecrypting = false;
    }
    $effect(() => () => releaseDecryptedBlobs());

    // Decrypt each encrypted tile once: an image's own file, a video's
    // thumbnail_file (never the video itself; see mediaTileSource). Re-runs on
    // every "Load more", so it skips anything already decrypted or in flight.
    $effect(() => {
        const wanted = split.visual
            .map((m) => ({ id: m.eventId, source: mediaTileSource(m) }))
            .filter((x) => x.source?.kind === "encrypted");
        untrack(() => {
            const gen = blobGen;
            for (const { id, source } of wanted) {
                if (source?.kind !== "encrypted") continue;
                if (decryptedThumbs[id] || thumbPending.has(id)) continue;
                thumbPending.add(id);
                fetchDecryptedAttachmentBlob(
                    source.file,
                    source.mimetype ?? undefined,
                )
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

    // Decrypt full media when the viewer opens on an encrypted item. The
    // result is kept in decryptedFull (released with the panel) even if the
    // user has stepped on, but only the current item's decrypt may clear the
    // spinner.
    $effect(() => {
        if (viewerIndex === null) return;
        const item = gallery[viewerIndex];
        if (!item || !item.encrypted || !item.encryptedFile) return;
        const id = item.eventId;
        if (untrack(() => decryptedFull[id])) return; // Already decrypted
        const gen = blobGen;
        let cancelled = false;
        viewerDecrypting = true;
        fetchDecryptedAttachmentBlob(
            item.encryptedFile,
            item.mimetype ?? undefined,
        )
            .then((decrypted) => {
                if (gen !== blobGen) {
                    URL.revokeObjectURL(decrypted);
                    return;
                }
                decryptedFull[id] = decrypted;
                if (!cancelled) viewerDecrypting = false;
            })
            .catch(() => {
                if (!cancelled) viewerDecrypting = false;
            });
        return () => {
            cancelled = true;
            viewerDecrypting = false;
        };
    });
</script>

<div
    class="{interfaceState.isMobile
        ? ''
        : 'w-72'} h-full flex flex-col bg-discord-backgroundSecondary border-l border-discord-divider"
>
    <div
        class="h-12 flex items-center gap-2 px-4 py-3 border-b border-discord-divider flex-shrink-0"
    >
        <h3
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide flex-1"
        >
            {t("roomMediaPanel.media")}
        </h3>
        <button
            onclick={onClose}
            class="text-discord-textMuted hover:text-discord-textPrimary transition-colors"
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
        class="flex items-center gap-1 px-2 py-2 border-b border-discord-divider flex-shrink-0"
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
                ? 'bg-discord-messageHover text-discord-textPrimary'
                : 'text-discord-textMuted hover:text-discord-textPrimary'}"
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
                ? 'bg-discord-messageHover text-discord-textPrimary'
                : 'text-discord-textMuted hover:text-discord-textPrimary'}"
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
                    class="w-5 h-5 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"
                ></div>
            </div>
        {:else if error}
            <p class="text-sm text-discord-danger text-center mt-8 px-4">
                {error}
            </p>
            <div class="px-2 pt-2">
                <button
                    onclick={() => pull(true)}
                    class="w-full py-1.5 text-xs text-discord-accent hover:underline disabled:opacity-50"
                >
                    {t("roomMediaPanel.tryAgain")}
                </button>
            </div>
        {:else if visible.length === 0}
            <p class="text-sm text-discord-textMuted text-center mt-8 px-4">
                {emptyMessage}
            </p>
        {:else if tab === "media"}
            <div class="grid grid-cols-3 gap-1 p-2">
                {#each split.visual as media (media.eventId)}
                    {@const thumbMxc = mediaThumbnailMxc(media)}
                    {@const thumb = thumbFailed[media.eventId]
                        ? null
                        : media.encrypted
                          ? (decryptedThumbs[media.eventId] ?? null)
                          : mxcToHttp(thumbMxc, 160, 160)}
                    {@const duration = formatMediaDuration(media.durationMs)}
                    <button
                        onclick={() => openViewer(media)}
                        class="relative aspect-square rounded overflow-hidden bg-discord-background hover:opacity-80 transition-opacity"
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
                                    (thumbFailed[media.eventId] = true)}
                            />
                        {:else if media.kind === "video"}
                            <!-- Nothing to show: a flat tile that lets the play
                                 badge below carry the meaning on its own. -->
                            <div
                                class="w-full h-full bg-discord-backgroundTertiary"
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
                {#each split.files as file (file.eventId)}
                    <button
                        onclick={() => download(file)}
                        class="w-full text-start p-2 rounded-lg hover:bg-discord-messageHover transition-colors"
                    >
                        <p
                            class="text-xs font-semibold text-discord-textPrimary truncate"
                        >
                            {file.name}
                        </p>
                        <p class="text-xs text-discord-textMuted">
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
            <p class="text-xs text-discord-danger text-center px-2 pb-1">
                {loadMoreError}
            </p>
        {/if}

        {#if !loading && !error && hasMore}
            <div class="px-2 pb-2" bind:this={loadMoreEl}>
                <button
                    onclick={() => pull(false)}
                    disabled={loadingMore}
                    class="w-full py-1.5 text-xs text-discord-accent hover:underline disabled:opacity-50"
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
        // ciphertext, which the viewer would download and fail to show.
        full: (mxc) =>
            item.encrypted
                ? (decryptedFull[item.eventId] ?? null)
                : mxcToHttp(mxc),
        // "scale" rather than the default crop: a poster must match the video's
        // own aspect ratio or the player letterboxes a distorted still.
        poster: (mxc) =>
            item.encrypted && decryptedThumbs[item.eventId]
                ? decryptedThumbs[item.eventId]
                : mxcToHttp(mxc, 800, 600, "scale"),
    })}
    {#if viewerDecrypting}
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={t("roomMediaPanel.decryptingMedia")}
        >
            <div
                class="bg-discord-backgroundSecondary rounded-lg p-6 max-w-sm text-center shadow-lg"
            >
                <div
                    class="w-8 h-8 mx-auto mb-4 border-4 border-discord-accent border-t-transparent rounded-full animate-spin"
                ></div>
                <p class="text-sm text-discord-textPrimary">
                    {t("roomMediaPanel.decryptingMedia2")}
                </p>
            </div>
        </div>
    {:else if view}
        <Lightbox
            src={view.src}
            alt={view.filename}
            kind={view.kind}
            poster={item.encrypted
                ? // An encrypted video has no thumbnail_url, so mediaViewerItem
                  // never asks for one: use the decrypted thumbnail_file tile.
                  view.kind === "video"
                    ? (decryptedThumbs[item.eventId] ?? null)
                    : null
                : view.poster}
            filename={view.filename}
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
                class="bg-discord-backgroundSecondary rounded-lg p-6 max-w-sm text-center shadow-lg"
            >
                <p class="text-sm text-discord-textPrimary mb-4">
                    {t("roomMediaPanel.couldNotLoadThisMedia")}
                </p>
                <button
                    onclick={() => (viewerIndex = null)}
                    class="px-4 py-1.5 text-sm rounded bg-discord-accent text-white hover:opacity-90 transition-opacity"
                >
                    {t("common.close")}
                </button>
            </div>
        </div>
    {/if}
{/if}

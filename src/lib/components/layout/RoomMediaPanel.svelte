<script lang="ts">
    import { untrack } from "svelte";
    import type { Room } from "matrix-js-sdk";
    import {
        fetchRoomMediaPage,
        fetchAttachmentBlob,
        mxcToHttp,
        type RoomMediaPage,
    } from "$lib/matrix/client";
    import {
        mergeMediaPages,
        splitMediaItems,
        formatMediaSize,
        formatMediaDuration,
        mediaThumbnailMxc,
        mediaViewerItem,
        type RoomMediaItem,
    } from "$lib/utils/roomMedia";
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
    // E2EE attachments are `content.file`, never `content.url`, and nothing here
    // decrypts them — so an encrypted room lists nothing however far we page.
    // Reported by the wrapper (RoomMediaPage.encrypted) rather than read from
    // crypto.ts, which components do not import.
    let isEncrypted = $state(false);
    let tab = $state<"media" | "files">("media");
    let viewerIndex = $state<number | null>(null);
    // Event ids whose tile thumbnail 404'd or otherwise failed to decode. Most
    // videos carry no info.thumbnail_url and most servers cannot thumbnail a
    // video, so this is the ORDINARY path for them, not an error case: the tile
    // swaps to a placeholder instead of showing a broken-image glyph.
    let thumbFailed = $state<Record<string, boolean>>({});

    const split = $derived(splitMediaItems(items));
    const visible = $derived(tab === "media" ? split.visual : split.files);
    const hasMore = $derived(!exhausted);

    // "…in this room yet." would assert something the Load-more button directly
    // beneath it contradicts, so only claim it once history is exhausted.
    const emptyMessage = $derived(
        isEncrypted
            ? "Encrypted attachments can't be listed yet."
            : hasMore
              ? tab === "media"
                  ? "No media found in the last few hundred messages."
                  : "No files found in the last few hundred messages."
              : tab === "media"
                ? "No images or videos in this room yet."
                : "No files in this room yet.",
    );

    // Everything in the Media tab is viewable: the Lightbox renders an image or
    // a native player depending on `kind`, so prev/next steps across a mixed
    // image/video set in the order the grid shows them.
    const gallery = $derived(split.visual);

    // A page can legitimately contain no media at all (a run of text
    // messages), so keep pulling until something lands or history runs out.
    // Capped so a media-less room cannot spin forever on one click.
    const MAX_PAGES_PER_CLICK = 5;

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
            isEncrypted = false;
            error = null;
            // A viewer left open over the old room's images would otherwise
            // re-mount on whatever lands at that index next.
            viewerIndex = null;
            thumbFailed = {};
            loading = true;
        } else {
            loadingMore = true;
        }
        const roomId = room.roomId;
        try {
            let added = 0;
            for (let page = 0; page < MAX_PAGES_PER_CLICK; page++) {
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
                // Count what actually landed in the list, not what came back:
                // a page of already-merged duplicates adds nothing visible and
                // must not end the loop.
                const before = items.length;
                items = mergeMediaPages(items, res.items);
                added += items.length - before;
                nextToken = res.nextToken;
                if (page === 0) isEncrypted = res.encrypted;
                if (res.nextToken === null) {
                    exhausted = true;
                    break;
                }
                // Encrypted room: every attachment is `content.file`, so the
                // mapper rejects all of them and `added` stays 0 forever —
                // walking all five pages would decrypt ~200 events and discard
                // the lot on EVERY click. One request, then stop.
                if (res.encrypted) break;
                if (added > 0) break;
            }
        } catch (e) {
            // SDK errors read like `MatrixError: [403] …` — log the real one,
            // show the user something they can act on.
            console.error("Failed to load room media", e);
            if (gen === pullGen) {
                if (reset) error = "Could not load media.";
                else loadMoreError = "Could not load more media.";
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
        const url = mxcToHttp(item.url);
        if (!url) return;
        // Media lives behind the authenticated download endpoint, so the access
        // token has to be attached — opening the URL directly 401s on a server
        // that enforces authenticated media. Same blob-anchor-revoke dance as
        // the m.file card in MessageItem.
        try {
            const blobUrl = await fetchAttachmentBlob(url);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = item.name;
            // In the document, not detached: Firefox has historically ignored
            // `download` on an anchor that was never in the DOM. Same dance as
            // Lightbox's download button.
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        } catch (e) {
            console.error("Failed to download attachment", e);
            showErrorToast("Failed to download attachment");
        }
    }
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
            Media
        </h3>
        <button
            onclick={onClose}
            class="text-discord-textMuted hover:text-discord-textPrimary transition-colors"
            title="Close"
            aria-label="Close media panel"
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
            Media ({split.visual.length}{hasMore ? "+" : ""})
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
            Files ({split.files.length}{hasMore ? "+" : ""})
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
                    Try again
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
                        : mxcToHttp(thumbMxc, 160, 160)}
                    {@const duration = formatMediaDuration(media.durationMs)}
                    <button
                        onclick={() => openViewer(media)}
                        class="relative aspect-square rounded overflow-hidden bg-discord-background hover:opacity-80 transition-opacity"
                        title={media.kind === "video"
                            ? `${media.name} - play`
                            : media.name}
                    >
                        {#if thumb}
                            <!-- Only ever a real thumbnail: mediaThumbnailMxc
                                 hands back null for a video the sender did not
                                 thumbnail, so this <img> is never pointed at a
                                 video's own mxc (continuwuity would answer with
                                 the whole file). A thumbnail that still fails
                                 to decode falls through to the placeholder
                                 below instead of a broken-image glyph. And
                                 NEVER a <video> element per tile. -->
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
                                        class="w-4 h-4 text-white ml-0.5"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                        ><path d="M8 5v14l11-7z" /></svg
                                    >
                                </span>
                            </span>
                            <span
                                class="absolute bottom-1 right-1 px-1 rounded bg-black/60 text-white text-[0.625rem]"
                                >{duration || "Video"}</span
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
                        class="w-full text-left p-2 rounded-lg hover:bg-discord-messageHover transition-colors"
                    >
                        <p
                            class="text-xs font-semibold text-discord-textPrimary truncate"
                        >
                            {file.name}
                        </p>
                        <p class="text-xs text-discord-textMuted">
                            {formatMediaSize(file.size) ||
                                (file.kind === "audio" ? "Audio" : "File")}
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
            <div class="px-2 pb-2">
                <button
                    onclick={() => pull(false)}
                    disabled={loadingMore}
                    class="w-full py-1.5 text-xs text-discord-accent hover:underline disabled:opacity-50"
                >
                    {loadingMore ? "Loading…" : "Load more"}
                </button>
            </div>
        {/if}
    </div>
</div>

{#if viewerIndex !== null && gallery[viewerIndex]}
    {@const view = mediaViewerItem(gallery[viewerIndex], {
        full: (mxc) => mxcToHttp(mxc),
        // "scale" rather than the default crop: a poster must match the video's
        // own aspect ratio or the player letterboxes a distorted still.
        poster: (mxc) => mxcToHttp(mxc, 800, 600, "scale"),
    })}
    {#if view}
        <Lightbox
            src={view.src}
            alt={view.filename}
            kind={view.kind}
            poster={view.poster}
            filename={view.filename}
            onClose={() => (viewerIndex = null)}
            onPrev={viewerIndex > 0 ? () => step(-1) : undefined}
            onNext={viewerIndex < gallery.length - 1
                ? () => step(1)
                : undefined}
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
            aria-label="Media could not be loaded"
        >
            <div
                class="bg-discord-backgroundSecondary rounded-lg p-6 max-w-sm text-center shadow-lg"
            >
                <p class="text-sm text-discord-textPrimary mb-4">
                    Could not load this media.
                </p>
                <button
                    onclick={() => (viewerIndex = null)}
                    class="px-4 py-1.5 text-sm rounded bg-discord-accent text-white hover:opacity-90 transition-opacity"
                >
                    Close
                </button>
            </div>
        </div>
    {/if}
{/if}

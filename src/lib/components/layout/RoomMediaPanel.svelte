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
    let exhausted = $state(false);
    let tab = $state<"media" | "files">("media");
    let viewerIndex = $state<number | null>(null);

    const split = $derived(splitMediaItems(items));
    const visible = $derived(tab === "media" ? split.visual : split.files);
    const hasMore = $derived(!exhausted);

    // The Lightbox renders a single <img>, so only images can be viewed in it.
    // Videos still get a grid tile (they belong there visually) but clicking
    // one downloads it — see the tile's onclick.
    const gallery = $derived(split.visual.filter((i) => i.kind === "image"));

    // A page can legitimately contain no media at all (a run of text
    // messages), so keep pulling until something lands or history runs out.
    // Capped so a media-less room cannot spin forever on one click.
    const MAX_PAGES_PER_CLICK = 5;

    async function pull(reset: boolean): Promise<void> {
        if (reset) {
            items = [];
            nextToken = null;
            exhausted = false;
            error = null;
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
                // The room changed under us while awaiting; drop the result.
                if (room.roomId !== roomId) return;
                items = mergeMediaPages(items, res.items);
                added += res.items.length;
                nextToken = res.nextToken;
                if (res.nextToken === null) {
                    exhausted = true;
                    break;
                }
                if (added > 0) break;
            }
        } catch (e) {
            error = e instanceof Error ? e.message : "Could not load media";
        } finally {
            loading = false;
            loadingMore = false;
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
            a.click();
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
            role="tab"
            aria-selected={tab === "media"}
            onclick={() => (tab = "media")}
            class="flex-1 py-1 text-xs rounded transition-colors {tab ===
            'media'
                ? 'bg-discord-messageHover text-discord-textPrimary'
                : 'text-discord-textMuted hover:text-discord-textPrimary'}"
        >
            Media ({split.visual.length})
        </button>
        <button
            role="tab"
            aria-selected={tab === "files"}
            onclick={() => (tab = "files")}
            class="flex-1 py-1 text-xs rounded transition-colors {tab ===
            'files'
                ? 'bg-discord-messageHover text-discord-textPrimary'
                : 'text-discord-textMuted hover:text-discord-textPrimary'}"
        >
            Files ({split.files.length})
        </button>
    </div>

    <div class="flex-1 overflow-y-auto">
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
                {tab === "media"
                    ? "No images or videos in this room yet."
                    : "No files in this room yet."}
            </p>
        {:else if tab === "media"}
            <div class="grid grid-cols-3 gap-1 p-2">
                {#each split.visual as media (media.eventId)}
                    {@const thumb =
                        mxcToHttp(media.thumbnailUrl ?? media.url, 160, 160) ??
                        mxcToHttp(media.url)}
                    <button
                        onclick={() =>
                            media.kind === "image"
                                ? openViewer(media)
                                : download(media)}
                        class="relative aspect-square rounded overflow-hidden bg-discord-background hover:opacity-80 transition-opacity"
                        title={media.kind === "image"
                            ? media.name
                            : `${media.name} — download`}
                    >
                        {#if thumb}
                            <img
                                src={thumb}
                                alt={media.name}
                                loading="lazy"
                                class="w-full h-full object-cover"
                            />
                        {/if}
                        {#if media.kind === "video"}
                            <span
                                class="absolute bottom-1 right-1 px-1 rounded bg-black/60 text-white text-[0.625rem]"
                                >Video</span
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
    {@const current = gallery[viewerIndex]}
    {@const full = mxcToHttp(current.url)}
    {#if full}
        <Lightbox
            src={full}
            alt={current.name}
            onClose={() => (viewerIndex = null)}
            onPrev={viewerIndex > 0 ? () => step(-1) : undefined}
            onNext={viewerIndex < gallery.length - 1
                ? () => step(1)
                : undefined}
        />
    {/if}
{/if}

<script lang="ts">
    import type { Track } from "livekit-client";
    import { Maximize2 } from "lucide-svelte";
    import { videoTrack } from "$lib/actions/videoTrack";
    import type { VideoTileDescriptor } from "$lib/utils/videoTiles";

    interface Props {
        tile: VideoTileDescriptor;
        label: string;
        mirror?: boolean;
        /** Small filmstrip mode: hide the label + fullscreen chrome. */
        compact?: boolean;
    }
    let { tile, label, mirror = false, compact = false }: Props = $props();

    // Camera fills the tile (cover); a shared screen must never be cropped
    // (contain). Mirror only ever applies to a local camera self-view.
    const fit = $derived(
        tile.source === "camera" ? "object-cover" : "object-contain",
    );

    let containerEl: HTMLDivElement | null = null;
    // Fullscreen the whole tile (video + label). stopPropagation so the click
    // doesn't also trip the tile's focus/clear handler in CallView.
    function toggleFullscreen(e: MouseEvent): void {
        e.stopPropagation();
        if (!containerEl) return;
        if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => {});
        } else {
            void containerEl.requestFullscreen().catch(() => {});
        }
    }
</script>

<div bind:this={containerEl} class="group relative w-full h-full bg-black">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
        class="w-full h-full {fit} {mirror ? 'scale-x-[-1]' : ''}"
        autoplay
        playsinline
        muted={tile.isLocal}
        use:videoTrack={tile.track as Track}
    ></video>
    {#if !compact}
        <div
            class="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 max-w-[calc(100%-1rem)]"
        >
            <span class="text-xs text-white truncate">{label}</span>
        </div>
        <button
            onclick={toggleFullscreen}
            class="absolute bottom-2 right-2 p-1.5 rounded bg-black/60 text-white opacity-70 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            title="Fullscreen"
            aria-label="Fullscreen"
        >
            <Maximize2 size={16} />
        </button>
    {/if}
</div>

<script lang="ts">
    import type { Track } from "livekit-client";
    import { videoTrack } from "$lib/actions/videoTrack";
    import type { VideoTileDescriptor } from "$lib/utils/videoTiles";

    interface Props {
        tile: VideoTileDescriptor;
        label: string;
        mirror?: boolean;
    }
    let { tile, label, mirror = false }: Props = $props();

    // Camera fills the tile (cover); a shared screen must never be cropped
    // (contain). Mirror only ever applies to a local camera self-view.
    const fit = $derived(
        tile.source === "camera" ? "object-cover" : "object-contain",
    );
</script>

<div class="relative w-full h-full">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
        class="w-full h-full {fit} bg-black {mirror ? 'scale-x-[-1]' : ''}"
        autoplay
        playsinline
        muted={tile.isLocal}
        use:videoTrack={tile.track as Track}
    ></video>
    <div
        class="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 max-w-[calc(100%-1rem)]"
    >
        <span class="text-xs text-white truncate">{label}</span>
    </div>
</div>

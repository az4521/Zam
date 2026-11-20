<script lang="ts">
    import { t } from "$lib/i18n";
    import type { Track } from "livekit-client";
    import {
        Eye,
        EyeOff,
        Maximize2,
        PictureInPicture2,
        Volume2,
        VolumeX,
    } from "lucide-svelte";
    import { videoTrack } from "$lib/actions/videoTrack";
    import type { VideoTileDescriptor } from "$lib/utils/videoTiles";
    import { shareViewers } from "$lib/utils/shareWatchers";
    import WatcherStack from "$lib/components/layout/WatcherStack.svelte";
    import TileLabel from "$lib/components/layout/TileLabel.svelte";
    import {
        callPipState,
        closePipWindow,
        openPipWindow,
        pipWindowSupported,
    } from "$lib/stores/callPip.svelte";
    import {
        participantAudioFor,
        setUserShareMute,
        stopWatchingShare,
        voiceCallState,
        watchShare,
    } from "$lib/stores/voiceCall.svelte";
    import { participantHasShareAudio } from "$lib/matrix/client";

    interface Props {
        tile: VideoTileDescriptor;
        label: string;
        mirror?: boolean;
        /** Small filmstrip mode: hide the label + fullscreen chrome. */
        compact?: boolean;
        /** Draw the watchers stack at the top end. The picture-in-picture
         *  panel turns it off and lays the stack out with its own buttons. */
        showWatchers?: boolean;
    }
    let {
        tile,
        label,
        mirror = false,
        compact = false,
        showWatchers = true,
    }: Props = $props();

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

    const pipSupported = pipWindowSupported();
    const inPip = $derived(
        callPipState.windowOpen && callPipState.pinnedKey === tile.key,
    );
    function togglePip(e: MouseEvent): void {
        e.stopPropagation();
        if (inPip) closePipWindow();
        else void openPipWindow(tile.key, tile.track as Track);
    }

    // Someone else's screen share can be left and picked up again.
    const canLeave = $derived(tile.source === "screenshare" && !tile.isLocal);
    function leave(e: MouseEvent): void {
        e.stopPropagation();
        stopWatchingShare(tile);
    }
    function watch(e: MouseEvent): void {
        e.stopPropagation();
        watchShare(tile);
    }

    // Who is watching a screen share (ours or someone else's), by user.
    const isShare = $derived(tile.source === "screenshare");
    const viewers = $derived(
        shareViewers(voiceCallState.shareWatchers, tile.identity),
    );

    // Someone else's share sound can be muted for us alone, as in the menu.
    const shareSound = $derived(
        canLeave &&
            (void voiceCallState.voiceTick,
            participantHasShareAudio(tile.userId)),
    );
    const shareMuted = $derived(participantAudioFor(tile.userId).shareMuted);
    function toggleShareSound(e: MouseEvent): void {
        e.stopPropagation();
        setUserShareMute(tile.userId, !shareMuted);
    }
</script>

<div bind:this={containerEl} class="group relative w-full h-full bg-black">
    {#if tile.unwatched}
        <div
            class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-zam-textMuted"
        >
            <EyeOff size={compact ? 16 : 28} />
            {#if !compact}
                <span class="text-sm text-white text-center">{label}</span>
                <button
                    onclick={watch}
                    class="relative z-20 flex items-center gap-1.5 px-3 py-1.5 rounded bg-zam-accent text-white text-sm hover:opacity-90"
                >
                    <Eye size={16} />
                    {t("videoTile.watchStream")}
                </button>
            {/if}
        </div>
    {:else}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
            class="w-full h-full {fit} {mirror ? 'scale-x-[-1]' : ''}"
            autoplay
            playsinline
            muted={tile.isLocal}
            use:videoTrack={tile.track as Track}
        ></video>
    {/if}
    {#if isShare && !tile.unwatched && showWatchers}
        <!-- Top end, clear of the tile's own buttons (they sit at the bottom
             end). The stack collapses to avatars and "+N" in small tiles. -->
        <div class="absolute top-1 end-1 z-10 max-w-[calc(100%-0.5rem)]">
            <WatcherStack {viewers} max={compact ? 3 : 5} />
        </div>
    {/if}
    {#if !compact && !tile.unwatched}
        <div class="absolute bottom-2 start-2 max-w-[calc(100%-1rem)]">
            <TileLabel userId={tile.userId} {label} />
        </div>
        <div class="absolute bottom-2 end-2 flex gap-1">
            {#if shareSound}
                <button
                    onclick={toggleShareSound}
                    class="p-1.5 rounded bg-black/60 text-white opacity-70 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    title={shareMuted
                        ? t("videoTile.unmuteShareAudio")
                        : t("videoTile.muteShareAudio")}
                    aria-label={shareMuted
                        ? t("videoTile.unmuteShareAudio")
                        : t("videoTile.muteShareAudio")}
                >
                    {#if shareMuted}<VolumeX size={16} />{:else}<Volume2
                            size={16}
                        />{/if}
                </button>
            {/if}
            {#if canLeave}
                <button
                    onclick={leave}
                    class="p-1.5 rounded bg-black/60 text-white opacity-70 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    title={t("videoTile.stopWatching")}
                    aria-label={t("videoTile.stopWatching")}
                >
                    <EyeOff size={16} />
                </button>
            {/if}
            {#if pipSupported}
                <button
                    onclick={togglePip}
                    class="p-1.5 rounded bg-black/60 opacity-70 hover:opacity-100 focus-visible:opacity-100 transition-opacity {inPip
                        ? 'text-zam-accent'
                        : 'text-white'}"
                    title={inPip
                        ? t("videoTile.exitPictureInPicture")
                        : t("videoTile.pictureInPicture")}
                    aria-label={inPip
                        ? t("videoTile.exitPictureInPicture")
                        : t("videoTile.pictureInPicture")}
                >
                    <PictureInPicture2 size={16} />
                </button>
            {/if}
            <button
                onclick={toggleFullscreen}
                class="p-1.5 rounded bg-black/60 text-white opacity-70 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                title={t("videoTile.fullscreen")}
                aria-label={t("videoTile.fullscreen")}
            >
                <Maximize2 size={16} />
            </button>
        </div>
    {/if}
</div>

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
    import {
        getMemberName,
        getRoom,
        participantHasShareAudio,
    } from "$lib/matrix/client";

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
    const viewersLabel = $derived(
        t("videoTile.watchingCount", { count: viewers.length }),
    );
    function viewerName(userId: string): string {
        const room = voiceCallState.roomId
            ? getRoom(voiceCallState.roomId)
            : null;
        return room ? getMemberName(room, userId) : userId;
    }

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
    {#if isShare && !tile.unwatched}
        <div class="group/viewers absolute top-1 end-1 z-10">
            <span
                role="img"
                class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs"
                aria-label={viewersLabel}
            >
                <Eye size={12} />
                <span class="tabular-nums">{viewers.length}</span>
            </span>
            <div
                class="hidden group-hover/viewers:block absolute top-full end-0 mt-1 min-w-[10rem] max-w-[14rem] rounded bg-black/85 p-2 text-xs text-white shadow-lg"
            >
                <div class="font-semibold mb-1">{t("videoTile.watchers")}</div>
                {#if viewers.length === 0}
                    <div class="text-zam-textMuted">
                        {t("videoTile.noWatchers")}
                    </div>
                {:else}
                    {#each viewers as userId (userId)}
                        <div class="truncate">{viewerName(userId)}</div>
                    {/each}
                {/if}
            </div>
        </div>
    {/if}
    {#if !compact && !tile.unwatched}
        <div
            class="absolute bottom-2 start-2 px-2 py-0.5 rounded bg-black/60 max-w-[calc(100%-1rem)]"
        >
            <span class="text-xs text-white truncate">{label}</span>
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

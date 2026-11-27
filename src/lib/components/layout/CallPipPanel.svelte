<script lang="ts">
    // One picture-in-picture panel, drawn both in the Zam window (the floating
    // video, mode "inline") and in the pop-out window (mode "window", mounted
    // into that window's document by stores/callPip.svelte.ts). Both read the
    // same stores, so they can't drift apart; the pop-out adds the call
    // controls.
    import { t } from "$lib/i18n";
    import type { Track } from "livekit-client";
    import {
        Headphones,
        HeadphoneOff,
        Maximize2,
        Mic,
        MicOff,
        Minimize,
        Minimize2,
        PhoneOff,
        PictureInPicture2,
        Video,
        VideoOff,
        X,
    } from "lucide-svelte";
    import VideoTile from "$lib/components/layout/VideoTile.svelte";
    import TileLabel from "$lib/components/layout/TileLabel.svelte";
    import WatcherStack from "$lib/components/layout/WatcherStack.svelte";
    import { getMemberName, getRoom } from "$lib/matrix/client";
    import {
        voiceCallState,
        leaveCall,
        toggleCallDeafen,
        toggleCallMute,
        toggleCamera,
    } from "$lib/stores/voiceCall.svelte";
    import { callPipState } from "$lib/stores/callPip.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { settingsState } from "$lib/stores/settings.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { pickPipTile } from "$lib/utils/videoTiles";
    import { shareViewers } from "$lib/utils/shareWatchers";
    import {
        createPipHud,
        PIP_ACTIVITY_EVENT,
        PIP_TOGGLE_FULLSCREEN_EVENT,
    } from "$lib/utils/pipHud";

    interface Props {
        mode: "inline" | "window";
        /** Inline only: send the video to a pop-out window, when there is one. */
        onPopOut?: () => void;
        /** Inline only: hide the floating video until the call ends. */
        onHide?: () => void;
        /** Window only: bring the video back into the Zam window. */
        onReturn?: () => void;
        /** Window only: close the pop-out. */
        onClose?: () => void;
    }
    let { mode, onPopOut, onHide, onReturn, onClose }: Props = $props();

    // Plain let: pickPipTile only wants last time's answer, and $state here
    // would make the derived depend on what it writes.
    let lastKey: string | null = null;
    const tile = $derived.by(() => {
        void voiceCallState.voiceTick;
        const picked = pickPipTile(voiceCallState.videoTiles, {
            pinned: callPipState.pinnedKey,
            focused: voiceCallState.focusedTileKey,
            current: lastKey,
            speakingUserIds: voiceCallState.speakingUserIds,
        });
        lastKey = picked?.key ?? null;
        return picked;
    });

    const label = $derived.by(() => {
        void roomsState.roomsTick;
        if (!tile) return "";
        const room = voiceCallState.roomId && getRoom(voiceCallState.roomId);
        if (tile.userId === auth.userId)
            return tile.source === "screenshare"
                ? t("callView.yourScreen")
                : t("callView.you");
        const name = room ? getMemberName(room, tile.userId) : tile.userId;
        return tile.source === "screenshare"
            ? t("callView.sScreen", { name })
            : name;
    });

    const isShare = $derived(tile?.source === "screenshare" && !tile.unwatched);
    const viewers = $derived(
        tile ? shareViewers(voiceCallState.shareWatchers, tile.identity) : [],
    );

    // Window mode only. The controls hide after a spell with no input in this
    // window and come back on the next (utils/pipHud.ts). Everything runs on
    // the pop-out's own window: its listeners and its timers. Input over the
    // drag region never reaches the page, so the main process reports the
    // cursor too (PIP_ACTIVITY_EVENT).
    let root: HTMLDivElement | null = $state(null);
    let hudShown = $state(true);
    let fullscreen = $state(false);

    $effect(() => {
        if (mode !== "window" || !root) return;
        const doc = root.ownerDocument;
        const win = doc.defaultView;
        if (!win) return;
        const hud = createPipHud(
            {
                setTimeout: (fn, ms) => win.setTimeout(fn, ms),
                clearTimeout: (handle) => win.clearTimeout(handle as number),
            },
            (shown) => (hudShown = shown),
        );
        const onActivity = () => hud.activity();
        const onKeydown = (e: KeyboardEvent) => {
            hud.activity();
            // Chromium also leaves element fullscreen on Escape; this makes it
            // certain whatever has focus in the window.
            if (e.key === "Escape" && doc.fullscreenElement)
                void doc.exitFullscreen().catch(() => {});
        };
        const onFullscreenChange = () => {
            fullscreen = !!doc.fullscreenElement;
        };
        // A double-click on the drag region arrives as this event (main.cjs
        // turns the maximise into it). It is a user gesture, so fullscreen is
        // allowed here.
        const onToggleFullscreen = () => toggleFullscreen();
        // In fullscreen Chromium drops the drag region, so the double-click
        // reaches the page as a plain dblclick instead of the maximise above.
        // Only then; double-clicks on the controls stay theirs.
        const onDblClick = (e: MouseEvent) => {
            if (!doc.fullscreenElement) return;
            const target = e.target as Element | null;
            if (target?.closest?.("button, input, select, a")) return;
            toggleFullscreen();
        };
        const listeners: Array<[string, EventListener]> = [
            ["dblclick", onDblClick as EventListener],
            ["pointermove", onActivity],
            ["pointerdown", onActivity],
            ["focusin", onActivity],
            [PIP_ACTIVITY_EVENT, onActivity],
            [PIP_TOGGLE_FULLSCREEN_EVENT, onToggleFullscreen],
            ["keydown", onKeydown as EventListener],
        ];
        for (const [type, fn] of listeners) win.addEventListener(type, fn);
        doc.addEventListener("fullscreenchange", onFullscreenChange);
        fullscreen = !!doc.fullscreenElement;
        return () => {
            for (const [type, fn] of listeners)
                win.removeEventListener(type, fn);
            doc.removeEventListener("fullscreenchange", onFullscreenChange);
            hud.dispose();
            hudShown = true;
            fullscreen = false;
        };
    });

    /** The whole panel (video, label and controls) fullscreen in this window. */
    function toggleFullscreen(): void {
        if (!root) return;
        const doc = root.ownerDocument;
        if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => {});
        else void root.requestFullscreen().catch(() => {});
    }

    const CONTROL =
        "p-1.5 rounded bg-black/60 text-white opacity-70 hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
    const ROUND =
        "flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
    const ROUND_ALERT = "bg-red-600/90 hover:bg-red-600";

    function stop(fn: () => void): (e: Event) => void {
        return (e) => {
            e.stopPropagation();
            fn();
        };
    }
</script>

{#if tile}
    <div
        bind:this={root}
        class="relative w-full h-full bg-black {mode === 'window'
            ? 'pip-root'
            : ''}"
        data-testid="call-pip-panel"
        data-hud={mode === "window" ? (hudShown ? "shown" : "idle") : undefined}
    >
        <VideoTile
            {tile}
            {label}
            compact
            showWatchers={false}
            mirror={tile.source === "camera" &&
                tile.isLocal &&
                settingsState.mirrorCamera}
        />

        <!-- Top bar: the name on the left, the window's buttons on the right.
             A flex row, so the two never overlap at any size. -->
        <div
            class="absolute top-1.5 inset-x-1.5 z-20 flex items-start justify-between gap-1 {mode ===
            'window'
                ? 'pip-chrome'
                : ''}"
        >
            <div class="min-w-0 flex-1">
                <TileLabel userId={tile.userId} {label} />
            </div>
            <div class="flex shrink-0 gap-1">
                {#if mode === "inline"}
                    {#if onPopOut}
                        <button
                            type="button"
                            class={CONTROL}
                            title={t("videoTile.pictureInPicture")}
                            aria-label={t("videoTile.pictureInPicture")}
                            onpointerdown={(e) => e.stopPropagation()}
                            onclick={stop(() => onPopOut?.())}
                        >
                            <PictureInPicture2 size={14} />
                        </button>
                    {/if}
                    {#if onHide}
                        <button
                            type="button"
                            class={CONTROL}
                            title={t("callParticipantMenu.hideVideo")}
                            aria-label={t("callParticipantMenu.hideVideo")}
                            onpointerdown={(e) => e.stopPropagation()}
                            onclick={stop(() => onHide?.())}
                        >
                            <X size={14} />
                        </button>
                    {/if}
                {:else}
                    <button
                        type="button"
                        class={CONTROL}
                        title={fullscreen
                            ? t("videoTile.exitFullscreen")
                            : t("videoTile.fullscreen")}
                        aria-label={fullscreen
                            ? t("videoTile.exitFullscreen")
                            : t("videoTile.fullscreen")}
                        onclick={toggleFullscreen}
                    >
                        {#if fullscreen}<Minimize size={14} />{:else}<Maximize2
                                size={14}
                            />{/if}
                    </button>
                    <button
                        type="button"
                        class={CONTROL}
                        title={t("videoTile.exitPictureInPicture")}
                        aria-label={t("videoTile.exitPictureInPicture")}
                        onclick={() => onReturn?.()}
                    >
                        <Minimize2 size={14} />
                    </button>
                    <button
                        type="button"
                        class={CONTROL}
                        title={t("common.close")}
                        aria-label={t("common.close")}
                        onclick={() => onClose?.()}
                    >
                        <X size={14} />
                    </button>
                {/if}
            </div>
        </div>

        <!-- Bottom bar: who is watching a share on the left, the call's
             controls on the right (pop-out window only). -->
        <div
            class="absolute bottom-1.5 inset-x-1.5 z-20 flex items-end justify-between gap-1 {mode ===
            'window'
                ? 'pip-chrome'
                : ''}"
        >
            <div class="min-w-0">
                {#if isShare}
                    <WatcherStack {viewers} max={3} />
                {/if}
            </div>
            {#if mode === "window"}
                <div class="flex shrink-0 gap-1.5">
                    <button
                        type="button"
                        class="{ROUND} {voiceCallState.micMuted
                            ? ROUND_ALERT
                            : ''}"
                        title={voiceCallState.micMuted
                            ? t("callView.unmute")
                            : t("common.mute")}
                        aria-label={voiceCallState.micMuted
                            ? t("callView.unmute")
                            : t("common.mute")}
                        onclick={() => toggleCallMute()}
                    >
                        {#if voiceCallState.micMuted}<MicOff
                                size={18}
                            />{:else}<Mic size={18} />{/if}
                    </button>
                    <button
                        type="button"
                        class="{ROUND} {voiceCallState.deafened
                            ? ROUND_ALERT
                            : ''}"
                        title={voiceCallState.deafened
                            ? t("callView.undeafen")
                            : t("callView.deafen")}
                        aria-label={voiceCallState.deafened
                            ? t("callView.undeafen")
                            : t("callView.deafen")}
                        onclick={() => toggleCallDeafen()}
                    >
                        {#if voiceCallState.deafened}<HeadphoneOff
                                size={18}
                            />{:else}<Headphones size={18} />{/if}
                    </button>
                    {#if !settingsState.cameraDisabled}
                        <button
                            type="button"
                            class={ROUND}
                            title={voiceCallState.cameraOn
                                ? t("common.turnOffCamera")
                                : t("common.turnOnCamera")}
                            aria-label={voiceCallState.cameraOn
                                ? t("common.turnOffCamera")
                                : t("common.turnOnCamera")}
                            onclick={() => void toggleCamera()}
                        >
                            {#if voiceCallState.cameraOn}<Video
                                    size={18}
                                />{:else}<VideoOff size={18} />{/if}
                        </button>
                    {/if}
                    <button
                        type="button"
                        class="{ROUND} {ROUND_ALERT}"
                        title={t("callView.disconnect")}
                        aria-label={t("callView.disconnect")}
                        onclick={() => leaveCall()}
                    >
                        <PhoneOff size={18} />
                    </button>
                </div>
            {/if}
        </div>
    </div>
{/if}

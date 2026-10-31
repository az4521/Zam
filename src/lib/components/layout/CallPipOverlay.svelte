<script lang="ts">
    import { t } from "$lib/i18n";
    import type { Track } from "livekit-client";
    import { scale } from "svelte/transition";
    import { PictureInPicture2, X } from "lucide-svelte";
    import VideoTile from "$lib/components/layout/VideoTile.svelte";
    import { getMemberName, getRoom } from "$lib/matrix/client";
    import {
        voiceCallState,
        isCallViewShowing,
        leaveCall,
        toggleCallMute,
        toggleCamera,
    } from "$lib/stores/voiceCall.svelte";
    import {
        callPipState,
        pipWindowSupported,
        openPipWindow,
        showPipTrack,
        closePipWindow,
        bindPipCallActions,
        reportPipCallState,
        setPipPlacement,
    } from "$lib/stores/callPip.svelte";
    import { interfaceState, showCallView } from "$lib/stores/interface.svelte";
    import { navigateToRoom, roomsState } from "$lib/stores/rooms.svelte";
    import { settingsState } from "$lib/stores/settings.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { motionOK } from "$lib/utils/motionPreference";
    import { pickPipTile, snapPipToEdge } from "$lib/utils/videoTiles";

    const DRAG_THRESHOLD_PX = 5;
    const EDGE_GAP_PX = 8;
    // How far a resting video keeps from the window's sides: clear of the room
    // header above and the composer below.
    const REST_SIDE_REM = 1;
    const REST_TOP_REM = 3.5;
    const REST_BOTTOM_REM = 5.5;

    const windowSupported = pipWindowSupported();

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

    const visible = $derived(
        tile !== null &&
            !isCallViewShowing() &&
            !callPipState.windowOpen &&
            !callPipState.dismissed,
    );

    const label = $derived.by(() => {
        void roomsState.roomsTick;
        if (!tile) return "";
        const room = voiceCallState.roomId && getRoom(voiceCallState.roomId);
        const name =
            tile.userId === auth.userId
                ? t("callView.you")
                : room
                  ? getMemberName(room, tile.userId)
                  : tile.userId;
        return tile.source === "screenshare"
            ? t("callView.sScreen", { name })
            : name;
    });

    // The system window follows the same pick, and ends with the last stream.
    $effect(() => {
        if (!callPipState.windowOpen) return;
        if (tile) showPipTrack(tile.track as Track);
        else closePipWindow();
    });
    $effect(() => {
        if (!callPipState.windowOpen) return;
        return bindPipCallActions({
            toggleMic: toggleCallMute,
            toggleCamera: () => void toggleCamera(),
            hangUp: leaveCall,
        });
    });
    $effect(() => {
        if (!callPipState.windowOpen) return;
        reportPipCallState(!voiceCallState.micMuted, voiceCallState.cameraOn);
    });

    function openCall(): void {
        const roomId = voiceCallState.roomId;
        if (!roomId) return;
        navigateToRoom(roomId);
        showCallView(roomId);
    }

    // A press on the video is a click until it moves; then it's a drag, and
    // letting go settles against the nearest side.
    let dragPos = $state<{ x: number; y: number } | null>(null);
    let press: {
        x: number;
        y: number;
        left: number;
        top: number;
        width: number;
        height: number;
    } | null = null;
    let dragged = false;

    function onPointerDown(e: PointerEvent): void {
        if (e.button !== 0) return;
        const el = e.currentTarget as HTMLElement;
        const r = el.getBoundingClientRect();
        press = {
            x: e.clientX,
            y: e.clientY,
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
        };
        dragged = false;
        el.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: PointerEvent): void {
        if (!press) return;
        const dx = e.clientX - press.x;
        const dy = e.clientY - press.y;
        if (!dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        dragged = true;
        const maxX = window.innerWidth - press.width - EDGE_GAP_PX;
        const maxY = window.innerHeight - press.height - EDGE_GAP_PX;
        dragPos = {
            x: Math.min(Math.max(press.left + dx, EDGE_GAP_PX), maxX),
            y: Math.min(Math.max(press.top + dy, EDGE_GAP_PX), maxY),
        };
    }
    function onPointerUp(): void {
        if (press && dragPos) {
            const rem = parseFloat(
                getComputedStyle(document.documentElement).fontSize,
            );
            setPipPlacement(
                snapPipToEdge(dragPos.x, dragPos.y, {
                    minX: REST_SIDE_REM * rem,
                    maxX: window.innerWidth - press.width - REST_SIDE_REM * rem,
                    minY: REST_TOP_REM * rem,
                    maxY:
                        window.innerHeight -
                        press.height -
                        REST_BOTTOM_REM * rem,
                }),
            );
        }
        press = null;
        dragPos = null;
    }
    function onClick(): void {
        if (!dragged) openCall();
        dragged = false;
    }

    // Physical sides: the panels are pinned left-to-right in every language,
    // and this spot is picked by dragging, not by reading direction. In CSS
    // rather than measured so it follows window resizes and the safe areas.
    const widthRem = $derived(interfaceState.isMobile ? 11 : 18);
    const restStyle = $derived.by(() => {
        const { side, at } = callPipState.placement;
        const minLeft = `${REST_SIDE_REM}rem`;
        const maxLeft = `calc(100% - ${widthRem + REST_SIDE_REM}rem)`;
        const minTop = `calc(${REST_TOP_REM}rem + env(safe-area-inset-top, 0px))`;
        const maxTop = `calc(100% - ${(widthRem * 9) / 16 + REST_BOTTOM_REM}rem - env(safe-area-inset-bottom, 0px))`;
        const along = (min: string, max: string) =>
            `calc(${min} + (${max} - ${min}) * ${at})`;
        const left =
            side === "left"
                ? minLeft
                : side === "right"
                  ? maxLeft
                  : along(minLeft, maxLeft);
        const top =
            side === "top"
                ? minTop
                : side === "bottom"
                  ? maxTop
                  : along(minTop, maxTop);
        return `left:${left};top:${top}`;
    });
    const OVERLAY_CONTROL =
        "p-1.5 rounded bg-black/60 text-white opacity-70 hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
</script>

{#if visible && tile}
    <!-- The wrapper owns the pointer (click to open, drag to move); the
         keyboard path is the stretched button, as on CallView's tiles. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="fixed z-40 aspect-video max-w-[calc(100vw-2rem)] rounded-lg overflow-hidden bg-black shadow-2xl border border-discord-divider touch-none select-none {dragPos
            ? 'cursor-grabbing'
            : 'cursor-pointer'} {!dragPos && motionOK()
            ? 'transition-[left,top] duration-150 ease-out'
            : ''}"
        style="width:{widthRem}rem;{dragPos
            ? `left:${dragPos.x}px;top:${dragPos.y}px`
            : restStyle}"
        title={t("voiceCallPanel.openCallView")}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
        onclick={onClick}
        data-testid="call-pip"
        transition:scale={{
            duration: motionOK() ? 140 : 0,
            start: 0.85,
            opacity: 0,
        }}
    >
        <VideoTile
            {tile}
            {label}
            compact
            mirror={tile.source === "camera" &&
                tile.isLocal &&
                settingsState.mirrorCamera}
        />
        <button
            type="button"
            class="absolute inset-0 z-10 pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white focus-visible:bg-black/40"
            aria-label={t("voiceCallPanel.openCallView")}
            onclick={(e) => {
                e.stopPropagation();
                openCall();
            }}
        ></button>
        <div
            class="absolute bottom-1.5 start-1.5 px-1.5 py-0.5 rounded bg-black/60 max-w-[calc(100%-0.75rem)]"
        >
            <span class="block text-xs text-white truncate">{label}</span>
        </div>
        <div class="absolute top-1.5 end-1.5 z-20 flex gap-1">
            {#if windowSupported}
                <button
                    type="button"
                    class={OVERLAY_CONTROL}
                    title={t("videoTile.pictureInPicture")}
                    aria-label={t("videoTile.pictureInPicture")}
                    onpointerdown={(e) => e.stopPropagation()}
                    onclick={(e) => {
                        e.stopPropagation();
                        void openPipWindow(null, tile.track as Track);
                    }}
                >
                    <PictureInPicture2 size={14} />
                </button>
            {/if}
            <button
                type="button"
                class={OVERLAY_CONTROL}
                title={t("callParticipantMenu.hideVideo")}
                aria-label={t("callParticipantMenu.hideVideo")}
                onpointerdown={(e) => e.stopPropagation()}
                onclick={(e) => {
                    e.stopPropagation();
                    callPipState.dismissed = true;
                }}
            >
                <X size={14} />
            </button>
        </div>
    </div>
{/if}

<script lang="ts">
    import { t } from "$lib/i18n";
    import type { Track } from "livekit-client";
    import { scale } from "svelte/transition";
    import CallPipPanel from "$lib/components/layout/CallPipPanel.svelte";
    import {
        voiceCallState,
        isCallViewShowing,
        leaveCall,
        toggleCallMute,
        toggleCamera,
    } from "$lib/stores/voiceCall.svelte";
    import {
        callPipState,
        openPipWindow,
        detachPipWindow,
        endPipFollow,
        closePipWindow,
        bindPipCallActions,
        reportPipCallState,
        setPipPlacement,
        pipDetachSupported,
        pipWindowSupported,
        showPipTrack,
    } from "$lib/stores/callPip.svelte";
    import { interfaceState, showCallView } from "$lib/stores/interface.svelte";
    import { navigateToRoom } from "$lib/stores/rooms.svelte";
    import { settingsState } from "$lib/stores/settings.svelte";
    import { motionOK } from "$lib/utils/motionPreference";
    import { pickPipTile, snapPipToEdge } from "$lib/utils/videoTiles";
    import {
        REST_BOTTOM_REM,
        REST_SIDE_REM,
        REST_TOP_REM,
        leftViewport,
        pipSizeFor,
        restBounds,
    } from "$lib/utils/pipGeometry";

    const DRAG_THRESHOLD_PX = 5;
    const EDGE_GAP_PX = 8;

    // Drag-out is desktop-only. The pop-out button opens the desktop window
    // there, and the browser's own picture-in-picture window on the web.
    const detachSupported = pipDetachSupported();
    const windowSupported = pipWindowSupported();

    function rootRem(): number {
        return parseFloat(getComputedStyle(document.documentElement).fontSize);
    }

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

    // While a desktop pop-out is carried by the cursor, the built-in video
    // stays mounted (the drag's pointer capture lives on it) but is hidden.
    let detaching = $state(false);

    const visible = $derived(
        tile !== null &&
            !isCallViewShowing() &&
            (!callPipState.windowOpen || detaching) &&
            !callPipState.dismissed,
    );

    // The window ends with the last stream. The desktop pop-out shows its own
    // pick (CallPipPanel); the browser's window (showPipTrack) follows this one.
    $effect(() => {
        if (!callPipState.windowOpen) return;
        if (tile) showPipTrack(tile.track as Track);
        else closePipWindow();
    });
    // The OS media controls drive the call while the pop-out is open.
    $effect(() => {
        if (!callPipState.windowOpen) return;
        return bindPipCallActions({
            toggleMic: toggleCallMute,
            toggleCamera: settingsState.cameraDisabled
                ? null
                : () => void toggleCamera(),
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

    function popOut(): void {
        if (!tile) return;
        void openPipWindow(
            null,
            tile.track as Track,
            pipSizeFor(interfaceState.isMobile, rootRem()),
        );
    }

    // A press on the video is a click until it moves; then it's a drag, and
    // letting go settles against the nearest side. A drag that leaves the
    // Zam window becomes a pop-out (see startDetach).
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

    function startDetach(): void {
        const p = press;
        if (!p) return;
        const size = pipSizeFor(interfaceState.isMobile, rootRem());
        const grab = { x: p.x - p.left, y: p.y - p.top };
        // The pop-out follows the cursor until the button is released
        // (onPointerUp).
        if (detachPipWindow(tile?.key ?? null, size, grab)) detaching = true;
    }

    function onPointerMove(e: PointerEvent): void {
        if (!press || detaching) return;
        const dx = e.clientX - press.x;
        const dy = e.clientY - press.y;
        if (!dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        dragged = true;
        if (
            detachSupported &&
            !callPipState.windowOpen &&
            leftViewport(
                e.clientX,
                e.clientY,
                window.innerWidth,
                window.innerHeight,
            )
        ) {
            startDetach();
            return;
        }
        const maxX = window.innerWidth - press.width - EDGE_GAP_PX;
        const maxY = window.innerHeight - press.height - EDGE_GAP_PX;
        dragPos = {
            x: Math.min(Math.max(press.left + dx, EDGE_GAP_PX), maxX),
            y: Math.min(Math.max(press.top + dy, EDGE_GAP_PX), maxY),
        };
    }

    function onPointerUp(): void {
        if (detaching) {
            detaching = false;
            endPipFollow();
            press = null;
            dragPos = null;
            return;
        }
        if (press && dragPos) {
            const bounds = restBounds(
                window.innerWidth,
                window.innerHeight,
                press.width,
                press.height,
                rootRem(),
            );
            setPipPlacement(snapPipToEdge(dragPos.x, dragPos.y, bounds));
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
</script>

{#if visible && tile}
    <!-- The wrapper owns the pointer (click to open, drag to move); the
         keyboard path is the stretched button, as on CallView's tiles. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="fixed z-40 aspect-video max-w-[calc(100vw-2rem)] rounded-lg overflow-hidden bg-black shadow-2xl border border-zam-divider touch-none select-none {dragPos
            ? 'cursor-grabbing'
            : 'cursor-pointer'} {!dragPos && motionOK()
            ? 'transition-[left,top] duration-150 ease-out'
            : ''}"
        style="width:{widthRem}rem;{dragPos
            ? `left:${dragPos.x}px;top:${dragPos.y}px`
            : restStyle}{detaching ? ';opacity:0' : ''}"
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
        <CallPipPanel
            mode="inline"
            onPopOut={windowSupported ? popOut : undefined}
            onHide={() => (callPipState.dismissed = true)}
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
    </div>
{/if}

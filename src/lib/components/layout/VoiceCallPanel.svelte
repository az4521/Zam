<script lang="ts">
    import { t } from "$lib/i18n";
    import {
        Mic,
        MicOff,
        Headphones,
        HeadphoneOff,
        PhoneOff,
        Video,
        VideoOff,
        MonitorUp,
        Signal,
        Maximize2,
        Settings2,
    } from "lucide-svelte";
    import {
        voiceCallState,
        leaveCall,
        toggleCallMute,
        toggleCallDeafen,
        toggleCamera,
        toggleScreenShare,
    } from "$lib/stores/voiceCall.svelte";
    import { connStateLabel } from "$lib/utils/voiceCall";
    import { screenShareSupportedHere } from "$lib/utils/videoTiles";
    import { formatCallDuration } from "$lib/utils/callDuration";
    import { showCallView, interfaceState } from "$lib/stores/interface.svelte";
    import {
        getRoom,
        getRoomDisplayName,
        getParentSpaceIds,
        resumeVoicePlayback,
    } from "$lib/matrix/client";
    import { navigateToRoom, roomsState } from "$lib/stores/rooms.svelte";
    import ScreenShareQualityPopover from "./ScreenShareQualityPopover.svelte";
    import SoundboardButton from "./SoundboardButton.svelte";
    import CallEncryptionBadge from "./CallEncryptionBadge.svelte";
    import CallStatsPanel from "./CallStatsPanel.svelte";

    // Fixed for the session, same as CallView — hides share where unsupported.
    const screenShareSupported = screenShareSupportedHere();

    // Ticks only while the panel is on screen; the anchor itself lives in the
    // store so a reconnect doesn't restart the clock.
    let now = $state(Date.now());
    $effect(() => {
        if (voiceCallState.connectedAt === null) return;
        const id = setInterval(() => (now = Date.now()), 1000);
        return () => clearInterval(id);
    });
    const elapsed = $derived(
        voiceCallState.connectedAt === null
            ? null
            : formatCallDuration(now - voiceCallState.connectedAt),
    );

    const locationLabel = $derived.by(() => {
        void voiceCallState.voiceTick;
        void roomsState.roomsTick;
        if (!voiceCallState.roomId) return "";
        const room = getRoom(voiceCallState.roomId);
        if (!room) return "";
        const name = getRoomDisplayName(room);
        const parentId = getParentSpaceIds(voiceCallState.roomId)[0];
        const parent = parentId ? getRoom(parentId) : null;
        return parent ? `${name} / ${getRoomDisplayName(parent)}` : name;
    });

    const callViewShowing = $derived(
        !!voiceCallState.roomId &&
            interfaceState.callViewRoomId === voiceCallState.roomId &&
            roomsState.activeRoomId === voiceCallState.roomId &&
            !roomsState.showInbox,
    );

    // The call can live in a room outside the selected space, so switch space +
    // active room (navigateToRoom) before flipping to the call view — the shell
    // only renders CallView when callViewRoomId matches the active room.
    function openCallView(): void {
        const roomId = voiceCallState.roomId;
        if (!roomId) return;
        navigateToRoom(roomId);
        showCallView(roomId);
    }

    // Sharing starts straight away (the picker asks what to share; quality is
    // changed live from the "Sharing your screen" row below).
    let sharePopover = $state<{ x: number; y: number } | null>(null);
    function openShareQuality(e: MouseEvent): void {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        sharePopover = { x: r.left, y: r.top };
    }
    // A share ended from the browser's own "Stop sharing" bar must not
    // strand the quality popover.
    $effect(() => {
        if (!voiceCallState.screenSharing) sharePopover = null;
    });

    const soundboardRoom = $derived.by(() => {
        void roomsState.roomsTick;
        return voiceCallState.roomId ? getRoom(voiceCallState.roomId) : null;
    });

    let statsOpen = $state(false);
</script>

{#if voiceCallState.roomId}
    <div
        class="px-2 py-2 border-t border-discord-divider bg-discord-backgroundSecondary"
    >
        {#if voiceCallState.playbackBlocked}
            <button
                onclick={() => void resumeVoicePlayback()}
                class="w-full mb-1.5 px-2 py-1.5 rounded bg-discord-warning text-black text-xs font-semibold"
            >
                {t("voiceCallPanel.enableAudio")}
            </button>
        {/if}
        <div class="flex items-start gap-1">
            <button
                class="block flex-1 min-w-0 text-start"
                onclick={openCallView}
                title={t("voiceCallPanel.openCallView")}
            >
                <!-- spans, not <p>: a button may only contain phrasing content. -->
                <span
                    class="block text-xs font-semibold {voiceCallState.connState ===
                    'connected'
                        ? 'text-discord-accent'
                        : 'text-discord-warning'}"
                >
                    {connStateLabel(voiceCallState.connState)}
                    {#if voiceCallState.roomId}
                        <CallEncryptionBadge
                            roomId={voiceCallState.roomId}
                            inline
                        />
                    {/if}
                    {#if elapsed}
                        <span class="ms-1 font-normal text-discord-textMuted"
                            >{elapsed}</span
                        >
                    {/if}
                </span>
                <span class="block text-xs text-discord-textMuted truncate">
                    {locationLabel}
                </span>
            </button>
            <button
                onclick={() => (statsOpen = true)}
                class="p-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover flex-shrink-0"
                title={t("voiceCallPanel.connectionStats")}
                aria-label={t("voiceCallPanel.connectionStats")}
            >
                <Signal size={16} />
            </button>
        </div>
        <!-- The full call view (video grid, screen shares) used to open only
             from the status text above, which nobody found. -->
        {#if !callViewShowing}
            <button
                onclick={openCallView}
                class="mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded bg-discord-backgroundTertiary hover:bg-discord-messageHover text-xs font-medium text-discord-textPrimary"
            >
                <Maximize2 size={14} />
                {voiceCallState.videoTiles.some((t) => !t.isLocal)
                    ? t("voiceCallPanel.openCallWithVideo", {
                          n: voiceCallState.videoTiles.filter((t) => !t.isLocal)
                              .length,
                      })
                    : t("voiceCallPanel.openCall")}
            </button>
        {/if}
        {#if voiceCallState.screenSharing}
            <div
                class="mt-1.5 flex items-center gap-1 px-2 py-1 rounded bg-discord-accent/15 text-xs"
                role="status"
            >
                <MonitorUp
                    size={14}
                    class="text-discord-accent flex-shrink-0"
                />
                <span class="flex-1 min-w-0 truncate text-discord-textPrimary"
                    >{t("voiceCallPanel.sharingYourScreen")}</span
                >
                <button
                    onclick={openShareQuality}
                    class="p-0.5 rounded text-discord-textMuted hover:text-discord-textPrimary"
                    title={t("voiceCallPanel.shareQuality")}
                    aria-label={t("voiceCallPanel.shareQuality")}
                >
                    <Settings2 size={14} />
                </button>
                <button
                    onclick={() => void toggleScreenShare()}
                    class="px-1.5 py-0.5 rounded bg-discord-danger hover:bg-discord-dangerHover text-white font-medium"
                    >{t("voiceCallPanel.stop")}</button
                >
            </div>
        {/if}
        <!-- Own row, not beside the status text: five 32px controls plus gaps
             leave ~60px of a 240px sidebar, which truncates "Connected" to an
             ellipsis. Discord splits the same way. -->
        <div class="mt-1.5 flex items-center gap-1">
            <button
                onclick={toggleCallMute}
                class="p-1.5 rounded hover:bg-discord-messageHover {voiceCallState.micMuted
                    ? 'text-discord-danger'
                    : 'text-discord-textMuted hover:text-discord-textPrimary'}"
                title={voiceCallState.micMuted
                    ? t("voiceCallPanel.unmute")
                    : t("common.mute")}
                aria-label={voiceCallState.micMuted
                    ? t("voiceCallPanel.unmute")
                    : t("common.mute")}
            >
                {#if voiceCallState.micMuted}<MicOff size={20} />{:else}<Mic
                        size={20}
                    />{/if}
            </button>
            <button
                onclick={toggleCallDeafen}
                class="p-1.5 rounded hover:bg-discord-messageHover {voiceCallState.deafened
                    ? 'text-discord-danger'
                    : 'text-discord-textMuted hover:text-discord-textPrimary'}"
                title={voiceCallState.deafened
                    ? t("voiceCallPanel.undeafen")
                    : t("voiceCallPanel.deafen")}
                aria-label={voiceCallState.deafened
                    ? t("voiceCallPanel.undeafen")
                    : t("voiceCallPanel.deafen")}
            >
                {#if voiceCallState.deafened}<HeadphoneOff
                        size={20}
                    />{:else}<Headphones size={20} />{/if}
            </button>
            <button
                onclick={() => void toggleCamera()}
                class="p-1.5 rounded hover:bg-discord-messageHover {voiceCallState.cameraOn
                    ? 'text-discord-accent'
                    : 'text-discord-textMuted hover:text-discord-textPrimary'}"
                title={voiceCallState.cameraOn
                    ? t("common.turnOffCamera")
                    : t("common.turnOnCamera")}
                aria-label={voiceCallState.cameraOn
                    ? t("common.turnOffCamera")
                    : t("common.turnOnCamera")}
            >
                {#if voiceCallState.cameraOn}<Video size={20} />{:else}<VideoOff
                        size={20}
                    />{/if}
            </button>
            {#if screenShareSupported}
                <button
                    onclick={() => void toggleScreenShare()}
                    class="p-1.5 rounded hover:bg-discord-messageHover {voiceCallState.screenSharing
                        ? 'text-discord-accent'
                        : 'text-discord-textMuted hover:text-discord-textPrimary'}"
                    title={voiceCallState.screenSharing
                        ? t("common.stopSharing")
                        : t("common.shareYourScreen")}
                    aria-label={voiceCallState.screenSharing
                        ? t("common.stopSharing")
                        : t("common.shareYourScreen")}
                >
                    <MonitorUp size={20} />
                </button>
            {/if}
            {#if soundboardRoom}
                <SoundboardButton
                    room={soundboardRoom}
                    buttonClass="p-1.5 rounded hover:bg-discord-messageHover"
                    idleClass="text-discord-textMuted hover:text-discord-textPrimary"
                />
            {/if}
            <button
                onclick={leaveCall}
                class="ms-auto p-1.5 rounded hover:bg-discord-messageHover text-discord-danger"
                title={t("voiceCallPanel.disconnect")}
                aria-label={t("voiceCallPanel.disconnect")}
            >
                <PhoneOff size={20} />
            </button>
        </div>
    </div>
    {#if sharePopover}
        <ScreenShareQualityPopover
            x={sharePopover.x}
            y={sharePopover.y}
            touch={interfaceState.isTouchscreen}
            onClose={() => (sharePopover = null)}
        />
    {/if}
    {#if statsOpen}
        <CallStatsPanel onClose={() => (statsOpen = false)} />
    {/if}
{/if}

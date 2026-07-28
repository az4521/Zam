<script lang="ts">
    import {
        Mic,
        MicOff,
        Headphones,
        HeadphoneOff,
        PhoneOff,
        Video,
        VideoOff,
        MonitorUp,
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
    import { showCallView } from "$lib/stores/interface.svelte";
    import {
        getRoom,
        getRoomDisplayName,
        getParentSpaceIds,
        resumeVoicePlayback,
    } from "$lib/matrix/client";
    import { navigateToRoom, roomsState } from "$lib/stores/rooms.svelte";

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

    // The call can live in a room outside the selected space, so switch space +
    // active room (navigateToRoom) before flipping to the call view — the shell
    // only renders CallView when callViewRoomId matches the active room.
    function openCallView(): void {
        const roomId = voiceCallState.roomId;
        if (!roomId) return;
        navigateToRoom(roomId);
        showCallView(roomId);
    }
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
                Enable audio
            </button>
        {/if}
        <button
            class="block w-full min-w-0 text-left"
            onclick={openCallView}
            title="Open call view"
        >
            <!-- spans, not <p>: a button may only contain phrasing content. -->
            <span
                class="block text-xs font-semibold {voiceCallState.connState ===
                'connected'
                    ? 'text-discord-accent'
                    : 'text-discord-warning'}"
            >
                {connStateLabel(voiceCallState.connState)}
                {#if elapsed}
                    <span class="ml-1 font-normal text-discord-textMuted"
                        >{elapsed}</span
                    >
                {/if}
            </span>
            <span class="block text-xs text-discord-textMuted truncate">
                {locationLabel}
            </span>
        </button>
        <!-- Own row, not beside the status text: five 28px controls plus gaps
             leave ~60px of a 240px sidebar, which truncates "Connected" to an
             ellipsis. Discord splits the same way. -->
        <div class="mt-1.5 flex items-center gap-1">
            <button
                onclick={toggleCallMute}
                class="p-1.5 rounded hover:bg-discord-messageHover {voiceCallState.micMuted
                    ? 'text-discord-danger'
                    : 'text-discord-textMuted hover:text-discord-textPrimary'}"
                title={voiceCallState.micMuted ? "Unmute" : "Mute"}
                aria-label={voiceCallState.micMuted ? "Unmute" : "Mute"}
            >
                {#if voiceCallState.micMuted}<MicOff size={16} />{:else}<Mic
                        size={16}
                    />{/if}
            </button>
            <button
                onclick={toggleCallDeafen}
                class="p-1.5 rounded hover:bg-discord-messageHover {voiceCallState.deafened
                    ? 'text-discord-danger'
                    : 'text-discord-textMuted hover:text-discord-textPrimary'}"
                title={voiceCallState.deafened ? "Undeafen" : "Deafen"}
                aria-label={voiceCallState.deafened ? "Undeafen" : "Deafen"}
            >
                {#if voiceCallState.deafened}<HeadphoneOff
                        size={16}
                    />{:else}<Headphones size={16} />{/if}
            </button>
            <button
                onclick={() => void toggleCamera()}
                class="p-1.5 rounded hover:bg-discord-messageHover {voiceCallState.cameraOn
                    ? 'text-discord-accent'
                    : 'text-discord-textMuted hover:text-discord-textPrimary'}"
                title={voiceCallState.cameraOn
                    ? "Turn off camera"
                    : "Turn on camera"}
                aria-label={voiceCallState.cameraOn
                    ? "Turn off camera"
                    : "Turn on camera"}
            >
                {#if voiceCallState.cameraOn}<Video size={16} />{:else}<VideoOff
                        size={16}
                    />{/if}
            </button>
            {#if screenShareSupported}
                <button
                    onclick={() => void toggleScreenShare()}
                    class="p-1.5 rounded hover:bg-discord-messageHover {voiceCallState.screenSharing
                        ? 'text-discord-accent'
                        : 'text-discord-textMuted hover:text-discord-textPrimary'}"
                    title={voiceCallState.screenSharing
                        ? "Stop sharing"
                        : "Share your screen"}
                    aria-label={voiceCallState.screenSharing
                        ? "Stop sharing"
                        : "Share your screen"}
                >
                    <MonitorUp size={16} />
                </button>
            {/if}
            <button
                onclick={leaveCall}
                class="ml-auto p-1.5 rounded hover:bg-discord-messageHover text-discord-danger"
                title="Disconnect"
                aria-label="Disconnect"
            >
                <PhoneOff size={16} />
            </button>
        </div>
    </div>
{/if}

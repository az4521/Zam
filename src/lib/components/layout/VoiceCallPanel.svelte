<script lang="ts">
    import {
        Mic,
        MicOff,
        Headphones,
        HeadphoneOff,
        PhoneOff,
    } from "lucide-svelte";
    import {
        voiceCallState,
        leaveCall,
        toggleCallMute,
        toggleCallDeafen,
    } from "$lib/stores/voiceCall.svelte";
    import { connStateLabel } from "$lib/utils/voiceCall";
    import { formatCallDuration } from "$lib/utils/callDuration";
    import { showCallView } from "$lib/stores/interface.svelte";
    import {
        getRoom,
        getRoomDisplayName,
        getParentSpaceIds,
        resumeVoicePlayback,
    } from "$lib/matrix/client";
    import { navigateToRoom, roomsState } from "$lib/stores/rooms.svelte";

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
        <div class="flex items-center justify-between gap-2">
            <button
                class="min-w-0 text-left"
                onclick={openCallView}
                title="Open call view"
            >
                <p
                    class="text-xs font-semibold {voiceCallState.connState ===
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
                </p>
                <p class="text-xs text-discord-textMuted truncate">
                    {locationLabel}
                </p>
            </button>
            <div class="flex items-center gap-1 flex-shrink-0">
                <button
                    onclick={toggleCallMute}
                    class="p-1.5 rounded hover:bg-discord-messageHover {voiceCallState.micMuted
                        ? 'text-discord-danger'
                        : 'text-discord-textMuted hover:text-discord-textPrimary'}"
                    title={voiceCallState.micMuted ? "Unmute" : "Mute"}
                    aria-label={voiceCallState.micMuted ? "Unmute" : "Mute"}
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
                    title={voiceCallState.deafened ? "Undeafen" : "Deafen"}
                    aria-label={voiceCallState.deafened ? "Undeafen" : "Deafen"}
                >
                    {#if voiceCallState.deafened}<HeadphoneOff
                            size={20}
                        />{:else}<Headphones size={20} />{/if}
                </button>
                <button
                    onclick={leaveCall}
                    class="p-1.5 rounded hover:bg-discord-messageHover text-discord-danger"
                    title="Disconnect"
                    aria-label="Disconnect"
                >
                    <PhoneOff size={20} />
                </button>
            </div>
        </div>
    </div>
{/if}

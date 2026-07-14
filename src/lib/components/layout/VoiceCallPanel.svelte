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
    import {
        getRoom,
        getRoomDisplayName,
        resumeVoicePlayback,
    } from "$lib/matrix/client";
    import { navigateToRoom } from "$lib/stores/rooms.svelte";

    const roomName = $derived.by(() => {
        void voiceCallState.voiceTick;
        const room = voiceCallState.roomId
            ? getRoom(voiceCallState.roomId)
            : null;
        return room ? getRoomDisplayName(room) : "";
    });
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
                onclick={() => navigateToRoom(voiceCallState.roomId!)}
                title="Go to {roomName}"
            >
                <p
                    class="text-xs font-semibold {voiceCallState.connState ===
                    'connected'
                        ? 'text-discord-accent'
                        : 'text-discord-warning'}"
                >
                    {connStateLabel(voiceCallState.connState)}
                </p>
                <p class="text-xs text-discord-textMuted truncate">
                    {roomName}
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
                    onclick={leaveCall}
                    class="p-1.5 rounded hover:bg-discord-messageHover text-discord-danger"
                    title="Disconnect"
                    aria-label="Disconnect"
                >
                    <PhoneOff size={16} />
                </button>
            </div>
        </div>
    </div>
{/if}

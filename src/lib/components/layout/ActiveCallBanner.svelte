<script lang="ts">
    import type { Room } from "matrix-js-sdk";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { Phone, PhoneOff } from "lucide-svelte";
    import {
        getRoomCallMemberships,
        getMemberName,
        getMemberAvatar,
    } from "$lib/matrix/client";
    import {
        voiceCallState,
        joinCall,
        leaveCall,
    } from "$lib/stores/voiceCall.svelte";
    import { dedupeParticipants } from "$lib/utils/voiceCall";

    interface Props {
        room: Room;
    }
    let { room }: Props = $props();

    const participants = $derived(
        (void voiceCallState.voiceTick,
        dedupeParticipants(getRoomCallMemberships(room))),
    );
    const inThisCall = $derived(voiceCallState.roomId === room.roomId);
    const speaking = $derived(new Set(voiceCallState.speakingMemberIds));
</script>

{#if participants.length > 0}
    <div
        class="flex items-center gap-3 px-4 py-2 bg-discord-backgroundSecondary border-b border-discord-divider"
    >
        <div class="flex -space-x-1.5">
            {#each participants as p (p.userId)}
                <div
                    class="rounded-full ring-2 {speaking.has(
                        `${p.userId}:${p.deviceId}`,
                    )
                        ? 'ring-discord-accent'
                        : 'ring-transparent'}"
                    title={getMemberName(room, p.userId)}
                >
                    <Avatar
                        src={getMemberAvatar(room, p.userId)}
                        name={getMemberName(room, p.userId)}
                        id={p.userId}
                        size={24}
                    />
                </div>
            {/each}
        </div>
        <span class="text-sm text-discord-textSecondary min-w-0 truncate">
            Voice call · {participants.length} in call
        </span>
        {#if inThisCall}
            <button
                onclick={leaveCall}
                class="ml-auto flex items-center gap-1.5 px-3 py-1 rounded bg-discord-danger hover:bg-discord-dangerHover text-white text-sm font-medium transition-colors"
            >
                <PhoneOff size={14} /> Leave
            </button>
        {:else}
            <button
                onclick={() => joinCall(room.roomId)}
                class="ml-auto flex items-center gap-1.5 px-3 py-1 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-medium transition-colors"
            >
                <Phone size={14} /> Join
            </button>
        {/if}
    </div>
{/if}

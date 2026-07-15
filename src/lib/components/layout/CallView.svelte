<script lang="ts">
    import type { Room } from "matrix-js-sdk";
    import {
        MessageSquare,
        Mic,
        MicOff,
        Headphones,
        HeadphoneOff,
        PhoneOff,
        Phone,
        Volume2,
    } from "lucide-svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import CallParticipantMenu from "$lib/components/layout/CallParticipantMenu.svelte";
    import {
        getRoomCallMemberships,
        getRoomDisplayName,
        getMemberName,
        getMemberAvatar,
        resumeVoicePlayback,
        getDirectRoomIds,
    } from "$lib/matrix/client";
    import {
        voiceCallState,
        joinCall,
        leaveCall,
        toggleCallMute,
        toggleCallDeafen,
    } from "$lib/stores/voiceCall.svelte";
    import { dedupeParticipants } from "$lib/utils/voiceCall";
    import {
        showChatView,
        openModal,
        clearModal,
    } from "$lib/stores/interface.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { auth } from "$lib/stores/auth.svelte";

    interface Props {
        room: Room;
    }
    let { room }: Props = $props();

    // Live SDK objects mutate in place, so every read of call/room state hangs
    // off a tick: voiceTick for the roster, roomsTick for names and avatars.
    const participants = $derived(
        (void voiceCallState.voiceTick,
        dedupeParticipants(getRoomCallMemberships(room))),
    );
    const inThisCall = $derived(voiceCallState.roomId === room.roomId);
    const speaking = $derived(new Set(voiceCallState.speakingMemberIds));
    // Contract: an identity absent from this set is unmuted, never "unknown".
    const muted = $derived(new Set(voiceCallState.mutedIdentities));
    const roomName = $derived(
        (void roomsState.roomsTick, getRoomDisplayName(room)),
    );
    const joining = $derived(voiceCallState.joinPendingRoomId === room.roomId);
    // roomsTick, not voiceTick: m.direct is account data that lands on a sync,
    // and the roster is frozen for the whole ring — see the tick split above
    // and ActiveCallBanner.svelte.
    const isDm = $derived(
        (void roomsState.roomsTick, getDirectRoomIds().has(room.roomId)),
    );
    // A DM call with nobody else in it yet: we are ringing them. Derived, not
    // stored — it stays until they join or we hang up, because a decline is
    // invisible to the caller without MSC4310. The `=== auth.userId` check
    // keeps "Ringing…" off the screen of a peer whose own membership has not
    // propagated yet.
    const ringingOut = $derived(
        inThisCall &&
            participants.length === 1 &&
            participants[0].userId === auth.userId &&
            isDm,
    );

    let participantMenu = $state<{
        userId: string;
        x: number;
        y: number;
    } | null>(null);
    function openParticipantMenu(e: MouseEvent, userId: string) {
        e.preventDefault();
        participantMenu = { userId, x: e.clientX, y: e.clientY };
        openModal("call-participant-menu", () => (participantMenu = null));
    }
</script>

<div class="flex-1 flex flex-col min-w-0 bg-discord-backgroundTertiary">
    <!-- Header -->
    <div
        class="h-12 px-4 flex items-center gap-2 flex-shrink-0 border-b border-discord-divider bg-discord-background"
    >
        <Volume2 size={20} class="text-discord-textMuted flex-shrink-0" />
        <h2 class="font-semibold text-discord-textPrimary truncate">
            {roomName}
        </h2>
        {#if ringingOut}
            <span class="text-sm text-discord-textMuted flex-shrink-0">
                Ringing…
            </span>
        {/if}
        <div class="flex-1"></div>
        <button
            onclick={showChatView}
            class="p-1.5 rounded transition-colors text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover"
            title="Show chat"
            aria-label="Show chat"
        >
            <MessageSquare size={20} />
        </button>
    </div>

    <!-- Tiles -->
    <div class="flex-1 min-h-0 overflow-y-auto p-4">
        <!-- Deliberately no auto-flip effect here: the call emptying while we
             watch must NOT flip us back to the timeline — peeking at an empty
             call and joining it is the point of this view. -->
        {#if participants.length === 0}
            <div
                class="h-full flex flex-col items-center justify-center gap-3 text-discord-textMuted"
            >
                <Volume2 size={40} />
                <p class="text-sm">No one is in this call</p>
            </div>
        {:else}
            <div
                class="grid gap-3"
                style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));"
            >
                {#each participants as p (p.userId)}
                    {@const identity = `${p.userId}:${p.deviceId}`}
                    {@const name =
                        (void roomsState.roomsTick,
                        getMemberName(room, p.userId))}
                    {@const avatar =
                        (void roomsState.roomsTick,
                        getMemberAvatar(room, p.userId))}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="relative aspect-video rounded-lg bg-discord-backgroundSecondary flex items-center justify-center border-2 {speaking.has(
                            identity,
                        )
                            ? 'border-discord-accent'
                            : 'border-transparent'}"
                        oncontextmenu={(e) => openParticipantMenu(e, p.userId)}
                    >
                        <Avatar src={avatar} {name} id={p.userId} size={80} />
                        <div
                            class="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 max-w-[calc(100%-1rem)]"
                        >
                            {#if muted.has(identity)}
                                <MicOff
                                    size={12}
                                    class="text-discord-danger flex-shrink-0"
                                />
                            {/if}
                            <span class="text-xs text-white truncate">
                                {name}
                            </span>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Controls -->
    <div class="flex-shrink-0 p-4 flex flex-col items-center gap-2">
        {#if voiceCallState.playbackBlocked && inThisCall}
            <button
                onclick={() => void resumeVoicePlayback()}
                class="px-3 py-1.5 rounded bg-discord-warning text-black text-xs font-semibold"
            >
                Enable audio
            </button>
        {/if}
        {#if inThisCall}
            <div
                class="flex items-center gap-2 px-2 py-2 rounded-full bg-discord-backgroundSecondary"
            >
                <button
                    onclick={toggleCallMute}
                    class="p-3 rounded-full hover:bg-discord-messageHover {voiceCallState.micMuted
                        ? 'text-discord-danger'
                        : 'text-discord-textPrimary'}"
                    title={voiceCallState.micMuted ? "Unmute" : "Mute"}
                    aria-label={voiceCallState.micMuted ? "Unmute" : "Mute"}
                >
                    {#if voiceCallState.micMuted}<MicOff size={20} />{:else}<Mic
                            size={20}
                        />{/if}
                </button>
                <button
                    onclick={toggleCallDeafen}
                    class="p-3 rounded-full hover:bg-discord-messageHover {voiceCallState.deafened
                        ? 'text-discord-danger'
                        : 'text-discord-textPrimary'}"
                    title={voiceCallState.deafened ? "Undeafen" : "Deafen"}
                    aria-label={voiceCallState.deafened ? "Undeafen" : "Deafen"}
                >
                    {#if voiceCallState.deafened}<HeadphoneOff
                            size={20}
                        />{:else}<Headphones size={20} />{/if}
                </button>
                <button
                    onclick={leaveCall}
                    class="p-3 rounded-full bg-discord-danger hover:bg-discord-dangerHover text-white transition-colors"
                    title="Disconnect"
                    aria-label="Disconnect"
                >
                    <PhoneOff size={20} />
                </button>
            </div>
        {:else}
            <button
                onclick={() => joinCall(room.roomId)}
                disabled={voiceCallState.joinPendingRoomId !== null}
                class="flex items-center gap-2 px-6 py-2.5 rounded-full bg-discord-accent hover:bg-discord-accentHover text-white font-medium transition-colors disabled:opacity-60"
            >
                <Phone size={18} />
                {joining ? "Joining…" : "Join Call"}
            </button>
        {/if}
    </div>
</div>

<!-- CallParticipantMenu brings its own Portal + backdrop — don't wrap it. -->
{#if participantMenu}
    <CallParticipantMenu
        {room}
        userId={participantMenu.userId}
        x={participantMenu.x}
        y={participantMenu.y}
        onClose={() => {
            participantMenu = null;
            clearModal("call-participant-menu");
        }}
    />
{/if}

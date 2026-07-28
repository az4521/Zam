<script lang="ts">
    import type { Room } from "matrix-js-sdk";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { Phone, PhoneOff, Video, VideoOff, MonitorUp } from "lucide-svelte";
    import {
        getRoomCallMemberships,
        getMemberName,
        getMemberAvatar,
        getDirectRoomIds,
    } from "$lib/matrix/client";
    import {
        voiceCallState,
        joinCall,
        leaveCall,
        toggleCamera,
        toggleScreenShare,
    } from "$lib/stores/voiceCall.svelte";
    import { dedupeParticipants } from "$lib/utils/voiceCall";
    import { screenShareSupportedHere } from "$lib/utils/videoTiles";
    import { auth } from "$lib/stores/auth.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { showCallView } from "$lib/stores/interface.svelte";

    interface Props {
        room: Room;
    }
    let { room }: Props = $props();

    // Fixed for the session, same as CallView and VoiceCallPanel.
    const screenShareSupported = screenShareSupportedHere();

    const participants = $derived(
        (void voiceCallState.voiceTick,
        dedupeParticipants(getRoomCallMemberships(room))),
    );
    const inThisCall = $derived(voiceCallState.roomId === room.roomId);
    const speaking = $derived(voiceCallState.speakingUserIds);
    // m.direct is account data: it lands on a sync, never on a matrixRTC
    // session event, so this hangs off roomsTick (onRoomUpdate bumps it on
    // every sync) and NOT voiceTick — see CallView.svelte:44. Ringing is
    // precisely the state in which the roster is frozen, so a voiceTick-gated
    // read would never re-run: a late m.direct would strand "1 in call" for
    // the whole ring. Same reasoning as IncomingCallCard.svelte:20.
    const isDm = $derived(
        (void roomsState.roomsTick, getDirectRoomIds().has(room.roomId)),
    );
    // A DM call with nobody else in it yet: we are ringing them. Derived, not
    // stored — and it stays until they join or we hang up, because a decline
    // is invisible to the caller without MSC4310. The `=== auth.userId` check
    // is load-bearing: during join our own membership may not have propagated,
    // so a bare length===1 could mean "only THEY are here" and would show
    // "Ringing…" to the wrong side.
    const ringingOut = $derived(
        inThisCall &&
            participants.length === 1 &&
            participants[0].userId === auth.userId &&
            isDm,
    );
</script>

{#if participants.length > 0}
    <div
        class="flex items-center gap-3 px-4 py-2 bg-discord-backgroundSecondary border-b border-discord-divider"
    >
        <!-- Body opens the call view (peek without joining); Leave/Join stays
             a separate action on the right. Same target as the roster rows and
             the VoiceCallPanel — the banner is rendered only for the active
             room, so showCallView alone suffices (no navigateToRoom). -->
        <button
            onclick={() => showCallView(room.roomId)}
            class="flex items-center gap-3 min-w-0 flex-1 text-left -mx-1 px-1 py-1 rounded hover:bg-discord-messageHover transition-colors"
            title="Open call"
        >
            <div class="flex -space-x-1.5">
                {#each participants as p (p.userId)}
                    <div
                        class="rounded-full ring-2 {speaking.has(p.userId)
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
                {#if ringingOut}
                    Ringing…
                {:else}
                    Voice call · {participants.length} in call
                {/if}
            </span>
        </button>
        {#if inThisCall}
            <!-- Camera/share sit here as well as in CallView so a user who
                 stayed on the timeline never has to open the call view to
                 start video. Same store toggles, same support gate. -->
            <div class="ml-auto flex items-center gap-1 flex-shrink-0">
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
                    {#if voiceCallState.cameraOn}<Video
                            size={16}
                        />{:else}<VideoOff size={16} />{/if}
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
            </div>
            <button
                onclick={leaveCall}
                class="flex items-center gap-1.5 px-3 py-1 rounded bg-discord-danger hover:bg-discord-dangerHover text-white text-sm font-medium transition-colors flex-shrink-0"
            >
                <PhoneOff size={14} /> Leave
            </button>
        {:else}
            {@const joining = voiceCallState.joinPendingRoomId === room.roomId}
            <button
                onclick={() => joinCall(room.roomId)}
                disabled={voiceCallState.joinPendingRoomId !== null}
                class="ml-auto flex items-center gap-1.5 px-3 py-1 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
                <Phone size={14} />
                {joining ? "Joining…" : "Join"}
            </button>
        {/if}
    </div>
{/if}

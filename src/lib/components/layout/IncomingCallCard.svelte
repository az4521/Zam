<script lang="ts">
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { Phone, PhoneOff } from "lucide-svelte";
    import {
        getRoom,
        getDMPartnerId,
        getMemberName,
        getMemberAvatar,
    } from "$lib/matrix/client";
    import { voiceCallState } from "$lib/stores/voiceCall.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";

    interface Props {
        roomId: string;
        onAccept: (roomId: string) => void;
        onDecline: (roomId: string) => void;
    }
    let { roomId, onAccept, onDecline }: Props = $props();

    // Live SDK objects mutate in place and `roomId` never changes for a card's
    // lifetime, so every read of room state hangs off roomsTick — it bumps on
    // every sync (client.ts onRoomUpdate), which is when a federated DM's
    // late-arriving m.room.member state lands. Without it the card would show a
    // raw MXID (or your own avatar) for the whole ring. Not voiceTick: that is
    // the roster's tick and never fires for room state — see CallView.svelte:44.
    // Each derived threads the tick itself; gating only `room` would not help,
    // as getRoom() returns the same reference and Svelte halts propagation on an
    // unchanged value.
    const room = $derived((void roomsState.roomsTick, getRoom(roomId)));
    const partnerId = $derived(
        (void roomsState.roomsTick, room ? getDMPartnerId(room) : ""),
    );
    const name = $derived(
        (void roomsState.roomsTick,
        room && partnerId ? getMemberName(room, partnerId) : "Unknown"),
    );
    const avatar = $derived(
        (void roomsState.roomsTick,
        room && partnerId ? getMemberAvatar(room, partnerId) : null),
    );
    // `!== null`, NOT `=== roomId`: joinCall() is single-flight and early-
    // returns while ANY join is in flight (voiceCall.svelte.ts:166), so a
    // per-room predicate would leave this button lit and silently inert while
    // another card's Accept is resolving. Matches ActiveCallBanner.svelte:67,
    // CallView.svelte:193 and MessageArea.svelte:982.
    const busy = $derived(voiceCallState.joinPendingRoomId !== null);
</script>

<div
    class="flex items-center gap-3 w-80 px-4 py-3 rounded-lg shadow-lg bg-discord-background border border-discord-divider"
>
    <Avatar src={avatar} {name} id={partnerId} size={40} />
    <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-discord-textPrimary truncate">
            {name}
        </p>
        <p class="text-xs text-discord-textMuted">Incoming call</p>
    </div>
    <button
        type="button"
        class="p-2 rounded-full bg-discord-danger hover:bg-discord-dangerHover transition-colors"
        title="Decline"
        aria-label="Decline call from {name}"
        onclick={() => onDecline(roomId)}
    >
        <PhoneOff size={16} class="text-white" />
    </button>
    <button
        type="button"
        class="p-2 rounded-full bg-discord-accent hover:bg-discord-accentHover transition-colors disabled:opacity-60"
        title="Accept"
        aria-label="Accept call from {name}"
        disabled={busy}
        onclick={() => onAccept(roomId)}
    >
        <Phone size={16} class="text-white" />
    </button>
</div>

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

    interface Props {
        roomId: string;
        onAccept: (roomId: string) => void;
        onDecline: (roomId: string) => void;
    }
    let { roomId, onAccept, onDecline }: Props = $props();

    const room = $derived(getRoom(roomId));
    const partnerId = $derived(room ? getDMPartnerId(room) : "");
    const name = $derived(
        room && partnerId ? getMemberName(room, partnerId) : "Unknown",
    );
    const avatar = $derived(
        room && partnerId ? getMemberAvatar(room, partnerId) : null,
    );
    const joining = $derived(voiceCallState.joinPendingRoomId === roomId);
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
        disabled={joining}
        onclick={() => onAccept(roomId)}
    >
        <Phone size={16} class="text-white" />
    </button>
</div>

<script lang="ts">
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { voiceCallState } from "$lib/stores/voiceCall.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import {
        getMemberAvatar,
        getMemberName,
        getRoom,
    } from "$lib/matrix/client";

    interface Props {
        /** Whose tile this labels: the avatar is theirs. */
        userId: string;
        /** The text: a name, or "<name>'s screen". */
        label: string;
    }
    let { userId, label }: Props = $props();

    const room = $derived.by(() => {
        void roomsState.roomsTick;
        return voiceCallState.roomId ? getRoom(voiceCallState.roomId) : null;
    });
    const avatar = $derived(room ? getMemberAvatar(room, userId) : null);
    const name = $derived(room ? getMemberName(room, userId) : userId);
</script>

<!-- The avatar is 16px, the line height of text-xs, so it sits on the text's
     line without making the label taller. -->
<span
    class="inline-flex items-center gap-1.5 min-w-0 max-w-full px-1.5 py-0.5 rounded bg-black/60 text-white text-xs"
>
    <Avatar src={avatar} {name} id={userId} size={16} />
    <span class="truncate leading-4">{label}</span>
</span>

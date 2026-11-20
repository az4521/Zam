<script lang="ts">
    import CallView from "$lib/components/layout/CallView.svelte";
    import { getRoom } from "$lib/matrix/client";
    import { roomsState, setActiveRoom } from "$lib/stores/rooms.svelte";
    import {
        callPopoutState,
        closeCallPopout,
    } from "$lib/stores/callPopout.svelte";
    import { showCallView } from "$lib/stores/interface.svelte";

    // Mounted into the pop-out window's document, so it renders the same call
    // as the main window and its controls drive the one call.
    const room = $derived.by(() => {
        void roomsState.roomsTick;
        const id = callPopoutState.roomId;
        return id ? getRoom(id) : null;
    });

    /** Show the call in the main window again, then close the pop-out. */
    function onReturn(): void {
        const id = callPopoutState.roomId;
        if (!id) return;
        setActiveRoom(id);
        showCallView(id);
        window.focus();
        closeCallPopout();
    }
</script>

{#if room}
    <div class="h-full flex flex-col bg-zam-backgroundTertiary">
        <CallView {room} popout={{ onReturn }} />
    </div>
{/if}

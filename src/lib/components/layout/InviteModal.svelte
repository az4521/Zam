<script lang="ts">
    import InvitePanel from "./InvitePanel.svelte";
    import { closeModal } from "$lib/stores/interface.svelte";

    let { roomId }: { roomId: string } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    onclick={closeModal}
>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="bg-discord-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4"
        onclick={(e) => e.stopPropagation()}
    >
        <h2 class="text-lg font-bold text-discord-textPrimary">
            Invite People
        </h2>
        <InvitePanel {roomId} onClose={closeModal} />
    </div>
</div>

<script lang="ts">
    import InvitePanel from "./InvitePanel.svelte";
    import { closeModal } from "$lib/stores/interface.svelte";
    import { focusTrap } from "$lib/actions/focusTrap";

    let { roomId }: { roomId: string } = $props();
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center">
    <button
        type="button"
        aria-label="Close dialog"
        class="absolute inset-0 bg-black/60"
        onclick={closeModal}
    ></button>
    <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
        class="relative z-10 bg-discord-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4"
        use:focusTrap={{ onEscape: closeModal }}
    >
        <h2
            id="invite-modal-title"
            class="text-lg font-bold text-discord-textPrimary"
        >
            Invite People
        </h2>
        <InvitePanel {roomId} onClose={closeModal} />
    </div>
</div>

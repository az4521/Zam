<script lang="ts">
    import { fly } from "svelte/transition";
    import { X } from "lucide-svelte";
    import { toastsState, dismissToast } from "$lib/stores/toasts.svelte";
</script>

{#if toastsState.toasts.length}
    <div
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none"
    >
        {#each toastsState.toasts as toast (toast.id)}
            <div
                transition:fly={{ y: 12, duration: 150 }}
                role="alert"
                class="pointer-events-auto flex items-center gap-3 max-w-[90vw] sm:max-w-md rounded-lg border-l-4 border-discord-danger bg-discord-backgroundTertiary text-discord-textPrimary text-sm shadow-lg px-4 py-2.5"
            >
                <span class="min-w-0 break-words">{toast.message}</span>
                {#if toast.action}
                    <button
                        type="button"
                        class="shrink-0 px-2 py-1 rounded bg-discord-messageHover text-discord-textPrimary text-xs hover:bg-discord-accent hover:text-white transition-colors"
                        onclick={() => {
                            const action = toast.action;
                            dismissToast(toast.id);
                            action?.run();
                        }}>{toast.action.label}</button
                    >
                {/if}
                <button
                    class="shrink-0 text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                    onclick={() => dismissToast(toast.id)}
                    aria-label="Dismiss"
                >
                    <X size={16} />
                </button>
            </div>
        {/each}
    </div>
{/if}

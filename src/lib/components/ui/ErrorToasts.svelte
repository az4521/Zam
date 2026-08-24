<script lang="ts">
    import { fly } from "svelte/transition";
    import { X } from "lucide-svelte";
    import { toastsState, dismissToast } from "$lib/stores/toasts.svelte";
    import { motionOK } from "$lib/utils/motionPreference";
</script>

{#if toastsState.toasts.length}
    <div
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none"
    >
        {#each toastsState.toasts as toast (toast.id)}
            <!-- Definite width on mobile (w-[90vw]) so the toast never shrink-
                 wraps to a long action button and starves the message; desktop
                 keeps shrink-to-fit capped at max-w-md. The action sits on its
                 own row below the message, so any label length is safe. -->
            <div
                transition:fly={{ y: 12, duration: motionOK() ? 150 : 0 }}
                role={toast.tone === "accent" ? "status" : "alert"}
                class="pointer-events-auto w-[90vw] sm:w-auto sm:max-w-md rounded-lg border-l-4 {toast.tone ===
                'accent'
                    ? 'border-discord-accent'
                    : 'border-discord-danger'} bg-discord-backgroundTertiary text-discord-textPrimary text-sm shadow-lg px-4 py-2.5"
            >
                <div class="flex items-start gap-3">
                    <span class="min-w-0 flex-1 break-words">
                        {toast.message}
                    </span>
                    <button
                        class="-mr-1 shrink-0 text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                        onclick={() => dismissToast(toast.id)}
                        aria-label="Dismiss"
                    >
                        <X size={16} />
                    </button>
                </div>
                {#if toast.action}
                    <div class="mt-2 flex justify-end">
                        <button
                            type="button"
                            class="shrink-0 px-2 py-1 rounded bg-discord-messageHover text-discord-textPrimary text-xs hover:bg-discord-accent hover:text-white transition-colors"
                            onclick={() => {
                                const action = toast.action;
                                dismissToast(toast.id);
                                action?.run();
                            }}>{toast.action.label}</button
                        >
                    </div>
                {/if}
            </div>
        {/each}
    </div>
{/if}

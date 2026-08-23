<script lang="ts">
    // App-shell banner shown when rust-crypto failed to initialise this
    // session (audit SEC-M6): encrypted rooms show placeholders and sends to
    // them fail closed. Reactive via the sessionHealth store; dismissible for
    // the session; a reload retries crypto init.
    import {
        shouldShowCryptoBanner,
        dismissCryptoBanner,
    } from "$lib/stores/sessionHealth.svelte";

    const visible = $derived(shouldShowCryptoBanner());

    function reload() {
        location.reload();
    }
</script>

{#if visible}
    <div
        role="alert"
        class="fixed top-4 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-discord-danger/50 bg-discord-backgroundSecondary px-4 py-2.5 shadow-lg"
    >
        <svg
            class="h-5 w-5 flex-shrink-0 text-discord-danger"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path
                d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z"
            />
        </svg>
        <span class="min-w-0 text-sm text-discord-textPrimary">
            Encryption is unavailable this session: encrypted messages can't be
            read or sent. Reload to try again.
        </span>
        <button
            onclick={reload}
            class="flex-shrink-0 rounded bg-discord-accent px-3 py-1 text-sm font-medium text-white hover:opacity-90"
        >
            Reload
        </button>
        <button
            onclick={dismissCryptoBanner}
            aria-label="Dismiss encryption warning"
            class="flex-shrink-0 text-discord-textMuted hover:text-discord-textPrimary"
        >
            <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                />
            </svg>
        </button>
    </div>
{/if}

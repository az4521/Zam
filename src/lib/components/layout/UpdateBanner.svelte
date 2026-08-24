<script lang="ts">
    // A subtle, dismissible "update ready" prompt (fed by the updateBanner
    // store's app-shell watch), so a found/downloaded update doesn't wait for
    // the user to open Settings → About. Renders nothing on web or when there's
    // no actionable update. Mounted inline above the desktop sidebar's profile
    // footer — NOT over the message composer; mobile uses a toast instead
    // (see UpdateToastWatch).
    import {
        bannerVisible,
        bannerView,
        runBannerAction,
        dismissUpdateBanner,
    } from "$lib/stores/updateBanner.svelte";

    const visible = $derived(bannerVisible());
    const view = $derived(bannerView());

    let acting = $state(false);
    async function onAction() {
        if (acting) return;
        acting = true;
        try {
            await runBannerAction();
        } finally {
            acting = false;
        }
    }
</script>

{#if visible}
    <!-- Stacked layout: the sidebar column is narrow (~312px), so the label
         gets its own row (wraps, never truncates to "Update a…") and the action
         + dismiss sit on a row below. -->
    <div
        role="status"
        aria-live="polite"
        class="mx-2 mb-2 rounded-lg border border-discord-divider bg-discord-backgroundSecondary px-3 py-2 shadow-sm"
    >
        <div class="flex items-start gap-2">
            <svg
                class="mt-0.5 h-4 w-4 flex-shrink-0 text-discord-accent"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z"
                    transform="rotate(180 12 12)"
                />
                <path d="M12 16l4-5h-3V7h-2v4H8z" />
            </svg>
            <span class="min-w-0 flex-1 text-sm text-discord-textPrimary">
                {view.label}
            </span>
            <button
                onclick={dismissUpdateBanner}
                aria-label="Dismiss update notification"
                class="-mr-1 flex-shrink-0 text-discord-textMuted hover:text-discord-textPrimary"
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
        {#if view.action !== "none" && view.actionLabel}
            <div class="mt-2 flex justify-end">
                <button
                    onclick={onAction}
                    disabled={acting || view.busy}
                    class="rounded bg-discord-accent px-3 py-1 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                    {view.actionLabel}
                </button>
            </div>
        {/if}
    </div>
{/if}

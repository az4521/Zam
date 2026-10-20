<script lang="ts">
    import { t } from "$lib/i18n";
    // Out of storage: persistent, with no dismiss, until a check finds room
    // again (storageHealth lifts it by itself; "Check again" checks now).
    // Low on storage: an early warning, dismissible for the session.
    import {
        storageHealthState,
        recheckStorage,
    } from "$lib/stores/storageHealth.svelte";

    let lowDismissed = $state(false);
    let checking = $state(false);

    const showLow = $derived(
        !storageHealthState.full && storageHealthState.low && !lowDismissed,
    );

    const freeText = $derived.by(() => {
        const free = storageHealthState.freeBytes;
        if (free === null) return "";
        return new Intl.NumberFormat(undefined, {
            style: "unit",
            unit: "megabyte",
            maximumFractionDigits: 0,
        }).format(free / (1024 * 1024));
    });

    async function checkAgain() {
        checking = true;
        try {
            await recheckStorage();
        } finally {
            checking = false;
        }
    }
</script>

{#if storageHealthState.full || showLow}
    <div
        role="alert"
        class="flex max-w-full items-center gap-3 rounded-lg border bg-discord-backgroundSecondary px-4 py-2.5 shadow-lg {storageHealthState.full
            ? 'border-discord-danger/50'
            : 'border-discord-warning/50'}"
    >
        <svg
            class="h-5 w-5 flex-shrink-0 {storageHealthState.full
                ? 'text-discord-danger'
                : 'text-discord-warning'}"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path
                d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z"
            />
        </svg>
        <span class="min-w-0 text-sm text-discord-textPrimary">
            {storageHealthState.full
                ? t("storageBanner.outOfStorage")
                : t("storageBanner.lowStorage", { free: freeText })}
        </span>
        {#if storageHealthState.full}
            <button
                onclick={checkAgain}
                disabled={checking}
                class="flex-shrink-0 rounded bg-discord-accent px-3 py-1 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
                {t("storageBanner.checkAgain")}
            </button>
        {:else}
            <button
                onclick={() => (lowDismissed = true)}
                aria-label={t("storageBanner.dismissLowStorageWarning")}
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
        {/if}
    </div>
{/if}

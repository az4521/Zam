<script lang="ts">
    import { t } from "$lib/i18n";
    // iOS Safari outside the installed app: Safari erases a site's storage
    // (login, encryption keys, message cache) after 7 days without use unless
    // the site is on the Home Screen, so this asks for the install up front.
    // Mounted at the root page so it shows on the login and splash views too.
    // Dismissible for this page load only: it comes back on the next visit.
    import { installPrompt } from "$lib/stores/installPrompt.svelte";

    let dismissed = $state(false);
</script>

{#if installPrompt.iosManualHint && !dismissed}
    <div
        role="status"
        class="flex max-w-full items-center gap-3 rounded-lg border border-zam-accent/50 bg-zam-backgroundSecondary px-4 py-2.5 shadow-lg"
    >
        <svg
            class="h-5 w-5 flex-shrink-0 text-zam-accent"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path
                d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z"
            />
        </svg>
        <span class="min-w-0 text-sm text-zam-textPrimary">
            {t("installBanner.text")}
        </span>
        <button
            onclick={() => (dismissed = true)}
            aria-label={t("installBanner.dismiss")}
            class="flex-shrink-0 text-zam-textMuted hover:text-zam-textPrimary"
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

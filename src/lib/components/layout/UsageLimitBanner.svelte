<script lang="ts">
    import { t } from "$lib/i18n";
    // The signed-in account has hit a homeserver usage limit: a server-wide
    // block (M_RESOURCE_LIMIT_EXCEEDED, or a pinned usage-limit server
    // notice) or its own media upload quota (M_USER_LIMIT_EXCEEDED, e.g. a
    // matrix.org plan). Dismissible; comes back if the limit changes. It lifts
    // by itself once a request of the same kind goes through again (see
    // usageLimits.svelte.ts). Stacked by HealthBanners.
    import {
        activeUsageLimit,
        dismissUsageLimitBanner,
        usageLimitKey,
        usageLimitsState,
    } from "$lib/stores/usageLimits.svelte";
    import {
        adminContactHref,
        usageLimitMessageKey,
    } from "$lib/utils/usageLimits";

    const limit = $derived(activeUsageLimit());
    const visible = $derived(
        !!limit && usageLimitKey(limit) !== usageLimitsState.dismissedKey,
    );
    // Both links come from the server: only mailto:/https: survive.
    const contactHref = $derived(adminContactHref(limit?.adminContact));
    const infoHref = $derived(adminContactHref(limit?.infoUri));
</script>

{#if visible && limit}
    <div
        role="alert"
        class="flex max-w-full items-center gap-3 rounded-lg border px-4 py-2.5 shadow-lg {limit.kind ===
        'mediaQuota'
            ? 'border-zam-warning/50'
            : 'border-zam-danger/50'} bg-zam-backgroundSecondary"
    >
        <svg
            class="h-5 w-5 flex-shrink-0 {limit.kind === 'mediaQuota'
                ? 'text-zam-warning'
                : 'text-zam-danger'}"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path
                d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z"
            />
        </svg>
        <span class="flex min-w-0 flex-col gap-0.5 text-sm">
            <span class="text-zam-textPrimary">
                {t(usageLimitMessageKey(limit))}
                {#if limit.canUpgrade}
                    {t("usageLimits.canUpgrade")}
                {/if}
            </span>
            {#if limit.message}
                <span class="break-words text-xs text-zam-textMuted">
                    {limit.message}
                </span>
            {/if}
            {#if contactHref || infoHref}
                <span class="flex flex-wrap gap-3 text-xs">
                    {#if infoHref}
                        <a
                            href={infoHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-zam-accent hover:underline"
                        >
                            {t("usageLimits.learnMore")}
                        </a>
                    {/if}
                    {#if contactHref}
                        <a
                            href={contactHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-zam-accent hover:underline"
                        >
                            {t("usageLimits.contactAdmin")}
                        </a>
                    {/if}
                </span>
            {/if}
        </span>
        <button
            onclick={dismissUsageLimitBanner}
            aria-label={t("usageLimits.dismiss")}
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

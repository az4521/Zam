<script lang="ts">
    import { t } from "$lib/i18n";
    // MSC4153: alert when a cross-signing identity changes. Own-account
    // changes need re-verification (Settings → Sessions); another user's
    // change blocks encrypted sends to them until accepted here.
    import { identityAlertState } from "$lib/stores/identityAlerts.svelte";
    import {
        acceptIdentityChange,
        withdrawVerificationRequirement,
    } from "$lib/matrix/crypto";

    let dismissed = $state<Set<string>>(new Set());
    const visible = $derived(
        identityAlertState.alerts.filter((a) => !dismissed.has(a.userId)),
    );

    function dismiss(userId: string) {
        dismissed = new Set([...dismissed, userId]);
    }
</script>

{#if visible.length > 0}
    <div
        class="fixed top-16 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-2"
    >
        {#each visible as alert (alert.userId)}
            <div
                role="alert"
                class="flex items-center gap-3 rounded-lg border border-discord-danger/50 bg-discord-backgroundSecondary px-4 py-2.5 shadow-lg"
            >
                <span class="min-w-0 text-sm text-discord-textPrimary">
                    {alert.own
                        ? t("identityChange.own")
                        : t("identityChange.other", { user: alert.userId })}
                </span>
                {#if !alert.own}
                    <button
                        onclick={() => acceptIdentityChange(alert.userId)}
                        class="flex-shrink-0 rounded bg-discord-accent px-3 py-1 text-sm font-medium text-white hover:opacity-90"
                    >
                        {t("identityChange.accept")}
                    </button>
                    {#if alert.wasVerified}
                        <button
                            onclick={() =>
                                withdrawVerificationRequirement(alert.userId)}
                            class="flex-shrink-0 rounded bg-discord-backgroundTertiary px-3 py-1 text-sm text-discord-textPrimary"
                        >
                            {t("identityChange.withdraw")}
                        </button>
                    {/if}
                {/if}
                <button
                    onclick={() => dismiss(alert.userId)}
                    aria-label={t("identityChange.dismiss")}
                    class="flex-shrink-0 text-discord-textMuted hover:text-discord-textPrimary"
                >
                    ✕
                </button>
            </div>
        {/each}
    </div>
{/if}

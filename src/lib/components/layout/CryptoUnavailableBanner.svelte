<script lang="ts">
    import { t } from "$lib/i18n";
    // Banner shown when rust-crypto failed to initialise this session
    // (audit SEC-M6): encryption is off on this device, encrypted rooms show
    // placeholders, sends to them fail closed and this device's keys aren't
    // published. Says why; dismissible for the session (not while sync is
    // held for it). Stacked by HealthBanners.
    //
    // "Try again" reloads rather than restarting crypto in place: the boot
    // path is what checks the store against the keys the server has for
    // this device (ownDeviceKeysReplaced) and sets sync up for a working
    // engine. While the cause is a full disk, it waits for space.
    import {
        shouldShowCryptoBanner,
        dismissCryptoBanner,
        sessionHealthState,
    } from "$lib/stores/sessionHealth.svelte";
    import { storageHealthState } from "$lib/stores/storageHealth.svelte";

    const visible = $derived(shouldShowCryptoBanner());
    const waitingForSpace = $derived(
        sessionHealthState.cryptoFailureKind === "storage" &&
            storageHealthState.full,
    );
    const message = $derived(
        sessionHealthState.cryptoFailureKind === "storage"
            ? t("cryptoUnavailableBanner.offOutOfStorage")
            : sessionHealthState.cryptoFailureKind === "locked"
              ? t("cryptoUnavailableBanner.offLocked")
              : t("cryptoUnavailableBanner.offOther"),
    );

    function retry() {
        location.reload();
    }
</script>

{#if visible}
    <div
        role="alert"
        class="flex max-w-full items-center gap-3 rounded-lg border border-discord-danger/50 bg-discord-backgroundSecondary px-4 py-2.5 shadow-lg"
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
        <span class="flex min-w-0 flex-col gap-0.5 text-sm">
            <span class="text-discord-textPrimary">{message}</span>
            {#if sessionHealthState.syncHeldForCrypto}
                <span class="text-discord-textPrimary">
                    {t("cryptoUnavailableBanner.syncPaused")}
                </span>
            {/if}
            {#if sessionHealthState.cryptoFailureKind === "other" && sessionHealthState.cryptoFailureDetail}
                <span class="break-words text-xs text-discord-textMuted">
                    {sessionHealthState.cryptoFailureDetail}
                </span>
            {/if}
        </span>
        <button
            onclick={retry}
            disabled={waitingForSpace}
            title={waitingForSpace
                ? t("cryptoUnavailableBanner.freeUpSpaceFirst")
                : undefined}
            class="flex-shrink-0 rounded bg-discord-accent px-3 py-1 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {t("cryptoUnavailableBanner.tryAgain")}
        </button>
        {#if !sessionHealthState.syncHeldForCrypto}
            <button
                onclick={dismissCryptoBanner}
                aria-label={t(
                    "cryptoUnavailableBanner.dismissEncryptionWarning",
                )}
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

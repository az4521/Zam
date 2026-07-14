<script lang="ts">
    import {
        APP_VERSION,
        CAN_INSTALL_UPDATE,
        checkForUpdate,
        openReleasePage,
        reloadToLatest,
        type UpdateInfo,
    } from "$lib/update";
    import { clearCacheAndReload } from "$lib/matrix/client";

    let checking = $state(false);
    let info = $state<UpdateInfo | null>(null);
    let error = $state("");
    let reloading = $state(false);
    let clearingCache = $state(false);

    function clearCache() {
        clearingCache = true;
        void clearCacheAndReload();
    }

    async function check() {
        checking = true;
        error = "";
        info = null;
        try {
            info = await checkForUpdate();
        } catch (checkError) {
            error =
                (checkError as Error)?.message ??
                "Failed to check for updates.";
        } finally {
            checking = false;
        }
    }

    async function apply(update: UpdateInfo) {
        if (CAN_INSTALL_UPDATE) {
            openReleasePage(update.url);
            return;
        }
        reloading = true;
        try {
            await reloadToLatest();
        } catch {
            reloading = false;
        }
    }
</script>

<div class="space-y-6">
    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            Version
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">Matrix Client</p>
                <p class="text-xs text-discord-textMuted">
                    Current version v{APP_VERSION}
                </p>
            </div>
            <button
                onclick={check}
                disabled={checking}
                class="px-3 py-1.5 rounded text-sm font-medium bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50 flex-shrink-0"
            >
                {checking ? "Checking…" : "Check for updates"}
            </button>
        </div>
    </section>

    {#if error}
        <p class="text-sm text-discord-textMuted">{error}</p>
    {:else if info?.updateAvailable}
        <div
            class="rounded-lg border border-discord-accent bg-discord-accent/10 p-4 flex items-center gap-4"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-discord-textPrimary">
                    Update available
                </p>
                <p class="text-xs text-discord-textMuted">
                    v{info.current} → v{info.latest}
                </p>
            </div>
            <button
                onclick={() => apply(info!)}
                disabled={reloading}
                class="px-4 py-2 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors flex-shrink-0 disabled:opacity-50"
            >
                {reloading
                    ? "Reloading…"
                    : CAN_INSTALL_UPDATE
                      ? "Update"
                      : "Reload to update"}
            </button>
        </div>
    {:else if info}
        <p class="text-sm text-discord-textMuted">
            You’re on the latest version.
        </p>
    {/if}

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            Troubleshooting
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Clear cache and resync
                </p>
                <p class="text-xs text-discord-textMuted">
                    Re-downloads your rooms from the server. Fixes rooms that
                    are missing or stuck. You stay signed in.
                </p>
            </div>
            <button
                onclick={clearCache}
                disabled={clearingCache}
                class="px-3 py-1.5 rounded text-sm font-medium bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50 flex-shrink-0"
            >
                {clearingCache ? "Resyncing…" : "Clear cache"}
            </button>
        </div>
    </section>
</div>

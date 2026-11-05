<script lang="ts">
    import { t } from "$lib/i18n";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        setRichPresenceArrpc,
        setRichPresenceEnabled,
        setRichPresenceScan,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import {
        forgetApp,
        richPresenceAvailable,
        richPresenceState,
        setAppAllowed,
        syncRichPresence,
    } from "$lib/stores/richPresence.svelte";

    // Desktop only: apps on this computer report what they are doing and it is
    // published to the profile (MSC4544). Off until switched on here, and each
    // app stays blocked until allowed.

    const apps = $derived(
        Object.entries(richPresenceState.apps).sort(
            (a, b) => b[1].lastSeen - a[1].lastSeen,
        ),
    );
    const status = $derived(richPresenceState.status);

    function onToggleShare(next: boolean): void {
        setRichPresenceEnabled(next);
        void syncRichPresence();
    }

    function onToggleScan(next: boolean): void {
        setRichPresenceScan(next);
        void syncRichPresence();
    }

    function onToggleArrpc(next: boolean): void {
        setRichPresenceArrpc(next);
        void syncRichPresence();
    }
</script>

{#if richPresenceAvailable()}
    <section data-setting-anchor="cust-rich-presence">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            {t("richPresence.heading")}
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("richPresence.share")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("richPresence.shareHint")}
                </p>
                {#if settingsState.richPresenceEnabled && status?.msc4544.listening}
                    <p class="text-xs text-discord-textMuted">
                        {t("richPresence.listening", {
                            port: String(status.msc4544.port),
                        })}
                    </p>
                {/if}
                {#if settingsState.richPresenceEnabled && status?.msc4544.socket}
                    <p class="text-xs text-discord-textMuted break-all">
                        {t("richPresence.socket", {
                            path: status.msc4544.socket,
                        })}
                    </p>
                {/if}
                {#if settingsState.richPresenceEnabled && status?.msc4544.error}
                    <p class="text-xs text-discord-danger">
                        {t("richPresence.listenFailed", {
                            error: status.msc4544.error,
                        })}
                    </p>
                {/if}
                {#if richPresenceState.error}
                    <p class="text-xs text-discord-danger">
                        {t("richPresence.publishFailed")}
                        {richPresenceState.error}
                    </p>
                {/if}
            </div>
            <ToggleSwitch
                checked={settingsState.richPresenceEnabled}
                onChange={onToggleShare}
                label={t("richPresence.share")}
            />
        </div>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("richPresence.arrpc")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("richPresence.arrpcHint")}
                </p>
                {#if !settingsState.richPresenceEnabled}
                    <p class="text-xs text-discord-textMuted">
                        {t("richPresence.arrpcNeedsShare")}
                    </p>
                {/if}
                {#if settingsState.richPresenceEnabled && settingsState.richPresenceArrpc && status?.arrpc.error}
                    <p class="text-xs text-discord-danger">
                        {t("richPresence.arrpcFailed", {
                            error: status.arrpc.error,
                        })}
                    </p>
                {/if}
            </div>
            <ToggleSwitch
                checked={settingsState.richPresenceArrpc}
                onChange={onToggleArrpc}
                label={t("richPresence.arrpc")}
            />
        </div>

        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("richPresence.scan")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("richPresence.scanHint")}
                </p>
                {#if settingsState.richPresenceEnabled && settingsState.richPresenceScan && status?.scan.needsPermission}
                    <p class="text-xs text-discord-textMuted">
                        {t("richPresence.scanNeedsPermission")}
                    </p>
                    <code
                        class="mt-1 block select-all break-all rounded bg-discord-backgroundTertiary p-2 text-xs text-discord-textPrimary"
                    >
                        {t("richPresence.scanGrantCommand")}
                    </code>
                {:else if !settingsState.richPresenceEnabled}
                    <p class="text-xs text-discord-textMuted">
                        {t("richPresence.arrpcNeedsShare")}
                    </p>
                {/if}
                {#if settingsState.richPresenceEnabled && settingsState.richPresenceScan && status?.scan.error}
                    <p class="text-xs text-discord-danger">
                        {t("richPresence.scanFailed", {
                            error: status.scan.error,
                        })}
                    </p>
                {/if}
            </div>
            <ToggleSwitch
                checked={settingsState.richPresenceScan}
                onChange={onToggleScan}
                label={t("richPresence.scan")}
            />
        </div>

        <p class="text-sm text-discord-textPrimary mt-4 mb-1">
            {t("richPresence.apps")}
        </p>
        {#if apps.length === 0}
            <p class="text-xs text-discord-textMuted">
                {t("richPresence.noApps")}
            </p>
        {:else}
            <ul>
                {#each apps as [key, app] (key)}
                    <li
                        class="flex items-center gap-3 py-2 border-b border-discord-divider"
                    >
                        <div class="flex-1 min-w-0">
                            <p
                                class="text-sm text-discord-textPrimary truncate"
                            >
                                {app.name}
                            </p>
                            <p class="text-xs text-discord-textMuted">
                                {app.source === "arrpc"
                                    ? t("richPresence.viaDiscord")
                                    : t("richPresence.viaMatrix")}
                                ·
                                {app.allowed
                                    ? t("richPresence.allowed")
                                    : t("richPresence.blocked")}
                            </p>
                        </div>
                        <button
                            type="button"
                            class="text-xs text-discord-textMuted hover:text-discord-textPrimary"
                            aria-label={t("richPresence.forgetApp", {
                                name: app.name,
                            })}
                            onclick={() => forgetApp(key)}
                        >
                            {t("richPresence.forget")}
                        </button>
                        <ToggleSwitch
                            checked={app.allowed}
                            onChange={(next) => setAppAllowed(key, next)}
                            label={t("richPresence.allowApp", {
                                name: app.name,
                            })}
                        />
                    </li>
                {/each}
            </ul>
        {/if}
    </section>
{/if}

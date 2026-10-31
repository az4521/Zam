<script lang="ts">
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import ProxySettings from "./ProxySettings.svelte";
    import {
        setMinimizeToTrayOnClose,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import { isDesktopTray, setMinimizeToTray } from "$lib/desktopTray";

    const autostart =
        typeof window !== "undefined" ? window.desktop?.autostart : undefined;

    let autostartInfo = $state<{ available: boolean; enabled: boolean } | null>(
        null,
    );
    let autostartFailed = $state(false);

    onMount(() => {
        autostart
            ?.info()
            .then((info) => (autostartInfo = info))
            .catch(() => {});
    });

    function onToggleMinimizeToTray(next: boolean): void {
        setMinimizeToTrayOnClose(next);
        setMinimizeToTray(next);
    }

    async function onToggleAutostart(next: boolean): Promise<void> {
        if (!autostart) return;
        autostartFailed = false;
        try {
            autostartInfo = await autostart.set(next);
            autostartFailed = autostartInfo.enabled !== next;
        } catch {
            autostartFailed = true;
        }
    }
</script>

<div class="space-y-6">
    {#if isDesktopTray()}
        <section data-setting-anchor="cust-behavior">
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
            >
                {t("generalSettings.desktop")}
            </p>
            {#if autostartInfo?.available}
                <div
                    class="flex items-center gap-3 py-2 border-b border-discord-divider"
                >
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-discord-textPrimary">
                            {t("generalSettings.runAtStartup")}
                        </p>
                        <p class="text-xs text-discord-textMuted">
                            {t("generalSettings.startZamWhenYouLogIn")}
                        </p>
                        {#if autostartFailed}
                            <p class="text-xs text-discord-danger">
                                {t("generalSettings.runAtStartupFailed")}
                            </p>
                        {/if}
                    </div>
                    <ToggleSwitch
                        checked={autostartInfo.enabled}
                        onChange={onToggleAutostart}
                        label={t("generalSettings.runAtStartup")}
                    />
                </div>
            {/if}
            <div
                class="flex items-center gap-3 py-2 border-b border-discord-divider"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-discord-textPrimary">
                        {t("generalSettings.minimiseToTrayOnClose")}
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        {t("generalSettings.keepZamRunningInTheSystem")}
                    </p>
                </div>
                <ToggleSwitch
                    checked={settingsState.minimizeToTrayOnClose}
                    onChange={onToggleMinimizeToTray}
                    label={t("generalSettings.minimiseToTrayOnClose")}
                />
            </div>
        </section>
        <ProxySettings />
    {:else}
        <p class="text-sm text-discord-textMuted">
            {t("generalSettings.noGeneralSettingsAreAvailableOn")}
        </p>
    {/if}
</div>

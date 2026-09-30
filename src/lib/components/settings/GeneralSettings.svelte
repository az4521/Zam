<script lang="ts">
    import { t } from "$lib/i18n";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        setMinimizeToTrayOnClose,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import { isDesktopTray, setMinimizeToTray } from "$lib/desktopTray";

    function onToggleMinimizeToTray(next: boolean): void {
        setMinimizeToTrayOnClose(next);
        setMinimizeToTray(next);
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
    {:else}
        <p class="text-sm text-discord-textMuted">
            {t("generalSettings.noGeneralSettingsAreAvailableOn")}
        </p>
    {/if}
</div>

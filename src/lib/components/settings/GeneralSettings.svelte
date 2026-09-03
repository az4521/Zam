<script lang="ts">
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
                Desktop
            </p>
            <div
                class="flex items-center gap-3 py-2 border-b border-discord-divider"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-discord-textPrimary">
                        Minimise to tray on close
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        Keep Zam running in the system tray when you close the
                        window instead of quitting. Use the tray icon to reopen
                        or quit.
                    </p>
                </div>
                <ToggleSwitch
                    checked={settingsState.minimizeToTrayOnClose}
                    onChange={onToggleMinimizeToTray}
                    label="Minimise to tray on close"
                />
            </div>
        </section>
    {:else}
        <p class="text-sm text-discord-textMuted">
            No general settings are available on this platform.
        </p>
    {/if}
</div>

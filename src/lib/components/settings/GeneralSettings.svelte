<script lang="ts">
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        setKeepSidebarOpen,
        setHoldToOpenMessageMenu,
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
    <section data-setting-anchor="cust-behavior">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Behavior
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Keep room list open
                </p>
                <p class="text-xs text-discord-textMuted">
                    Don't auto-close the room list when switching between spaces
                    or Home. Opening a room or DM always closes it.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.keepSidebarOpen}
                onChange={setKeepSidebarOpen}
                label="Keep room list open"
            />
        </div>

        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Hold to open message menu
                </p>
                <p class="text-xs text-discord-textMuted">
                    On touch devices, open a message's actions by holding it
                    instead of tapping. When off, a tap opens the menu.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.holdToOpenMessageMenu}
                onChange={setHoldToOpenMessageMenu}
                label="Hold to open message menu"
            />
        </div>
        {#if isDesktopTray()}
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
        {/if}
    </section>
</div>

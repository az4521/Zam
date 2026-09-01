<script lang="ts">
    import CustomizationSettings from "$lib/components/settings/CustomizationSettings.svelte";
    import ThemeColorEditor from "$lib/components/settings/ThemeColorEditor.svelte";
    import NotificationSettings from "$lib/components/settings/NotificationSettings.svelte";
    import ServerSettings from "$lib/components/settings/ServerSettings.svelte";
    import BlockedUsersSettings from "$lib/components/settings/BlockedUsersSettings.svelte";
    import AboutSettings from "$lib/components/settings/AboutSettings.svelte";
    import DebugSettings from "$lib/components/settings/DebugSettings.svelte";
    import SessionSettings from "$lib/components/settings/SessionSettings.svelte";
    import SecuritySettings from "$lib/components/settings/SecuritySettings.svelte";
    import AccountSettings from "$lib/components/settings/AccountSettings.svelte";
    import CustomPackSettings from "$lib/components/settings/CustomPackSettings.svelte";
    import VoiceAudioSettings from "$lib/components/settings/VoiceAudioSettings.svelte";
    import PluginsSettings from "$lib/components/settings/PluginsSettings.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import { focusTrap } from "$lib/actions/focusTrap";
    import { tick, untrack } from "svelte";
    import {
        interfaceState,
        openSubPage,
        clearSubPageIfOwner,
    } from "$lib/stores/interface.svelte";
    import {
        settingsState,
        setRightAlignOwnBubbles,
    } from "$lib/stores/settings.svelte";
    import {
        SETTINGS_TABS,
        settingsTabLabel,
        settingsNavView,
        type SettingsTab,
    } from "$lib/utils/settingsNav";
    import { ChevronRight, ArrowLeft } from "lucide-svelte";

    interface Props {
        onClose: () => void;
        onLogout: () => void;
    }

    let { onClose, onLogout }: Props = $props();

    // null = "nothing drilled into yet": the mobile category list, or the
    // desktop default panel. Kept across a viewport change in both directions
    // so resizing/rotating never loses the user's place.
    let selectedTab = $state<SettingsTab | null>(
        interfaceState.settingsInitialTab,
    );

    const view = $derived(
        settingsNavView({ isMobile: interfaceState.isMobile, selectedTab }),
    );

    // Bumped on every settings-tab (re)selection. Reselecting the already-active
    // tab is a $state no-op for `selectedTab`, so this monotonic counter is what
    // signals a child panel (PluginsSettings) to reset its own sub-view state.
    let pluginsNavTick = $state(0);
    function selectTab(id: SettingsTab) {
        selectedTab = id;
        pluginsNavTick++;
    }

    // Stable identity: it is the ownership token for the sub-page slot, so it
    // must NOT be recreated on every render. It resets local state ONLY — it
    // runs from inside the store's own close/supersede paths, so reaching back
    // into the store here would pop the wrong owner.
    function goBackToList() {
        selectedTab = null;
    }

    // Register the mobile sub-page with the central dismiss stack so Escape and
    // the hardware back button pop it before closing the whole dialog.
    //
    // `openSubPage` READS `interfaceState.subPageClose` (to supersede a previous
    // owner) as well as writing it. Untracked, that read becomes a dependency of
    // this effect while the write invalidates it → the teardown clears the slot,
    // the body re-claims it, forever: `effect_update_depth_exceeded` (verified,
    // not theoretical). `untrack` keeps the slot out of the dependency set, so
    // the tracked dependencies are exactly what `view` reads — `isMobile` and
    // `selectedTab` — neither of which `openSubPage` writes, so there is no loop.
    $effect(() => {
        if (view.mode !== "detail") return;
        untrack(() => openSubPage(goBackToList));
        return () => clearSubPageIfOwner(goBackToList);
    });

    // Plain `let`, not `$state`: these are transition bookkeeping, not view
    // data. Reading them inside the effect below must register no dependency
    // (and `bind:this` writing a `$state` ref would retrigger it). Nothing
    // renders from them, so the non-reactivity the warning describes is the
    // whole point.
    // svelte-ignore non_reactive_update
    let backButtonEl: HTMLButtonElement | null = null;
    let categoryEls: HTMLButtonElement[] = [];
    let sidebarEls: Record<string, HTMLButtonElement | null> = {};
    let lastMode: string | null = null;

    // EVERY mode change destroys the element that had focus — drilling in,
    // backing out, and crossing the 768px breakpoint in either direction —
    // dropping focus to <body>, outside the focus trap, where the trap's
    // node-level keydown never fires and Tab escapes to the app shell behind
    // the modal. So re-anchor focus on every change, including into "desktop"
    // (never on first mount: focusTrap's rAF owns that). Writes no reactive
    // state, so it cannot retrigger itself.
    $effect(() => {
        const mode = view.mode;
        // Free: the effect already depends on `view`, so reading a second
        // property off the same object registers nothing new.
        const tab = mode === "list" ? null : view.tab;
        if (lastMode === null || lastMode === mode) {
            lastMode = mode;
            return;
        }
        lastMode = mode;
        // After the DOM is patched — `bind:this` has not necessarily landed yet.
        void tick().then(() => {
            if (mode === "detail") backButtonEl?.focus();
            else if (mode === "list") categoryEls[0]?.focus();
            else if (tab) sidebarEls[tab]?.focus();
        });
    });
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
    <button
        type="button"
        aria-label="Close dialog"
        class="absolute inset-0 bg-black/60"
        onclick={onClose}
    ></button>
    <!-- No `onEscape` on purpose: focusTrap's node-level keydown fires BEFORE
         <svelte:window onkeydown> reaches AppShell, so an onEscape here would
         close the whole dialog on the first Escape and the mobile sub-page could
         never be popped. Escape is owned by AppShell.dismissTopmost(). -->
    <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-settings-title"
        class="relative z-10 bg-discord-backgroundSecondary rounded-none md:rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden h-[100dvh] md:h-[85dvh]"
        use:focusTrap
    >
        <!-- Header. On a mobile sub-page the close button is replaced by a back
             arrow and the title names the category. -->
        <div
            class="flex items-center gap-2 px-6 py-4 border-b border-discord-divider flex-shrink-0"
        >
            {#if view.mode === "detail"}
                <button
                    bind:this={backButtonEl}
                    onclick={goBackToList}
                    aria-label="Back to settings"
                    class="-ml-2 p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors flex-shrink-0"
                >
                    <ArrowLeft size={20} />
                </button>
            {/if}
            <h2
                id="app-settings-title"
                class="text-lg font-bold text-discord-textPrimary min-w-0 truncate flex-1"
            >
                {view.mode === "detail"
                    ? settingsTabLabel(view.tab)
                    : "Settings"}
            </h2>
            <button
                onclick={onClose}
                aria-label="Close settings"
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors flex-shrink-0"
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                    />
                </svg>
            </button>
        </div>

        {#if view.mode === "list"}
            <!-- Mobile root: drill-down category list. -->
            <nav class="flex-1 overflow-y-auto py-2">
                {#each SETTINGS_TABS as tab, i (tab.id)}
                    <button
                        bind:this={categoryEls[i]}
                        onclick={() => selectTab(tab.id)}
                        class="w-full flex items-center justify-between gap-3 px-6 py-3.5 text-left text-base font-medium text-discord-textPrimary hover:bg-discord-messageHover active:bg-discord-messageHover transition-colors"
                    >
                        <span class="min-w-0 truncate">{tab.label}</span>
                        <ChevronRight
                            size={20}
                            aria-hidden="true"
                            class="flex-shrink-0 text-discord-textMuted"
                        />
                    </button>
                {/each}
            </nav>
        {:else if view.mode === "detail"}
            <!-- Mobile sub-page: one category, full screen. -->
            <div class="flex-1 overflow-y-auto p-4 min-w-0">
                {@render panel(view.tab)}
            </div>
        {:else}
            <!-- Desktop: category sidebar beside the active panel. -->
            <div class="flex flex-row flex-1 min-h-0">
                <nav
                    class="flex flex-col flex-shrink-0 w-40 gap-0.5 border-r border-discord-divider px-2 py-3"
                >
                    {#each SETTINGS_TABS as tab (tab.id)}
                        <button
                            bind:this={sidebarEls[tab.id]}
                            onclick={() => selectTab(tab.id)}
                            class="flex-shrink-0 w-full whitespace-nowrap text-left px-3 py-2 rounded text-sm font-medium transition-colors"
                            class:bg-discord-messageHover={view.tab === tab.id}
                            class:text-discord-textPrimary={view.tab === tab.id}
                            class:text-discord-textMuted={view.tab !== tab.id}
                            >{tab.label}</button
                        >
                    {/each}
                </nav>

                <div class="flex-1 overflow-y-auto p-6 min-w-0">
                    {@render panel(view.tab)}
                </div>
            </div>
        {/if}
    </div>
</div>

{#snippet panel(tab: SettingsTab)}
    {#if tab === "account"}
        <AccountSettings {onLogout} />
    {:else if tab === "sessions"}
        <SessionSettings />
    {:else if tab === "security"}
        <SecuritySettings />
    {:else if tab === "theme"}
        <div class="space-y-6">
            <div
                class="flex items-center gap-3 py-2 border-b border-discord-divider"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-discord-textPrimary">
                        Right-align my messages (bubble layout)
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        Display your own messages on the right in a colored
                        bubble
                    </p>
                </div>
                <ToggleSwitch
                    checked={settingsState.rightAlignOwnBubbles}
                    onChange={setRightAlignOwnBubbles}
                    label="Right-align my messages (bubble layout)"
                />
            </div>
            <ThemeColorEditor />
        </div>
    {:else if tab === "customization"}
        <CustomizationSettings />
    {:else if tab === "emotes"}
        <CustomPackSettings kind="emotes" />
    {:else if tab === "notifications"}
        <NotificationSettings />
    {:else if tab === "voice"}
        <VoiceAudioSettings />
    {:else if tab === "server"}
        <ServerSettings />
    {:else if tab === "blocked"}
        <BlockedUsersSettings />
    {:else if tab === "plugins"}
        <PluginsSettings navSignal={pluginsNavTick} />
    {:else if tab === "about"}
        <AboutSettings />
    {:else if tab === "debug"}
        <DebugSettings />
    {/if}
{/snippet}

<script lang="ts">
    import CustomizationSettings from "$lib/components/settings/CustomizationSettings.svelte";
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

    interface Props {
        onClose: () => void;
        onLogout: () => void;
    }

    let { onClose, onLogout }: Props = $props();

    type Tab =
        | "account"
        | "sessions"
        | "security"
        | "customization"
        | "emotes"
        | "notifications"
        | "voice"
        | "blocked"
        | "server"
        | "about"
        | "debug";
    let activeTab = $state<Tab>("account");

    const tabs: { id: Tab; label: string }[] = [
        { id: "account", label: "Account" },
        { id: "sessions", label: "Sessions" },
        { id: "security", label: "Security" },
        { id: "customization", label: "Customization" },
        { id: "emotes", label: "My Emotes" },
        { id: "notifications", label: "Notifications" },
        { id: "voice", label: "Voice & Audio" },
        { id: "blocked", label: "Blocked Users" },
        { id: "server", label: "Server" },
        { id: "about", label: "About" },
        { id: "debug", label: "Debug Info" },
    ];
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 md:p-4"
    onclick={(e) => {
        if (e.target === e.currentTarget) onClose();
    }}
>
    <div
        class="bg-discord-backgroundSecondary rounded-none md:rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden h-[100dvh] md:h-[85dvh]"
    >
        <!-- Header -->
        <div
            class="flex items-center justify-between px-6 py-4 border-b border-discord-divider flex-shrink-0"
        >
            <h2 class="text-lg font-bold text-discord-textPrimary">Settings</h2>
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button
                onclick={onClose}
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                    />
                </svg>
            </button>
        </div>

        <div class="flex flex-col md:flex-row flex-1 min-h-0">
            <!-- Tab bar: horizontal scrollable strip on mobile, sidebar on desktop -->
            <nav
                class="flex flex-row md:flex-col flex-shrink-0 w-full md:w-40 gap-1 md:gap-0.5 overflow-x-auto md:overflow-x-visible border-b md:border-b-0 md:border-r border-discord-divider px-2 py-2 md:py-3"
            >
                {#each tabs as tab (tab.id)}
                    <button
                        onclick={() => (activeTab = tab.id)}
                        class="flex-shrink-0 w-auto md:w-full whitespace-nowrap text-left px-3 py-2 rounded text-sm font-medium transition-colors"
                        class:bg-discord-messageHover={activeTab === tab.id}
                        class:text-discord-textPrimary={activeTab === tab.id}
                        class:text-discord-textMuted={activeTab !== tab.id}
                        >{tab.label}</button
                    >
                {/each}
            </nav>

            <!-- Tab content -->
            <div class="flex-1 overflow-y-auto p-4 md:p-6 min-w-0">
                <!-- ── Account ───────────────────────────────────────────── -->
                {#if activeTab === "account"}
                    <AccountSettings {onLogout} />
                {:else if activeTab === "sessions"}
                    <SessionSettings />
                {:else if activeTab === "security"}
                    <SecuritySettings />
                {:else if activeTab === "customization"}
                    <CustomizationSettings />
                {:else if activeTab === "emotes"}
                    <CustomPackSettings kind="emotes" />
                {:else if activeTab === "notifications"}
                    <NotificationSettings />
                {:else if activeTab === "voice"}
                    <VoiceAudioSettings />
                {:else if activeTab === "server"}
                    <ServerSettings />
                {:else if activeTab === "blocked"}
                    <BlockedUsersSettings />
                {:else if activeTab === "about"}
                    <AboutSettings />
                {:else if activeTab === "debug"}
                    <DebugSettings />
                {/if}
            </div>
        </div>
    </div>
</div>

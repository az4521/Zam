<script lang="ts">
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import AccountSwitcher from "$lib/components/layout/AccountSwitcher.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { presenceState, presenceFor } from "$lib/stores/presence.svelte";
    import {
        presenceDot,
        presenceDotClass,
        presenceLabel,
    } from "$lib/utils/presence";
    import { settingsState } from "$lib/stores/settings.svelte";
    import {
        openModal,
        closeModal,
        openAppSettingsTab,
    } from "$lib/stores/interface.svelte";
    import { getOwnAvatarUrl } from "$lib/matrix/client";
    import {
        verificationStatusState,
        refreshVerificationStatus,
        dismissVerificationNudge,
    } from "$lib/stores/verificationStatus.svelte";
    import { securityState } from "$lib/stores/security.svelte";
    import { verificationState } from "$lib/stores/verification.svelte";

    interface Props {
        onLogout: () => void;
        onSettings: () => void;
    }
    let { onLogout, onSettings }: Props = $props();

    const ownAvatarSrc = $derived.by(() => {
        roomsState.roomsTick;
        return getOwnAvatarUrl();
    });

    const ownPresence = $derived.by(() => {
        void presenceState.presenceTick;
        const p = auth.userId ? presenceFor(auth.userId) : null;
        const state = p?.state ?? settingsState.ownPresence;
        return {
            dotClass: presenceDotClass(presenceDot(state)),
            label: presenceLabel(state),
        };
    });

    let accountSwitcherOpen = $state(false);
    function openAccountSwitcher() {
        openModal("account-switcher", () => (accountSwitcherOpen = false));
        accountSwitcherOpen = true;
    }

    // Verification status refresh (guarded by tick to avoid re-triggering).
    let vLoaded = false;
    let vLastTick = -1;
    $effect(() => {
        const tick =
            securityState.securityTick + verificationState.verificationTick;
        if (!vLoaded || tick !== vLastTick) {
            vLoaded = true;
            vLastTick = tick;
            refreshVerificationStatus();
        }
    });

    // Verification nudge (shown only when actionable and not dismissed).
    const nudge = $derived(
        verificationStatusState.view &&
            verificationStatusState.view.actionable &&
            !verificationStatusState.nudgeDismissed
            ? verificationStatusState.view
            : null,
    );
</script>

{#if nudge}
    {@const toneClass =
        nudge.tone === "verified"
            ? "text-discord-online"
            : nudge.tone === "warning"
              ? "text-discord-warning"
              : nudge.tone === "unverified"
                ? "text-discord-danger"
                : "text-discord-textMuted"}
    <div
        class="w-full px-2 py-1.5 flex items-center gap-2 bg-discord-backgroundTertiary border-t border-discord-divider flex-shrink-0"
    >
        <div class="w-2 h-2 rounded-full {toneClass} bg-current"></div>
        <p class="flex-1 text-xs {toneClass} truncate" title={nudge.detail}>
            {nudge.label}
        </p>
        {#if nudge.actionLabel}
            <button
                onclick={() => openAppSettingsTab("security")}
                class="px-2 py-0.5 text-xs {toneClass} hover:underline"
            >
                {nudge.actionLabel}
            </button>
        {/if}
        <button
            onclick={dismissVerificationNudge}
            aria-label="Dismiss"
            class="text-discord-textMuted hover:text-discord-textPrimary text-sm"
        >
            ×
        </button>
    </div>
{/if}

<div
    class="w-full h-14 px-2 flex items-center gap-2 bg-discord-backgroundTertiary flex-shrink-0"
>
    <button
        onclick={openAccountSwitcher}
        class="flex-1 flex items-center gap-2 min-w-0 rounded p-1 -m-1 hover:bg-discord-messageHover transition-colors text-left"
        title="Switch accounts"
    >
        <div class="relative">
            <Avatar
                src={ownAvatarSrc}
                name={auth.userId || "?"}
                id={auth.userId}
                size={32}
            />
            <div
                title={ownPresence.label}
                class="absolute bottom-0 right-0 w-3 h-3 {ownPresence.dotClass} rounded-full border-2 border-discord-backgroundTertiary"
            ></div>
        </div>
        <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-discord-textPrimary truncate">
                {auth.userId?.split(":")[0].replace("@", "") ?? "Unknown"}
            </p>
            <p class="text-xs text-discord-textSecondary truncate">
                {auth.userId ?? ""}
            </p>
        </div>
    </button>
    <button
        onclick={onSettings}
        class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
        title="Settings"
        aria-label="Settings"
    >
        <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
        </svg>
    </button>
</div>

{#if accountSwitcherOpen}
    <AccountSwitcher onClose={closeModal} {onLogout} />
{/if}

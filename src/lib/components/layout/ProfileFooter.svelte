<script lang="ts">
    import { t } from "$lib/i18n";
    import { X } from "lucide-svelte";
    import { openEncryptionSetup } from "$lib/stores/onboarding.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import AccountSwitcher from "$lib/components/layout/AccountSwitcher.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { aliasUserLocalpart, shownUserId } from "$lib/utils/streamerAlias";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import {
        presenceDot,
        presenceDotClass,
        presenceLabel,
    } from "$lib/utils/presence";
    import { settingsState } from "$lib/stores/settings.svelte";
    import { openModal, closeModal } from "$lib/stores/interface.svelte";
    import { openProfileCard } from "$lib/stores/profileCard.svelte";
    import { getOwnAvatarUrl, mxcToHttp } from "$lib/matrix/client";
    import { richPresenceState } from "$lib/stores/richPresence.svelte";
    import type { RpcEntry } from "$lib/utils/richPresence";
    import {
        verificationStatusState,
        refreshVerificationStatus,
        dismissVerificationNudge,
    } from "$lib/stores/verificationStatus.svelte";
    import { securityState } from "$lib/stores/security.svelte";
    import {
        verificationState,
        verifyWithAnotherDevice,
    } from "$lib/stores/verification.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";

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
        // The chosen state, not the server's: tuwunel reports the highest
        // state across all our sessions, so an away pick would never show.
        const state = settingsState.ownPresence;
        if (settingsState.doNotDisturb && state !== "offline")
            return {
                dotClass: "bg-discord-dnd",
                label: t("presence.doNotDisturb"),
            };
        return {
            dotClass: presenceDotClass(presenceDot(state)),
            label: presenceLabel(state),
        };
    });

    // What Zam is showing on the profile right now (a detected game, an app's
    // rich presence), so it is plain that it is being sent.
    const sharing = $derived(richPresenceState.active);
    const entryName = (e: RpcEntry) =>
        e.kind === "activity" ? e.name : e.track;
    const entryDetail = (e: RpcEntry) =>
        e.kind === "activity" ? (e.details ?? e.state) : e.artist;

    let accountSwitcherOpen = $state(false);
    function openAccountSwitcher() {
        openModal("account-switcher", () => (accountSwitcherOpen = false));
        accountSwitcherOpen = true;
    }

    // Until the first sync the account data is not in, so the secret storage
    // key reads as missing and the nudge offered to set up encryption for a
    // few seconds after switching to an account that already has it.
    const synced = $derived(
        auth.syncState === "SYNCING" || auth.syncState === "PREPARED",
    );

    // Verification status refresh (guarded by tick to avoid re-triggering).
    let vLoaded = false;
    let vLastTick = -1;
    $effect(() => {
        if (!synced) return;
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
        synced &&
            verificationStatusState.view &&
            verificationStatusState.view.actionable &&
            !verificationStatusState.nudgeDismissed
            ? verificationStatusState.view
            : null,
    );

    // An unverified session can ask its siblings directly instead of going
    // through Security settings first. The footer has no error line, so a
    // failure to send surfaces as a toast.
    async function startVerifyWithAnotherDevice() {
        try {
            await verifyWithAnotherDevice();
        } catch (e) {
            showErrorToast(
                e instanceof Error
                    ? e.message
                    : t("verification.couldNotSendVerificationRequest"),
            );
        }
    }
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
                onclick={() => openEncryptionSetup()}
                class="px-2 py-0.5 text-xs {toneClass} hover:underline"
            >
                {nudge.actionLabel}
            </button>
        {/if}
        {#if nudge.kind === "unverified"}
            <button
                onclick={startVerifyWithAnotherDevice}
                class="px-2 py-0.5 text-xs {toneClass} hover:underline whitespace-nowrap"
            >
                {t("verification.useAnotherDevice")}
            </button>
        {/if}
        <button
            onclick={dismissVerificationNudge}
            aria-label={t("profileFooter.dismiss")}
            class="text-discord-textMuted hover:text-discord-textPrimary text-sm"
        >
            <X size={14} />
        </button>
    </div>
{/if}

{#each sharing as entry (entry.id)}
    {@const art =
        entry.kind === "activity" ? entry.largeIconUrl : entry.coverUrl}
    {@const detail = entryDetail(entry)}
    <div
        class="w-full px-2 py-1.5 flex items-center gap-2 bg-discord-backgroundSecondary border-t border-discord-divider flex-shrink-0"
        title={t("richPresence.sharingTitle")}
    >
        {#if art}
            <img
                class="h-8 w-8 flex-shrink-0 rounded object-cover"
                src={mxcToHttp(art, 64, 64, "crop")}
                alt=""
            />
        {/if}
        <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-discord-textPrimary truncate">
                {entryName(entry)}
            </p>
            <p class="text-xs text-discord-textMuted truncate">
                {detail || t("richPresence.sharingTitle")}
            </p>
        </div>
    </div>
{/each}

<div
    class="w-full h-14 px-2 flex items-center gap-2 bg-discord-backgroundTertiary flex-shrink-0"
>
    <div class="flex-1 flex items-center gap-2 min-w-0">
        <!-- The profile card needs a room for power levels, and is mounted
             with the room view, so there is nothing to open without one. -->
        <button
            onclick={(e) => {
                if (auth.userId && roomsState.activeRoomId)
                    openProfileCard(auth.userId, e.currentTarget);
                else openAccountSwitcher();
            }}
            class="relative flex-shrink-0 rounded-full"
            title={roomsState.activeRoomId
                ? t("messageItem.viewProfile")
                : t("profileFooter.switchAccounts")}
        >
            <Avatar
                src={ownAvatarSrc}
                name={auth.userId
                    ? shownUserId(auth.userId, settingsState.streamerMode)
                    : "?"}
                id={auth.userId}
                size={32}
            />
            <div
                title={ownPresence.label}
                class="absolute bottom-0 end-0 w-3 h-3 {ownPresence.dotClass} rounded-full border-2 border-discord-backgroundTertiary"
            ></div>
        </button>
        <button
            onclick={openAccountSwitcher}
            class="flex-1 min-w-0 rounded p-1 -m-1 hover:bg-discord-messageHover transition-colors text-start"
            title={t("profileFooter.switchAccounts")}
        >
            <p
                class="text-sm font-semibold text-discord-textPrimary truncate streamer-hide"
            >
                {auth.userId
                    ? settingsState.streamerMode
                        ? aliasUserLocalpart(auth.userId)
                        : auth.userId.split(":")[0].replace("@", "")
                    : t("profileFooter.unknown")}
            </p>
            <p
                class="text-xs text-discord-textSecondary truncate streamer-hide"
            >
                {auth.userId
                    ? shownUserId(auth.userId, settingsState.streamerMode)
                    : ""}
            </p>
        </button>
    </div>
    <button
        onclick={onSettings}
        class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
        title={t("common.settings")}
        aria-label={t("common.settings")}
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

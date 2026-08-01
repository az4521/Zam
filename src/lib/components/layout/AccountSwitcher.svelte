<script lang="ts">
    import { goto } from "$app/navigation";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import Portal from "$lib/components/ui/Portal.svelte";
    import {
        accountsState,
        switchActive,
        removeAccountById,
    } from "$lib/stores/accounts.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { interfaceState, closeModal } from "$lib/stores/interface.svelte";
    import { leaveVoiceCall } from "$lib/matrix/client";
    import { deleteCryptoStore } from "$lib/matrix/crypto";
    import { clearAllNotificationSurfaces } from "$lib/utils/notificationSurfaces";

    interface Props {
        onClose: () => void;
        /** Existing app-shell logout flow (used for the active account). */
        onLogout: () => void;
    }
    let { onClose, onLogout }: Props = $props();

    // Two-click confirm for the destructive per-row sign-out.
    let confirmSignOutId = $state<string | null>(null);

    function serverHost(url: string): string {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }

    async function switchTo(userId: string): Promise<void> {
        if (userId === auth.userId) {
            onClose();
            return;
        }
        // The account we are leaving must not keep notifications on screen —
        // after the reload they would be sitting above a different account's
        // session with a deep link to a room it may not even be in. Before the
        // bounded leave below, so a hung leave cannot leave them up for three
        // seconds and then across the reload.
        clearAllNotificationSurfaces();
        // A hard reload would strand our MatrixRTC membership as a ghost
        // participant (up to 4h — no MSC4140 on continuwuity). Leave first,
        // bounded so a hung leave can't block the switch.
        await Promise.race([
            leaveVoiceCall(),
            new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
        switchActive(userId);
        // Full reload: the session-restore path boots the account with
        // clean stores (no cross-account state survives).
        window.location.assign("/");
    }

    function addAccount(): void {
        onClose();
        goto("/?add");
    }

    async function signOut(userId: string): Promise<void> {
        if (confirmSignOutId !== userId) {
            confirmSignOutId = userId;
            return;
        }
        confirmSignOutId = null;
        if (userId === auth.userId) {
            onClose();
            onLogout();
            return;
        }
        const account = accountsState.registry.accounts.find(
            (a) => a.userId === userId,
        );
        if (!account) return;
        // Best-effort server-side token invalidation (spec-compliant
        // servers drop the token's pushers with it). Local removal happens
        // regardless — the account leaves this device either way.
        try {
            await fetch(
                `${account.homeserverUrl.replace(/\/$/, "")}/_matrix/client/v3/logout`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${account.accessToken}`,
                    },
                },
            );
        } catch {
            // ignore — server unreachable; token stays valid server-side
        }
        // Wipe this account's rust-crypto store on its way off the device — it
        // has no live client, so we delete the IndexedDB directly (keyed to
        // this account, so it can't touch the active session's keys).
        await deleteCryptoStore(account.userId, account.deviceId);
        removeAccountById(userId);
    }
</script>

<Portal>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 {interfaceState.isTouchscreen
            ? 'bg-black/40'
            : ''}"
        onclick={closeModal}
    ></div>

    <div
        class="fixed z-50 bg-discord-backgroundSecondary border border-discord-divider shadow-xl {interfaceState.isTouchscreen
            ? 'inset-x-0 bottom-0 rounded-t-lg p-2 pb-4'
            : 'bottom-16 left-2 w-72 rounded-lg p-1.5'}"
    >
        <p
            class="px-2.5 py-1.5 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
        >
            Accounts
        </p>

        {#each accountsState.registry.accounts as account (account.userId)}
            {@const isActive = account.userId === auth.userId}
            <div
                class="group/account flex items-center gap-2 rounded hover:bg-discord-messageHover transition-colors"
            >
                <button
                    onclick={() => switchTo(account.userId)}
                    class="flex-1 flex items-center gap-2.5 p-2 min-w-0 text-left"
                >
                    <Avatar
                        src={account.avatarUrl ?? null}
                        name={account.displayName ?? account.userId}
                        id={account.userId}
                        size={32}
                    />
                    <span class="flex-1 min-w-0">
                        <span
                            class="block text-sm text-discord-textPrimary truncate"
                            >{account.displayName ?? account.userId}</span
                        >
                        <span
                            class="block text-xs text-discord-textMuted truncate"
                            >{serverHost(account.homeserverUrl)}</span
                        >
                    </span>
                    {#if isActive}
                        <svg
                            class="w-4 h-4 text-discord-accent flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2.5"
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    {/if}
                </button>
                <button
                    onclick={() => signOut(account.userId)}
                    class="flex-shrink-0 px-2 py-1 mr-1 rounded text-xs font-medium transition-colors {confirmSignOutId ===
                    account.userId
                        ? 'bg-discord-danger text-white'
                        : 'text-discord-textMuted hover:text-discord-danger opacity-0 group-hover/account:opacity-100'} {interfaceState.isTouchscreen
                        ? '!opacity-100'
                        : ''}"
                    title="Sign out {account.userId}"
                >
                    {confirmSignOutId === account.userId
                        ? "Confirm"
                        : "Sign out"}
                </button>
            </div>
        {/each}

        <div class="my-1 border-t border-discord-divider"></div>

        <button
            onclick={addAccount}
            class="w-full flex items-center gap-2.5 p-2 rounded hover:bg-discord-messageHover text-left transition-colors"
        >
            <span
                class="w-8 h-8 rounded-full bg-discord-backgroundTertiary flex items-center justify-center text-discord-accent text-lg font-bold flex-shrink-0"
                >+</span
            >
            <span class="text-sm text-discord-textPrimary">Add account</span>
        </button>
    </div>
</Portal>

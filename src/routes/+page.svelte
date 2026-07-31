<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import {
        reconnect,
        startSync,
        initServiceWorker,
        clearServiceWorkerAuth,
        stopClient,
        getClient,
    } from "$lib/matrix/client";
    import { unregisterPush } from "$lib/push";
    import { clearNativeSession } from "$lib/nativeSession";
    import {
        deleteCryptoStore,
        retryPendingCryptoWipes,
    } from "$lib/matrix/crypto";
    import {
        auth,
        saveSession,
        loadStoredSession,
        expireActiveSession,
    } from "$lib/stores/auth.svelte";
    import { accountsState, switchActive } from "$lib/stores/accounts.svelte";
    import { rootView, shouldRestoreSession } from "$lib/utils/sessionView";
    import AppShell from "$lib/components/layout/AppShell.svelte";
    import Splash from "$lib/components/layout/Splash.svelte";
    import LoginView from "$lib/components/layout/LoginView.svelte";

    // Add-account mode ("/?add"): reactive to the URL so an in-app SPA nav
    // (AccountSwitcher → goto("/?add")) flips it WITHOUT a route remount. It is
    // an orthogonal override of the view — force the login form even with a
    // running session so a second account can sign in.
    const isAddAccountMode = $derived(page.url.searchParams.has("add"));

    // Whether to silently restore is a BOOT-TIME decision, computed
    // synchronously at init (NOT in onMount) so the very FIRST render shows the
    // splash — never the login card — when a stored session exists. Reads
    // window.location directly (ssr=false → window exists at init).
    const addModeAtInit = new URLSearchParams(window.location.search).has(
        "add",
    );
    let restoring = $state(
        shouldRestoreSession({
            hasStoredSession: !!loadStoredSession(),
            isAddAccountMode: addModeAtInit,
        }),
    );

    const view = $derived(
        isAddAccountMode
            ? "login"
            : rootView({
                  isAuthenticated: auth.isAuthenticated,
                  restoring,
              }),
    );

    // Invoked when the homeserver rejects our token (M_UNKNOWN_TOKEN) — during
    // restore or later while the app is open. Tears down the dead session and
    // flips state back to the LOGIN view IN PLACE (no route hop, no redirect):
    // the reactive {#if} swaps AppShell → LoginView, and LoginView surfaces
    // auth.error on mount.
    function handleSessionExpired() {
        // Capture the expiring account's client + identity BEFORE teardown nulls
        // them, so we release its native/push/crypto resources the same way an
        // explicit logout does. Each call is guarded so a slow/throwing teardown
        // can NEVER block the return to login.
        const client = getClient();
        const expiringUserId = auth.userId;
        const expiringDeviceId = auth.deviceId;

        stopClient();
        clearServiceWorkerAuth();
        try {
            if (client) unregisterPush(client).catch(() => {});
        } catch {
            /* teardown must not block */
        }
        try {
            clearNativeSession().catch(() => {});
        } catch {
            /* teardown must not block */
        }
        try {
            if (expiringUserId && expiringDeviceId)
                deleteCryptoStore(expiringUserId, expiringDeviceId).catch(
                    () => {},
                );
        } catch {
            /* teardown must not block */
        }

        expireActiveSession();
        auth.error = "Your session has expired. Please sign in again.";
        restoring = false;
    }

    onMount(() => {
        // Finish any crypto-store wipe a previous logout could not complete
        // (another tab held the IndexedDB open, so the delete was blocked and
        // the reload won). Fire-and-forget: boot must never wait on it. Every
        // account still on this device is passed through so the sweep can
        // never delete a store that is still in use.
        retryPendingCryptoWipes(
            accountsState.registry.accounts.map((a) => ({
                userId: a.userId,
                deviceId: a.deviceId,
            })),
        ).catch(() => {});
        // The synchronous `restoring` flag already decided splash-vs-login for
        // the first paint; here we run the actual async restore when it applies.
        const stored = loadStoredSession();
        if (!restoring || !stored) return;
        (async () => {
            try {
                await reconnect(
                    stored.homeserverUrl,
                    stored.userId,
                    stored.accessToken,
                    stored.deviceId,
                );
                auth.userId = stored.userId;
                auth.homeserverUrl = stored.homeserverUrl;
                auth.accessToken = stored.accessToken;
                auth.deviceId = stored.deviceId;
                // AppShell mounts in place — NO goto.
                auth.isAuthenticated = true;
                restoring = false;
                initServiceWorker();
                await startSync((state) => {
                    auth.syncState = state;
                }, handleSessionExpired);
            } catch {
                auth.error = "Failed to reconnect. Please log in again.";
                restoring = false;
            }
        })();
    });

    // Login/register success (from LoginView). Mirror the restore path: flip
    // auth IN PLACE (saveSession sets auth.isAuthenticated=true → AppShell
    // mounts) then startSync — no goto. Add-account KEEPS the full-page reload
    // so no store state from the previous account survives the switch.
    async function handleAuthenticated(result: {
        userId: string;
        accessToken: string;
        deviceId: string;
        homeserverUrl: string;
    }) {
        saveSession({
            userId: result.userId,
            accessToken: result.accessToken,
            deviceId: result.deviceId,
            homeserverUrl: result.homeserverUrl,
        });

        if (isAddAccountMode) {
            window.location.assign("/");
            return;
        }
        initServiceWorker();
        await startSync((state) => {
            auth.syncState = state;
        }, handleSessionExpired);
    }

    // Switch to a dormant account: full reload boots it with clean stores.
    function continueAs(userId: string): void {
        switchActive(userId);
        window.location.assign("/");
    }

    function backToActive(): void {
        if (auth.isAuthenticated) {
            // SPA-entered add mode: the session is still running — drop "?add"
            // in place and the reactive view swaps back to the shell.
            goto("/");
        } else {
            // Full-page load of /?add: restore was skipped, so boot the active
            // account through the normal "/" restore path.
            window.location.assign("/");
        }
    }
</script>

{#if view === "shell"}
    <AppShell />
{:else if view === "splash"}
    <Splash />
{:else}
    <LoginView
        {isAddAccountMode}
        onAuthenticated={handleAuthenticated}
        onContinueAs={continueAs}
        onBackToActive={backToActive}
    />
{/if}

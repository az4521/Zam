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
        leaveVoiceCall,
    } from "$lib/matrix/client";
    import { unregisterPush } from "$lib/push";
    import { clearNativeSession } from "$lib/nativeSession";
    // The crypto-store delete helper is deliberately NOT imported here: session
    // expiry must never wipe the crypto store (user decision, 2026-07-30 — only
    // an explicit logout does), and sessionTeardown.test.ts asserts on this
    // file's source text to keep it that way. The boot retry below IS wanted: it
    // finishes a wipe that an explicit logout started and IndexedDB blocked.
    import { retryPendingCryptoWipes } from "$lib/matrix/crypto";
    import {
        auth,
        saveSession,
        loadStoredSession,
        expireActiveSession,
    } from "$lib/stores/auth.svelte";
    import { accountsState, switchActive } from "$lib/stores/accounts.svelte";
    import { rootView, shouldRestoreSession } from "$lib/utils/sessionView";
    import {
        IDLE_SESSION_STARTUP,
        isLiveAttempt,
        reduceSessionStartup,
        type SessionStartupState,
    } from "$lib/utils/sessionStartup";
    import { releaseSessionResources } from "$lib/utils/sessionTeardown";
    import AppShell from "$lib/components/layout/AppShell.svelte";
    import Splash from "$lib/components/layout/Splash.svelte";
    import LoginView from "$lib/components/layout/LoginView.svelte";

    const RESTORE_FAILED_MESSAGE = "Failed to reconnect. Please log in again.";
    const SYNC_START_FAILED_MESSAGE =
        "Signed in, but syncing could not start. Please try again.";
    const SESSION_EXPIRED_MESSAGE =
        "Your session has expired. Please sign in again.";

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

    // Startup is ONE transaction (audit AUTH-01): a login or restore only
    // becomes observable — AppShell mounted, account persisted — once sync is
    // actually running, and an attempt the app has moved past (expiry, or a
    // newer attempt) can never publish itself late. A plain `let`, not $state:
    // the guards below decide "did this apply?" by comparing state objects with
    // ===, and $state would hand back a reactive PROXY of the reducer's result
    // — identity survives that today, but if it ever stopped doing so both
    // guards would silently invert (a stale failure would stop a live
    // successor's client; a dead attempt would commit). Nothing renders this,
    // so it must not be reactive.
    let startup: SessionStartupState = IDLE_SESSION_STARTUP;

    // Disposer for the running sync's client listeners (LIFE-02). A plain
    // `let`, not $state — nothing renders it.
    let disposeSync: (() => void) | null = null;

    /** Open a startup transaction; the returned id tags its result. */
    function beginStartup(): number {
        startup = reduceSessionStartup(startup, { type: "begin" });
        return startup.attempt;
    }

    /**
     * Bind this attempt's sync listeners. Both entry points come through here,
     * so a previous session's listeners are always detached first — and an
     * attempt that was superseded while `startSync` ran disposes the listeners
     * it just created instead of publishing them, so a dead session can never
     * own `disposeSync`.
     */
    async function beginSync(attempt: number): Promise<void> {
        disposeSync?.();
        disposeSync = null;
        const dispose = await startSync((state) => {
            auth.syncState = state;
        }, handleSessionExpired);
        if (!isLiveAttempt(startup, attempt)) {
            dispose();
            return;
        }
        disposeSync = dispose;
    }

    /**
     * Roll a failed startup back. Returns false when the attempt had already
     * been superseded — the expiry teardown (or a newer attempt) owns the
     * client and the visible state, so we must not touch either.
     */
    function failStartup(attempt: number, message: string): boolean {
        const previous = startup;
        startup = reduceSessionStartup(startup, {
            type: "failed",
            attempt,
            error: message,
        });
        if (startup === previous) return false;
        disposeSync?.();
        disposeSync = null;
        // The client this attempt created never became the app's client.
        stopClient();
        return true;
    }

    /**
     * Publish a finished startup. `apply` runs only while this attempt is
     * still the live one, so a session that expired mid-startup is never
     * overwritten by the startup it outlived.
     */
    function commitStartup(attempt: number, apply: () => void): boolean {
        const previous = startup;
        startup = reduceSessionStartup(startup, { type: "succeeded", attempt });
        if (startup === previous) return false;
        apply();
        return true;
    }

    /**
     * Hand a failure to the ALREADY MOUNTED LoginView as a thrown error, and
     * take `auth.error` with it: that store field is a one-shot carrier read by
     * LoginView.onMount, so a value left behind here would surface at the next
     * sign-in instead.
     */
    function takeStartupError(fallback: string): string {
        const message = auth.error ?? startup.error ?? fallback;
        auth.error = null;
        return message;
    }

    // Invoked when the homeserver rejects our token (M_UNKNOWN_TOKEN) — during
    // restore or later while the app is open. Tears down the dead session and
    // flips state back to the LOGIN view IN PLACE (no route hop, no redirect):
    // the reactive {#if} swaps AppShell → LoginView, and LoginView surfaces
    // auth.error on mount. Stays SYNCHRONOUS: nothing here may be awaited.
    function handleSessionExpired() {
        // Capture the expiring account's client BEFORE teardown nulls it, so
        // its push registration can still be released.
        //
        // Its crypto store is NOT released here, and that is the point: expiry
        // is not a sign-out. See `sessionTeardown.ts` — a spurious
        // M_UNKNOWN_TOKEN must not destroy key material.
        const client = getClient();

        // Invalidate any startup in flight FIRST: one that resolves after this
        // must not publish the session we are tearing down.
        startup = reduceSessionStartup(startup, {
            type: "invalidated",
            error: SESSION_EXPIRED_MESSAGE,
        });

        releaseSessionResources({
            // The call goes first: it needs the live client, and leaving it
            // notifies the voice store, which only mirrors that while AppShell
            // is mounted — i.e. before the flip below (audit LIFE-01).
            leaveCall: () => leaveVoiceCall(),
            disposeSync: () => {
                disposeSync?.();
                disposeSync = null;
            },
            stopClient,
            clearServiceWorkerAuth,
            unregisterPush: () => (client ? unregisterPush(client) : undefined),
            clearNativeSession,
        });

        expireActiveSession();
        auth.error = SESSION_EXPIRED_MESSAGE;
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
        const attempt = beginStartup();
        (async () => {
            try {
                await reconnect(
                    stored.homeserverUrl,
                    stored.userId,
                    stored.accessToken,
                    stored.deviceId,
                );
                await beginSync(attempt);
            } catch {
                // A superseded attempt's owner already published its own state.
                if (failStartup(attempt, RESTORE_FAILED_MESSAGE)) {
                    auth.error = RESTORE_FAILED_MESSAGE;
                    restoring = false;
                }
                return;
            }
            // Sync is running: only NOW does the session become observable and
            // AppShell mount in place — NO goto.
            commitStartup(attempt, () => {
                auth.userId = stored.userId;
                auth.homeserverUrl = stored.homeserverUrl;
                auth.accessToken = stored.accessToken;
                auth.deviceId = stored.deviceId;
                auth.isAuthenticated = true;
                restoring = false;
                initServiceWorker();
            });
        })();
    });

    // Login/register success (from LoginView). Sync comes FIRST: saveSession is
    // both the persistence and the `isAuthenticated` flip, so running it before
    // startSync would persist an unusable session and unmount the only view
    // that can report the failure (audit AUTH-01). A rejection here is the
    // contract with LoginView's catch — it clears the form's spinner and shows
    // the message. Add-account KEEPS the full-page reload so no store state
    // from the previous account survives the switch.
    async function handleAuthenticated(result: {
        userId: string;
        accessToken: string;
        deviceId: string;
        homeserverUrl: string;
    }) {
        if (isAddAccountMode) {
            // No sync starts in this document: persisting and reloading IS the
            // switch, and the reload's restore path is the transaction.
            saveSession({
                userId: result.userId,
                accessToken: result.accessToken,
                deviceId: result.deviceId,
                homeserverUrl: result.homeserverUrl,
            });
            window.location.assign("/");
            return;
        }

        const attempt = beginStartup();
        try {
            await beginSync(attempt);
        } catch {
            failStartup(attempt, SYNC_START_FAILED_MESSAGE);
            throw new Error(takeStartupError(SYNC_START_FAILED_MESSAGE));
        }
        const committed = commitStartup(attempt, () => {
            saveSession({
                userId: result.userId,
                accessToken: result.accessToken,
                deviceId: result.deviceId,
                homeserverUrl: result.homeserverUrl,
            });
            initServiceWorker();
        });
        // Superseded mid-startup (the token was revoked while we were
        // starting): the form is still on screen, so tell it rather than
        // leaving its spinner running forever.
        if (!committed)
            throw new Error(takeStartupError(SESSION_EXPIRED_MESSAGE));
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

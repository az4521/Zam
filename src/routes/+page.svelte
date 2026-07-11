<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import {
        login,
        register,
        reconnect,
        startSync,
        initServiceWorker,
        clearServiceWorkerAuth,
        stopClient,
    } from "$lib/matrix/client";
    import {
        auth,
        saveSession,
        loadStoredSession,
        expireActiveSession,
        loadLastHomeserver,
    } from "$lib/stores/auth.svelte";
    import { accountsState, switchActive } from "$lib/stores/accounts.svelte";
    import { DEFAULT_HOMESERVER } from "$lib/config";
    import { requestWebPushPermission } from "$lib/webPush";
    import Avatar from "$lib/components/ui/Avatar.svelte";

    let homeserverUrl = $state(loadLastHomeserver() ?? DEFAULT_HOMESERVER);
    // "/?add": logging in an additional account — skip auto-restore and
    // offer a way back to the running session.
    let isAddAccountMode = $state(false);
    // Signed-in accounts offered by the "continue as" list (only rendered
    // when no account is active, e.g. after a session expiry).
    const dormantAccounts = $derived(
        accountsState.registry.activeUserId === null
            ? accountsState.registry.accounts
            : [],
    );
    let username = $state("");
    let password = $state("");
    let registrationToken = $state("");
    let isLoading = $state(false);
    let error = $state("");
    let statusMsg = $state("");
    let mode = $state<"login" | "register">("login");

    // Invoked when the homeserver rejects our token (M_UNKNOWN_TOKEN) — either
    // during restore or later while the app is open. Tears down the dead
    // session and returns the user to the login form with an explanation. The
    // message goes through the global auth store so it survives the redirect
    // from /app (which unmounts and remounts this page).
    function handleSessionExpired() {
        stopClient();
        clearServiceWorkerAuth();
        expireActiveSession();
        auth.error = "Your session has expired. Please sign in again.";
        isLoading = false;
        statusMsg = "";
        goto("/");
    }

    onMount(() => {
        // Surface a session-expiry message handed over via the auth store.
        if (auth.error) {
            error = auth.error;
            auth.error = null;
        }
        isAddAccountMode = new URLSearchParams(window.location.search).has(
            "add",
        );
        // Try to restore a previous session
        const stored = loadStoredSession();
        if (stored && !isAddAccountMode) {
            statusMsg = "Restoring session…";
            isLoading = true;
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
                    auth.isAuthenticated = true;
                    initServiceWorker();
                    goto("/app");

                    await startSync((state) => {
                        auth.syncState = state;
                        if (state === "ERROR" || state === "STOPPED") {
                            error = "Failed to reconnect. Please log in again.";
                        }
                    }, handleSessionExpired);
                } catch {
                    isLoading = false;
                    statusMsg = "";
                    error = "Failed to reconnect. Please log in again.";
                }
            })();
        }
    });

    async function afterAuth(result: {
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
            // Booting the new account through the normal restore path (full
            // page load) guarantees no store state from the previous
            // account survives the switch.
            window.location.assign("/");
            return;
        }
        initServiceWorker();
        statusMsg = "Syncing…";
        goto("/app");
        await startSync((state) => {
            auth.syncState = state;
            if (state === "ERROR") {
                isLoading = false;
                statusMsg = "";
                error = "Sync error. Check your connection.";
            }
        }, handleSessionExpired);
    }

    function continueAs(userId: string): void {
        switchActive(userId);
        window.location.assign("/");
    }

    async function handleLogin() {
        error = "";
        statusMsg = "";
        isLoading = true;

        try {
            await requestWebPushPermission().catch(() => {});

            let url = homeserverUrl.trim();
            if (!url.startsWith("http")) url = "https://" + url;
            url = url.replace(/\/$/, "");

            statusMsg = "Logging in…";
            const result = await login(url, username, password);
            await afterAuth(result);
        } catch (err) {
            error =
                err instanceof Error
                    ? err.message
                    : "Login failed. Check your credentials.";
            isLoading = false;
            statusMsg = "";
        }
    }

    async function handleRegister() {
        error = "";
        statusMsg = "";
        isLoading = true;

        try {
            await requestWebPushPermission().catch(() => {});

            let url = homeserverUrl.trim();
            if (!url.startsWith("http")) url = "https://" + url;
            url = url.replace(/\/$/, "");

            statusMsg = "Creating account…";
            const result = await register(
                url,
                username,
                password,
                registrationToken || undefined,
            );
            await afterAuth(result);
        } catch (err) {
            error = err instanceof Error ? err.message : "Registration failed.";
            isLoading = false;
            statusMsg = "";
        }
    }
</script>

<svelte:head>
    <title>Matrix Client — {mode === "login" ? "Sign In" : "Register"}</title>
</svelte:head>

<div
    class="flex items-center justify-center bg-discord-backgroundTertiary p-4"
    style="min-height: 100dvh;"
>
    <div class="w-full max-w-md">
        <!-- Card -->
        <div class="bg-discord-background rounded-lg shadow-2xl p-8">
            <!-- Header -->
            <div class="text-center mb-8">
                <div
                    class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-discord-accent mb-4"
                >
                    <span class="text-3xl font-bold text-white">#</span>
                </div>
                {#if mode === "login"}
                    <h1 class="text-2xl font-bold text-discord-textPrimary">
                        {isAddAccountMode ? "Add an account" : "Welcome back!"}
                    </h1>
                    <p class="text-discord-textSecondary mt-1">
                        {isAddAccountMode
                            ? "Sign in with another Matrix account"
                            : "Sign in to your Matrix account"}
                    </p>
                {:else}
                    <h1 class="text-2xl font-bold text-discord-textPrimary">
                        Create an account
                    </h1>
                    <p class="text-discord-textSecondary mt-1">
                        Register on a Matrix homeserver
                    </p>
                {/if}
            </div>

            <!-- Error banner -->
            {#if error}
                <div
                    class="mb-4 p-3 bg-discord-danger/10 border border-discord-danger/30 rounded-lg"
                >
                    <p class="text-discord-danger text-sm">{error}</p>
                </div>
            {/if}

            <!-- Status message -->
            {#if statusMsg && isLoading}
                <div
                    class="mb-4 p-3 bg-discord-accent/10 border border-discord-accent/30 rounded-lg flex items-center gap-3"
                >
                    <div
                        class="w-4 h-4 border-2 border-discord-accent border-t-transparent rounded-full animate-spin flex-shrink-0"
                    ></div>
                    <p class="text-discord-accent text-sm">{statusMsg}</p>
                </div>
            {/if}

            <!-- Form -->
            <form
                onsubmit={(e) => {
                    e.preventDefault();
                    mode === "login" ? handleLogin() : handleRegister();
                }}
                class="space-y-4"
            >
                <!-- Homeserver -->
                <div>
                    <label
                        for="server"
                        class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                    >
                        Homeserver
                    </label>
                    <input
                        id="server"
                        type="text"
                        bind:value={homeserverUrl}
                        placeholder={DEFAULT_HOMESERVER}
                        disabled={isLoading}
                        class="w-full px-3 py-2.5 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none transition-colors disabled:opacity-60 text-sm"
                        required
                    />
                </div>

                <!-- Username -->
                <div>
                    <label
                        for="username"
                        class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                    >
                        Username
                    </label>
                    <input
                        id="username"
                        type="text"
                        bind:value={username}
                        placeholder={mode === "login"
                            ? `@you:${new URL(DEFAULT_HOMESERVER).hostname}`
                            : "yourusername"}
                        disabled={isLoading}
                        class="w-full px-3 py-2.5 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none transition-colors disabled:opacity-60 text-sm"
                        required
                    />
                </div>

                <!-- Password -->
                <div>
                    <label
                        for="password"
                        class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                    >
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        bind:value={password}
                        placeholder="••••••••••"
                        disabled={isLoading}
                        class="w-full px-3 py-2.5 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none transition-colors disabled:opacity-60 text-sm"
                        required
                    />
                </div>

                <!-- Registration token (register mode only) -->
                {#if mode === "register"}
                    <div>
                        <label
                            for="token"
                            class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                        >
                            Registration Token <span
                                class="normal-case font-normal text-discord-textMuted"
                                >(if required)</span
                            >
                        </label>
                        <input
                            id="token"
                            type="text"
                            bind:value={registrationToken}
                            placeholder="Leave blank if not required"
                            disabled={isLoading}
                            class="w-full px-3 py-2.5 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none transition-colors disabled:opacity-60 text-sm"
                        />
                    </div>
                {/if}

                <button
                    type="submit"
                    disabled={isLoading || !username || !password}
                    class="w-full py-2.5 bg-discord-accent hover:bg-discord-accentHover text-white font-semibold rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm mt-2"
                >
                    {#if isLoading}
                        <span class="flex items-center justify-center gap-2">
                            <span
                                class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                            ></span>
                            {statusMsg || "Please wait…"}
                        </span>
                    {:else if mode === "login"}
                        Log In
                    {:else}
                        Create Account
                    {/if}
                </button>
            </form>

            <!-- Toggle mode -->
            <div class="mt-5 text-center">
                {#if mode === "login"}
                    <p class="text-sm text-discord-textMuted">
                        Don't have an account?
                        <button
                            onclick={() => {
                                mode = "register";
                                error = "";
                            }}
                            class="text-discord-accent hover:underline font-medium"
                        >
                            Register
                        </button>
                    </p>
                {:else}
                    <p class="text-sm text-discord-textMuted">
                        Already have an account?
                        <button
                            onclick={() => {
                                mode = "login";
                                error = "";
                            }}
                            class="text-discord-accent hover:underline font-medium"
                        >
                            Sign in
                        </button>
                    </p>
                {/if}
            </div>

            {#if isAddAccountMode && accountsState.registry.activeUserId}
                <div class="mt-3 text-center">
                    <a
                        href="/app"
                        class="text-sm text-discord-accent hover:underline font-medium"
                        >← Back to {accountsState.registry.activeUserId}</a
                    >
                </div>
            {/if}

            {#if dormantAccounts.length > 0}
                <div class="mt-5 pt-4 border-t border-discord-divider">
                    <p
                        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                    >
                        Or continue as
                    </p>
                    <div class="space-y-1">
                        {#each dormantAccounts as account (account.userId)}
                            <button
                                onclick={() => continueAs(account.userId)}
                                disabled={isLoading}
                                class="w-full flex items-center gap-2.5 p-2 rounded bg-discord-backgroundSecondary hover:bg-discord-messageHover text-left transition-colors disabled:opacity-50"
                            >
                                <Avatar
                                    src={account.avatarUrl ?? null}
                                    name={account.displayName ?? account.userId}
                                    id={account.userId}
                                    size={28}
                                />
                                <span class="flex-1 min-w-0">
                                    <span
                                        class="block text-sm text-discord-textPrimary truncate"
                                        >{account.displayName ??
                                            account.userId}</span
                                    >
                                    <span
                                        class="block text-xs text-discord-textMuted truncate"
                                        >{account.userId}</span
                                    >
                                </span>
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}

            <p
                class="text-center text-xs text-discord-textMuted mt-4 leading-relaxed"
            >
                Your credentials are sent directly to your homeserver and never
                stored by this app beyond your device.
            </p>
        </div>
    </div>
</div>

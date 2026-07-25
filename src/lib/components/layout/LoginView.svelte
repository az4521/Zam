<script lang="ts">
    import { onMount } from "svelte";
    import { login, register } from "$lib/matrix/client";
    import { auth, loadLastHomeserver } from "$lib/stores/auth.svelte";
    import { accountsState } from "$lib/stores/accounts.svelte";
    import { getDefaultHomeserver } from "$lib/config";
    import { parseLoginUsername } from "$lib/utils/loginIdentity";
    import { requestWebPushPermission } from "$lib/webPush";
    import Avatar from "$lib/components/ui/Avatar.svelte";

    interface Props {
        isAddAccountMode: boolean;
        onAuthenticated: (result: {
            userId: string;
            accessToken: string;
            deviceId: string;
            homeserverUrl: string;
        }) => void | Promise<void>;
        onContinueAs: (userId: string) => void;
        onBackToActive: () => void;
    }
    let {
        isAddAccountMode,
        onAuthenticated,
        onContinueAs,
        onBackToActive,
    }: Props = $props();

    const defaultHomeserver = getDefaultHomeserver();
    let homeserverUrl = $state(loadLastHomeserver() ?? defaultHomeserver);
    // Signed-in accounts offered by the "continue as" list (only when no
    // account is active, e.g. after a session expiry).
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

    onMount(() => {
        // Surface a session-expiry / restore-failure message handed over via the
        // auth store (expiry now flips state in place — no route hop — so the
        // store is only a one-shot display carrier here).
        if (auth.error) {
            error = auth.error;
            auth.error = null;
        }
    });

    // Let the user type a full "@user:homeserver" MXID — split it into the bare
    // username and auto-fill the homeserver (mirrors the pre-merge login form).
    function applyFullUserId(): string {
        const parsed = parseLoginUsername(username);
        username = parsed.username;
        if (parsed.homeserver) homeserverUrl = parsed.homeserver;
        return parsed.username;
    }

    async function handleLogin() {
        error = "";
        statusMsg = "";
        isLoading = true;
        try {
            const loginUsername = applyFullUserId();
            await requestWebPushPermission().catch(() => {});
            let url = homeserverUrl.trim();
            if (!url.startsWith("http")) url = "https://" + url;
            url = url.replace(/\/$/, "");
            statusMsg = "Logging in…";
            const result = await login(url, loginUsername, password);
            await onAuthenticated(result);
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
            const registrationUsername = applyFullUserId();
            await requestWebPushPermission().catch(() => {});
            let url = homeserverUrl.trim();
            if (!url.startsWith("http")) url = "https://" + url;
            url = url.replace(/\/$/, "");
            statusMsg = "Creating account…";
            const result = await register(
                url,
                registrationUsername,
                password,
                registrationToken || undefined,
            );
            await onAuthenticated(result);
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
                        placeholder={defaultHomeserver}
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
                        onblur={applyFullUserId}
                        placeholder={mode === "login"
                            ? `@you:${new URL(defaultHomeserver).hostname}`
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
                    <button
                        onclick={onBackToActive}
                        class="text-sm text-discord-accent hover:underline font-medium"
                        >← Back to {accountsState.registry.activeUserId}</button
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
                                onclick={() => onContinueAs(account.userId)}
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

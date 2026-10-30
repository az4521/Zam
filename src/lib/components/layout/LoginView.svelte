<script lang="ts">
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import { page } from "$app/state";
    import { replaceState } from "$app/navigation";
    import {
        login,
        register,
        getLoginOptions,
        loginWithOAuthCode,
        loginWithSsoToken,
        probeRegistration,
        checkUsernameAvailable,
    } from "$lib/matrix/client";
    import {
        RegistrationCancelledError,
        flowNeedsToken,
        usernameIssue,
        type RegistrationPrompt,
        type RegistrationSupport,
    } from "$lib/matrix/registration";
    import { rememberSignInPassword } from "$lib/stores/onboarding.svelte";
    import {
        beginSsoLogin,
        hasSsoParams,
        readSsoCallback,
        withoutSsoParams,
    } from "$lib/matrix/sso";
    import {
        OAuthRegistrationRefusedError,
        beginOAuthLogin,
        hasOAuthParams,
        readOAuthCallback,
        withoutOAuthParams,
        type OAuthCallback,
    } from "$lib/matrix/oauth";
    import {
        listenForLoginCallbacks,
        loginLeavesPage,
    } from "$lib/matrix/loginRedirect";
    import type { ValidatedAuthMetadata } from "matrix-js-sdk";
    import { pickSignInMethod, type LoginOptions } from "$lib/utils/loginFlows";
    import { auth, loadLastHomeserver } from "$lib/stores/auth.svelte";
    import { accountsState } from "$lib/stores/accounts.svelte";
    import {
        getDefaultHomeserver,
        INSTALLED_APP_DEFAULT_HOMESERVER as PUBLIC_HOMESERVER,
    } from "$lib/config";
    import { parseLoginUsername } from "$lib/utils/loginIdentity";
    import { requestWebPushPermission } from "$lib/webPush";
    import AccountAvatar from "$lib/components/layout/AccountAvatar.svelte";
    import { Capacitor } from "@capacitor/core";

    interface Props {
        isAddAccountMode: boolean;
        onAuthenticated: (result: {
            userId: string;
            accessToken: string;
            deviceId: string;
            homeserverUrl: string;
            refreshToken?: string;
            oauth?: { clientId: string; issuer: string };
            accessTokenExpiresAt?: number;
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
    let confirmPassword = $state("");
    let registrationToken = $state("");
    let isLoading = $state(false);
    let error = $state("");
    let statusMsg = $state("");
    let mode = $state<"login" | "register">("login");
    // On by default: servers without sliding sync fall back to regular sync
    // on first start (see buildSlidingSync in client.ts).
    let useSlidingSync = $state(true);
    // Non-blocking note while an SSO flow runs in another window (desktop /
    // Android), where this form stays usable in case the user abandons it.
    let ssoHint = $state("");

    function hostOf(value: string): string {
        return value
            .trim()
            .replace(/^https?:\/\//, "")
            .replace(/\/.*$/, "")
            .toLowerCase();
    }
    // A server that is closed to sign-ups offers matrix.org instead.
    function usePublicServer() {
        if (isLoading) return;
        homeserverUrl = PUBLIC_HOMESERVER;
        error = "";
        void refreshLoginOptions();
    }
    // Sliding sync and other knobs most people never need to touch.
    let showAdvanced = $state(false);

    // Sign-in methods the typed homeserver offers (GET /login). null = not
    // known (yet, or the lookup failed): the password form is shown then.
    let loginOptions = $state<LoginOptions | null>(null);
    let optionsBaseUrl = $state("");
    // The homeserver's native OAuth metadata, when it publishes any. Sign-in
    // goes through it when present; the password and SSO paths are the
    // fallback for servers without it (or that refused to register this app).
    let oauthMeta = $state<ValidatedAuthMetadata | null>(null);
    let oauthRefused = $state(false);
    let optionsFor = $state("");
    let optionsLoading = $state(false);
    let optionsRequest = 0;
    let redeemingSso = false;

    const signInMethod = $derived(
        pickSignInMethod(oauthRefused ? null : oauthMeta),
    );
    const useOAuth = $derived(signInMethod === "oauth");
    const showPasswordForm = $derived(
        !useOAuth &&
            (mode === "register" || !loginOptions || loginOptions.password),
    );
    const sso = $derived(useOAuth ? null : (loginOptions?.sso ?? null));
    // The shown sign-in options belong to the address in the field. Until a
    // changed address has been looked up, Log In and SSO stay disabled so
    // neither can act on the previous server's answer.
    const optionsCurrent = $derived(
        !optionsLoading && homeserverUrl.trim() === optionsFor,
    );
    // The server's name as typed (matrix.org), not the API host its
    // well-known delegates to (matrix-client.matrix.org): it is the part
    // after the colon in user ids, and the name people know.
    const serverHost = $derived(hostOf(optionsFor || homeserverUrl));
    // Where an OAuth server's sign-in page lives, named on its button.
    const providerHost = $derived(oauthMeta ? hostOf(oauthMeta.issuer) : "");

    // ── Registration (legacy /register; OAuth servers sign up on their page) ──
    // What the server allows, probed once per server while in register mode.
    let regSupport = $state<RegistrationSupport | null>(null);
    let regSupportFor = "";
    $effect(() => {
        if (mode !== "register" || useOAuth || !optionsCurrent) return;
        const base = optionsBaseUrl;
        if (!base || base === regSupportFor) return;
        regSupportFor = base;
        regSupport = null;
        void probeRegistration(base).then((support) => {
            if (optionsBaseUrl === base) regSupport = support;
        });
    });
    const registrationClosed = $derived(
        mode === "register" && !useOAuth && regSupport?.kind === "closed",
    );
    // The token field only when the server's flow needs one (or we can't tell).
    const showTokenField = $derived(
        regSupport?.kind === "open"
            ? flowNeedsToken(regSupport.flow) || regSupport.needsToken
            : true,
    );
    const tokenRequired = $derived(
        regSupport?.kind === "open" && regSupport.needsToken,
    );

    // Username availability, checked as the user types (register mode).
    let nameCheck = $state<{
        name: string;
        available: boolean | null;
        issue?: string;
    } | null>(null);
    const localUsernameIssue = $derived(
        mode === "register" ? usernameIssue(username.trim()) : null,
    );
    $effect(() => {
        const name = username.trim();
        const base = optionsBaseUrl;
        if (
            mode !== "register" ||
            useOAuth ||
            !optionsCurrent ||
            !base ||
            !name ||
            name.startsWith("@") ||
            usernameIssue(name)
        ) {
            nameCheck = null;
            return;
        }
        const timer = setTimeout(() => {
            void checkUsernameAvailable(base, name).then((r) => {
                if (username.trim() === name && optionsBaseUrl === base)
                    nameCheck = { name, ...r };
            });
        }, 500);
        return () => clearTimeout(timer);
    });
    const nameTaken = $derived(
        nameCheck?.name === username.trim() && nameCheck.available === false,
    );
    const passwordsMismatch = $derived(
        mode === "register" &&
            confirmPassword.length > 0 &&
            confirmPassword !== password,
    );
    const canSubmitPasswordForm = $derived(
        !!username &&
            !!password &&
            (mode === "login" ||
                (confirmPassword === password &&
                    !localUsernameIssue &&
                    !nameTaken &&
                    !registrationClosed &&
                    (!tokenRequired || !!registrationToken.trim()))),
    );

    // A registration step waiting on the user (token, terms, captcha,
    // email). `resolve` hands the answer back to runRegistration.
    let stage = $state<{
        prompt: RegistrationPrompt;
        resolve: (answer: string | null) => void;
    } | null>(null);
    let stageToken = $state("");
    let stageAccepted = $state(false);
    let stageEmail = $state("");
    let stageEmailSent = $state(false);
    let stageBusy = $state(false);
    let stageError = $state("");

    function promptStage(prompt: RegistrationPrompt): Promise<string | null> {
        return new Promise((resolve) => {
            stageToken = "";
            stageAccepted = false;
            stageEmailSent = prompt.kind === "email" && prompt.sent;
            stageBusy = false;
            stageError = "";
            stage = { prompt, resolve };
        });
    }
    function answerStage(answer: string | null) {
        const pending = stage;
        stage = null;
        pending?.resolve(answer);
    }
    async function sendStageEmail() {
        const prompt = stage?.prompt;
        if (prompt?.kind !== "email" || !stageEmail.trim() || stageBusy) return;
        stageBusy = true;
        stageError = "";
        try {
            await prompt.requestToken(stageEmail.trim());
            stageEmailSent = true;
        } catch (err) {
            stageError =
                err instanceof Error
                    ? err.message
                    : t("loginView.registrationFailed");
        } finally {
            stageBusy = false;
        }
    }
    // Leaving the form mid-step must not strand the registration promise.
    onMount(() => () => answerStage(null));

    async function refreshLoginOptions(): Promise<void> {
        const typed = homeserverUrl.trim();
        if (!typed || typed === optionsFor) return;
        const request = ++optionsRequest;
        optionsFor = typed;
        optionsLoading = true;
        try {
            const { baseUrl, options, oauth } = await getLoginOptions(typed);
            if (request !== optionsRequest) return;
            loginOptions = options;
            oauthMeta = oauth;
            oauthRefused = false;
            optionsBaseUrl = baseUrl;
        } catch {
            if (request !== optionsRequest) return;
            // Unknown: fall back to the password form. optionsFor keeps the
            // failed address so it is only retried once the field changes.
            loginOptions = null;
            oauthMeta = null;
            optionsBaseUrl = "";
        } finally {
            if (request === optionsRequest) optionsLoading = false;
        }
    }

    // Re-read the sign-in methods as the homeserver field settles.
    $effect(() => {
        const typed = homeserverUrl.trim();
        if (typed === optionsFor) return;
        const timer = setTimeout(() => void refreshLoginOptions(), 600);
        return () => clearTimeout(timer);
    });

    function setMode(next: "login" | "register") {
        mode = next;
        error = "";
        confirmPassword = "";
    }

    async function startOAuth() {
        if (!oauthMeta || !optionsBaseUrl || !optionsCurrent || isLoading)
            return;
        error = "";
        void requestWebPushPermission().catch(() => {});
        isLoading = true;
        statusMsg = t("loginView.redirectingToSso");
        try {
            await beginOAuthLogin({
                baseUrl: optionsBaseUrl,
                metadata: oauthMeta,
                register: mode === "register",
                slidingSync: useSlidingSync,
            });
        } catch (err) {
            isLoading = false;
            statusMsg = "";
            if (err instanceof OAuthRegistrationRefusedError) {
                // Fall back to whatever the server still offers.
                oauthRefused = true;
                error =
                    loginOptions?.password || loginOptions?.sso
                        ? t("loginView.oauthRegistrationRefusedFallback")
                        : t("loginView.oauthRegistrationRefused");
            } else {
                console.warn("[oauth] could not start sign-in", err);
                error = t("loginView.oauthFailed");
            }
            return;
        }
        if (!loginLeavesPage()) {
            // The provider opened in another window; keep the form usable in
            // case the user abandons it.
            isLoading = false;
            statusMsg = "";
            ssoHint = t("loginView.finishSsoInBrowser");
        }
    }

    function startSso(idpId?: string) {
        if (!sso || !optionsBaseUrl || !optionsCurrent) return;
        error = "";
        void requestWebPushPermission().catch(() => {});
        const leavesPage =
            !window.desktop?.sso && !Capacitor.isNativePlatform();
        try {
            beginSsoLogin({
                baseUrl: optionsBaseUrl,
                loginType: sso.loginType,
                idpId,
                register: mode === "register",
                slidingSync: useSlidingSync,
                addMode: isAddAccountMode,
            });
        } catch (err) {
            error =
                err instanceof Error ? err.message : t("loginView.ssoFailed");
            return;
        }
        if (leavesPage) {
            isLoading = true;
            statusMsg = t("loginView.redirectingToSso");
        } else {
            ssoHint = t("loginView.finishSsoInBrowser");
        }
    }

    // Drop the sign-in result (loginToken / sso_state, or the OAuth code /
    // state) from the address bar (web) so a reload or a bookmark never
    // replays it.
    function stripSsoParamsFromUrl() {
        const here = new URL(window.location.href);
        if (!hasSsoParams(here) && !hasOAuthParams(here)) return;
        const clean = withoutOAuthParams(withoutSsoParams(here));
        try {
            replaceState(clean, page.state);
        } catch {
            history.replaceState(history.state, "", clean);
        }
    }

    async function handleSsoCallback(rawUrl: string) {
        const result = readSsoCallback(rawUrl);
        stripSsoParamsFromUrl();
        if (!result) return;
        ssoHint = "";
        if (result.kind === "invalid") {
            error = t("loginView.ssoCouldNotBeVerified");
            return;
        }
        if (redeemingSso) return;
        redeemingSso = true;
        error = "";
        isLoading = true;
        statusMsg = t("loginView.loggingIn");
        homeserverUrl = result.pending.baseUrl;
        try {
            const session = await loginWithSsoToken(
                result.pending.baseUrl,
                result.loginToken,
                result.pending.slidingSync,
            );
            await onAuthenticated(session);
        } catch (err) {
            error =
                err instanceof Error ? err.message : t("loginView.ssoFailed");
            isLoading = false;
            statusMsg = "";
        } finally {
            redeemingSso = false;
        }
    }

    async function handleOAuthResult(result: OAuthCallback) {
        ssoHint = "";
        if (result.kind === "invalid") {
            error = t("loginView.oauthCouldNotBeVerified");
            return;
        }
        // Back on the server the attempt started on, so a retry needs no retyping.
        homeserverUrl = result.pending.baseUrl;
        if (result.kind === "denied") {
            error =
                result.error === "access_denied"
                    ? t("loginView.oauthCancelled")
                    : t("loginView.oauthDenied", {
                          reason: result.description || result.error,
                      });
            return;
        }
        if (redeemingSso) return;
        redeemingSso = true;
        error = "";
        isLoading = true;
        statusMsg = t("loginView.loggingIn");
        try {
            let session;
            try {
                session = await loginWithOAuthCode(result.pending, result.code);
            } catch (err) {
                console.warn("[oauth] sign-in failed", err);
                error = t("loginView.oauthFailed");
                isLoading = false;
                statusMsg = "";
                return;
            }
            try {
                await onAuthenticated(session);
            } catch (err) {
                error =
                    err instanceof Error
                        ? err.message
                        : t("loginView.oauthFailed");
                isLoading = false;
                statusMsg = "";
            }
        } finally {
            redeemingSso = false;
        }
    }

    function handleLoginCallback(rawUrl: string) {
        const oauthResult = readOAuthCallback(rawUrl);
        if (oauthResult) {
            stripSsoParamsFromUrl();
            void handleOAuthResult(oauthResult);
            return;
        }
        void handleSsoCallback(rawUrl);
    }

    onMount(() => {
        // Surface a session-expiry / restore-failure message handed over via the
        // auth store (expiry now flips state in place — no route hop — so the
        // store is only a one-shot display carrier here).
        if (auth.error) {
            error = auth.error;
            auth.error = null;
        }
        void refreshLoginOptions();
        return listenForLoginCallbacks(
            handleLoginCallback,
            (url) => hasSsoParams(url) || hasOAuthParams(url),
        );
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
            // Fire-and-forget: the notification/web-push permission prompt must
            // never block sign-in (awaiting it hangs login until the user
            // answers the prompt — or forever if they don't).
            void requestWebPushPermission().catch(() => {});
            let url = homeserverUrl.trim();
            if (!url.startsWith("http")) url = "https://" + url;
            url = url.replace(/\/$/, "");
            statusMsg = t("loginView.loggingIn");
            const result = await login(
                url,
                loginUsername,
                password,
                useSlidingSync,
            );
            rememberSignInPassword(result.userId, password);
            await onAuthenticated(result);
        } catch (err) {
            error =
                err instanceof Error
                    ? err.message
                    : t("loginView.loginFailedCheckYourCredentials");
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
            void requestWebPushPermission().catch(() => {});
            let url = homeserverUrl.trim();
            if (!url.startsWith("http")) url = "https://" + url;
            url = url.replace(/\/$/, "");
            statusMsg = t("loginView.creatingAccount");
            const result = await register(url, registrationUsername, password, {
                registrationToken: registrationToken || undefined,
                slidingSync: useSlidingSync,
                prompt: promptStage,
            });
            statusMsg = t("loginView.loggingIn");
            rememberSignInPassword(result.userId, password);
            await onAuthenticated(result);
        } catch (err) {
            stage = null;
            error =
                err instanceof RegistrationCancelledError
                    ? ""
                    : err instanceof Error
                      ? err.message
                      : t("loginView.registrationFailed");
            isLoading = false;
            statusMsg = "";
        }
    }
</script>

<svelte:head>
    <title
        >{t("loginView.zam", {
            value:
                mode === "login"
                    ? t("loginView.signIn")
                    : t("loginView.register"),
        })}</title
    >
</svelte:head>

<div
    class="flex items-center justify-center bg-discord-backgroundTertiary p-4"
    style="min-height: 100vh; min-height: 100dvh;"
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
                        {isAddAccountMode
                            ? t("loginView.addAnAccount")
                            : t("loginView.welcomeBack")}
                    </h1>
                    <p class="text-discord-textSecondary mt-1">
                        {isAddAccountMode
                            ? t("loginView.signInWithAnotherMatrixAccount")
                            : t("loginView.signInToYourMatrixAccount")}
                    </p>
                {:else}
                    <h1 class="text-2xl font-bold text-discord-textPrimary">
                        {t("loginView.createAnAccount")}
                    </h1>
                    <p class="text-discord-textSecondary mt-1">
                        {t("loginView.registerOnAMatrixHomeserver")}
                    </p>
                {/if}
            </div>

            <!-- Error banner -->
            {#if error}
                <div
                    id="login-error"
                    role="alert"
                    class="mb-4 p-3 bg-discord-danger/10 border border-discord-danger/30 rounded-lg"
                >
                    <p class="text-discord-danger text-sm">{error}</p>
                </div>
            {/if}

            <!-- Status message -->
            {#if statusMsg && isLoading}
                <div
                    role="status"
                    class="mb-4 p-3 bg-discord-accent/10 border border-discord-accent/30 rounded-lg flex items-center gap-3"
                >
                    <div
                        aria-hidden="true"
                        class="w-4 h-4 border-2 border-discord-accent border-t-transparent rounded-full animate-spin flex-shrink-0"
                    ></div>
                    <p class="text-discord-accent text-sm">{statusMsg}</p>
                </div>
            {/if}

            <!-- A registration step the server asked for. Replaces the form
                 until answered: the form's values are mid-submission. -->
            {#if stage}
                {@const prompt = stage.prompt}
                <div
                    class="space-y-3 p-4 rounded-lg bg-discord-backgroundSecondary border border-discord-divider"
                    role="group"
                    aria-labelledby="reg-stage-title"
                >
                    {#if prompt.kind === "token"}
                        <p
                            id="reg-stage-title"
                            class="text-sm font-semibold text-discord-textPrimary"
                        >
                            {t("registration.tokenTitle")}
                        </p>
                        <p
                            class="text-xs {prompt.retry
                                ? 'text-discord-danger'
                                : 'text-discord-textMuted'}"
                        >
                            {prompt.retry
                                ? t("registration.invalidToken")
                                : t("registration.tokenBody", {
                                      server: serverHost,
                                  })}
                        </p>
                        <input
                            type="text"
                            bind:value={stageToken}
                            autocomplete="off"
                            spellcheck="false"
                            placeholder={t("loginView.registrationToken")}
                            onkeydown={(e) => {
                                if (e.key === "Enter" && stageToken.trim()) {
                                    e.preventDefault();
                                    answerStage(stageToken.trim());
                                }
                            }}
                            class="w-full px-3 py-2.5 bg-discord-background text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm"
                        />
                        <div class="flex gap-2">
                            <button
                                type="button"
                                onclick={() => answerStage(stageToken.trim())}
                                disabled={!stageToken.trim()}
                                class="flex-1 py-2 bg-discord-accent hover:bg-discord-accentHover text-white font-semibold rounded text-sm disabled:opacity-60"
                                >{t("loginView.continue")}</button
                            >
                            <button
                                type="button"
                                onclick={() => answerStage(null)}
                                class="px-4 py-2 bg-discord-messageHover text-discord-textPrimary rounded text-sm"
                                >{t("common.cancel")}</button
                            >
                        </div>
                    {:else if prompt.kind === "terms"}
                        <p
                            id="reg-stage-title"
                            class="text-sm font-semibold text-discord-textPrimary"
                        >
                            {t("registration.termsTitle")}
                        </p>
                        <p class="text-xs text-discord-textMuted">
                            {t("registration.termsBody", {
                                server: serverHost,
                            })}
                        </p>
                        <ul class="space-y-1">
                            {#each prompt.policies as policy (policy.id)}
                                <li>
                                    <a
                                        href={policy.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="text-sm text-discord-accent hover:underline"
                                        >{policy.name}</a
                                    >
                                </li>
                            {/each}
                        </ul>
                        <label
                            class="flex items-start gap-2 text-sm text-discord-textSecondary cursor-pointer"
                        >
                            <input
                                type="checkbox"
                                bind:checked={stageAccepted}
                                class="mt-0.5 w-4 h-4 accent-discord-accent"
                            />
                            <span>{t("registration.termsAccept")}</span>
                        </label>
                        <div class="flex gap-2">
                            <button
                                type="button"
                                onclick={() => answerStage("accepted")}
                                disabled={!stageAccepted}
                                class="flex-1 py-2 bg-discord-accent hover:bg-discord-accentHover text-white font-semibold rounded text-sm disabled:opacity-60"
                                >{t("loginView.continue")}</button
                            >
                            <button
                                type="button"
                                onclick={() => answerStage(null)}
                                class="px-4 py-2 bg-discord-messageHover text-discord-textPrimary rounded text-sm"
                                >{t("common.cancel")}</button
                            >
                        </div>
                    {:else if prompt.kind === "email"}
                        <p
                            id="reg-stage-title"
                            class="text-sm font-semibold text-discord-textPrimary"
                        >
                            {t("registration.emailTitle")}
                        </p>
                        {#if !stageEmailSent}
                            <p class="text-xs text-discord-textMuted">
                                {t("registration.emailBody", {
                                    server: serverHost,
                                })}
                            </p>
                            <input
                                type="email"
                                bind:value={stageEmail}
                                autocomplete="email"
                                placeholder={t("registration.emailPlaceholder")}
                                disabled={stageBusy}
                                onkeydown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        void sendStageEmail();
                                    }
                                }}
                                class="w-full px-3 py-2.5 bg-discord-background text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm disabled:opacity-60"
                            />
                            <div class="flex gap-2">
                                <button
                                    type="button"
                                    onclick={sendStageEmail}
                                    disabled={!stageEmail.trim() || stageBusy}
                                    class="flex-1 py-2 bg-discord-accent hover:bg-discord-accentHover text-white font-semibold rounded text-sm disabled:opacity-60"
                                    >{stageBusy
                                        ? t("loginView.pleaseWait")
                                        : t("registration.sendEmail")}</button
                                >
                                <button
                                    type="button"
                                    onclick={() => answerStage(null)}
                                    class="px-4 py-2 bg-discord-messageHover text-discord-textPrimary rounded text-sm"
                                    >{t("common.cancel")}</button
                                >
                            </div>
                        {:else}
                            <p
                                class="text-xs {prompt.sent
                                    ? 'text-discord-warning'
                                    : 'text-discord-textMuted'}"
                            >
                                {prompt.sent
                                    ? t("registration.emailNotConfirmed")
                                    : t("registration.emailSent", {
                                          email: stageEmail.trim(),
                                      })}
                            </p>
                            <div class="flex gap-2">
                                <button
                                    type="button"
                                    onclick={() => answerStage("confirmed")}
                                    class="flex-1 py-2 bg-discord-accent hover:bg-discord-accentHover text-white font-semibold rounded text-sm"
                                    >{t("registration.emailConfirmed")}</button
                                >
                                <button
                                    type="button"
                                    onclick={() => answerStage(null)}
                                    class="px-4 py-2 bg-discord-messageHover text-discord-textPrimary rounded text-sm"
                                    >{t("common.cancel")}</button
                                >
                            </div>
                        {/if}
                    {:else}
                        <p
                            id="reg-stage-title"
                            class="text-sm font-semibold text-discord-textPrimary"
                        >
                            {prompt.stage === "m.login.recaptcha"
                                ? t("registration.captchaTitle")
                                : t("registration.fallbackTitle")}
                        </p>
                        <p class="text-xs text-discord-textMuted">
                            {prompt.stage === "m.login.recaptcha"
                                ? t("registration.captchaBody", {
                                      server: serverHost,
                                  })
                                : t("registration.fallbackBody", {
                                      server: serverHost,
                                  })}
                        </p>
                        <div class="flex flex-wrap gap-2">
                            <!-- A real link so it opens from the click itself:
                                 the system browser in Electron, a tab on web. -->
                            <a
                                href={prompt.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="px-4 py-2 bg-discord-accent hover:bg-discord-accentHover text-white font-semibold rounded text-sm"
                                >{t("registration.openStepPage")}</a
                            >
                            <button
                                type="button"
                                onclick={() => answerStage("done")}
                                class="px-4 py-2 bg-discord-messageHover text-discord-textPrimary rounded text-sm"
                                >{t("registration.stepDone")}</button
                            >
                            <button
                                type="button"
                                onclick={() => answerStage(null)}
                                class="px-4 py-2 text-discord-textMuted hover:text-discord-textPrimary text-sm"
                                >{t("common.cancel")}</button
                            >
                        </div>
                    {/if}
                    {#if stageError}
                        <p class="text-sm text-discord-danger" role="alert">
                            {stageError}
                        </p>
                    {/if}
                </div>
            {/if}

            <!-- Form -->
            <form
                hidden={!!stage}
                onsubmit={(e) => {
                    e.preventDefault();
                    if (!optionsCurrent) return;
                    if (useOAuth) {
                        void startOAuth();
                        return;
                    }
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
                        {t("loginView.homeserver")}
                    </label>
                    <!-- The lookup spinner sits inside the field so it never
                         shifts the form below. -->
                    <div class="relative">
                        <input
                            id="server"
                            type="text"
                            bind:value={homeserverUrl}
                            onblur={() => void refreshLoginOptions()}
                            placeholder={defaultHomeserver}
                            disabled={isLoading}
                            class="w-full ps-3 pe-9 py-2.5 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none transition-colors disabled:opacity-60 text-sm"
                            required
                        />
                        {#if optionsLoading}
                            <!-- Centred by the flex wrapper, not a translate:
                                 animate-spin owns `transform` and would
                                 override it. -->
                            <span
                                class="absolute inset-y-0 end-3 flex items-center pointer-events-none"
                                title={t("loginView.checkingServer")}
                                aria-hidden="true"
                            >
                                <span
                                    class="w-4 h-4 border-2 border-discord-textMuted/40 border-t-discord-textMuted rounded-full animate-spin"
                                ></span>
                            </span>
                        {/if}
                        <span class="sr-only" role="status"
                            >{optionsLoading
                                ? t("loginView.checkingServer")
                                : ""}</span
                        >
                    </div>
                    <p class="mt-1.5 text-xs text-discord-textMuted">
                        {mode === "register"
                            ? t("loginView.homeserverHintRegister")
                            : t("loginView.homeserverHint")}
                    </p>
                </div>

                {#if registrationClosed}
                    <div
                        role="status"
                        class="p-3 rounded-lg bg-discord-warning/10 border border-discord-warning/30 space-y-2"
                    >
                        <p class="text-sm text-discord-textPrimary">
                            {t("registration.closedOnServer", {
                                server: serverHost,
                            })}
                        </p>
                        {#if serverHost !== hostOf(PUBLIC_HOMESERVER)}
                            <button
                                type="button"
                                onclick={usePublicServer}
                                class="text-sm text-discord-accent hover:underline font-medium"
                                >{t("registration.useOtherServer", {
                                    server: hostOf(PUBLIC_HOMESERVER),
                                })}</button
                            >
                        {/if}
                    </div>
                {/if}

                {#if showPasswordForm && !registrationClosed}
                    <!-- Username -->
                    <div>
                        <label
                            for="username"
                            class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                        >
                            {t("loginView.username")}
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
                            aria-invalid={error ||
                            localUsernameIssue ||
                            nameTaken
                                ? "true"
                                : undefined}
                            aria-describedby={error
                                ? "login-error"
                                : mode === "register"
                                  ? "username-hint"
                                  : undefined}
                            autocomplete="username"
                            autocapitalize="none"
                            spellcheck="false"
                            class="w-full px-3 py-2.5 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none transition-colors disabled:opacity-60 text-sm"
                            required
                        />
                        {#if mode === "register"}
                            {@const name = username.trim()}
                            <p
                                id="username-hint"
                                class="mt-1.5 text-xs {localUsernameIssue ||
                                nameTaken
                                    ? 'text-discord-danger'
                                    : nameCheck?.name === name &&
                                        nameCheck.available
                                      ? 'text-discord-online'
                                      : 'text-discord-textMuted'}"
                            >
                                {#if !name}
                                    {t("registration.usernameHint")}
                                {:else if localUsernameIssue}
                                    {localUsernameIssue}
                                {:else if nameTaken}
                                    {nameCheck?.issue ??
                                        t("registration.userInUse")}
                                {:else if nameCheck?.name === name && nameCheck.available}
                                    {t("registration.usernameAvailable", {
                                        userId: `@${name}:${serverHost}`,
                                    })}
                                {:else}
                                    {t("registration.yourAddressWillBe", {
                                        userId: `@${name}:${serverHost}`,
                                    })}
                                {/if}
                            </p>
                        {/if}
                    </div>

                    <!-- Password -->
                    <div>
                        <label
                            for="password"
                            class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                        >
                            {t("loginView.password")}
                        </label>
                        <input
                            id="password"
                            type="password"
                            bind:value={password}
                            placeholder="••••••••••"
                            disabled={isLoading}
                            aria-invalid={error ? "true" : undefined}
                            aria-describedby={error ? "login-error" : undefined}
                            autocomplete={mode === "register"
                                ? "new-password"
                                : "current-password"}
                            class="w-full px-3 py-2.5 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none transition-colors disabled:opacity-60 text-sm"
                            required
                        />
                    </div>

                    {#if mode === "register"}
                        <div>
                            <label
                                for="confirm-password"
                                class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                            >
                                {t("registration.confirmPassword")}
                            </label>
                            <input
                                id="confirm-password"
                                type="password"
                                bind:value={confirmPassword}
                                placeholder="••••••••••"
                                disabled={isLoading}
                                autocomplete="new-password"
                                aria-invalid={passwordsMismatch
                                    ? "true"
                                    : undefined}
                                aria-describedby={passwordsMismatch
                                    ? "confirm-hint"
                                    : undefined}
                                class="w-full px-3 py-2.5 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none transition-colors disabled:opacity-60 text-sm"
                                required
                            />
                            {#if passwordsMismatch}
                                <p
                                    id="confirm-hint"
                                    class="mt-1.5 text-xs text-discord-danger"
                                >
                                    {t("registration.passwordsDontMatch")}
                                </p>
                            {/if}
                        </div>
                    {/if}

                    <!-- Registration token (register mode, when the server's
                         sign-up takes one or we couldn't tell) -->
                    {#if mode === "register" && showTokenField}
                        <div>
                            <label
                                for="token"
                                class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                            >
                                {t("loginView.registrationToken")}
                                {#if !tokenRequired}
                                    <span
                                        class="normal-case font-normal text-discord-textMuted"
                                        >{t("loginView.ifRequired")}</span
                                    >
                                {/if}
                            </label>
                            {#if tokenRequired}
                                <p
                                    class="mb-1.5 text-xs text-discord-textMuted"
                                >
                                    {t("registration.tokenBody", {
                                        server: serverHost,
                                    })}
                                </p>
                            {/if}
                            <input
                                id="token"
                                type="text"
                                bind:value={registrationToken}
                                placeholder={tokenRequired
                                    ? ""
                                    : t("loginView.leaveBlankIfNotRequired")}
                                autocomplete="off"
                                spellcheck="false"
                                disabled={isLoading}
                                class="w-full px-3 py-2.5 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none transition-colors disabled:opacity-60 text-sm"
                            />
                        </div>
                    {/if}
                {/if}

                {#if useOAuth}
                    <!-- The provider's own page signs in and signs up; say so
                         before sending anyone there, so leaving Zam is expected. -->
                    <p
                        class="p-3 rounded-lg bg-discord-backgroundSecondary border border-discord-divider text-sm text-discord-textSecondary"
                    >
                        {mode === "register"
                            ? t("loginView.oauthRegisterExplainer", {
                                  server: serverHost,
                              })
                            : t("loginView.oauthLoginExplainer", {
                                  server: serverHost,
                              })}
                    </p>
                    <button
                        type="submit"
                        disabled={isLoading || !optionsCurrent}
                        aria-busy={isLoading ? "true" : undefined}
                        class="w-full py-2.5 bg-discord-accent hover:bg-discord-accentHover text-white font-semibold rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm mt-2"
                    >
                        {#if isLoading}
                            <span
                                class="flex items-center justify-center gap-2"
                            >
                                <span
                                    class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                                ></span>
                                {statusMsg || t("loginView.pleaseWait")}
                            </span>
                        {:else if mode === "login"}
                            {providerHost
                                ? t("loginView.continueTo", {
                                      host: providerHost,
                                  })
                                : t("loginView.continue")}
                        {:else}
                            {t("loginView.createAccountOn", {
                                server: serverHost,
                            })}
                        {/if}
                    </button>
                    {#if ssoHint}
                        <p
                            role="status"
                            class="text-sm text-center text-discord-textSecondary"
                        >
                            {ssoHint}
                        </p>
                    {/if}
                {/if}

                {#if showPasswordForm && !registrationClosed}
                    <button
                        type="submit"
                        disabled={isLoading ||
                            !optionsCurrent ||
                            !canSubmitPasswordForm}
                        aria-busy={isLoading ? "true" : undefined}
                        class="w-full py-2.5 bg-discord-accent hover:bg-discord-accentHover text-white font-semibold rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm mt-2"
                    >
                        {#if isLoading}
                            <span
                                class="flex items-center justify-center gap-2"
                            >
                                <span
                                    class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                                ></span>
                                {statusMsg || t("loginView.pleaseWait")}
                            </span>
                        {:else if mode === "login"}
                            {t("loginView.logIn")}
                        {:else}
                            {t("loginView.createAccount")}
                        {/if}
                    </button>
                {/if}
            </form>

            <!-- SSO (OIDC / OAuth / SAML / CAS via the homeserver) -->
            {#if sso && !stage}
                {#if showPasswordForm}
                    <div
                        class="flex items-center gap-3 my-4"
                        aria-hidden="true"
                    >
                        <div class="flex-1 h-px bg-discord-divider"></div>
                        <span
                            class="text-xs uppercase tracking-wide text-discord-textMuted"
                            >{t("loginView.or")}</span
                        >
                        <div class="flex-1 h-px bg-discord-divider"></div>
                    </div>
                {:else}
                    <div class="mt-4"></div>
                {/if}
                <div class="space-y-2">
                    {#if sso.providers.length > 0}
                        {#each sso.providers as provider (provider.id)}
                            <button
                                type="button"
                                onclick={() => startSso(provider.id)}
                                disabled={isLoading || !optionsCurrent}
                                class="w-full py-2.5 bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary font-semibold rounded border border-discord-divider transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                            >
                                {t("loginView.continueWith", {
                                    name: provider.name,
                                })}
                            </button>
                        {/each}
                    {:else}
                        <button
                            type="button"
                            onclick={() => startSso()}
                            disabled={isLoading || !optionsCurrent}
                            class="w-full py-2.5 {showPasswordForm &&
                            !sso.preferred
                                ? 'bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary border border-discord-divider'
                                : 'bg-discord-accent hover:bg-discord-accentHover text-white'} font-semibold rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                        >
                            {t("loginView.continueWithSso")}
                        </button>
                    {/if}
                </div>
                {#if ssoHint}
                    <p
                        role="status"
                        class="mt-3 text-sm text-center text-discord-textSecondary"
                    >
                        {ssoHint}
                    </p>
                {/if}
            {/if}

            <!-- Toggle mode -->
            <div class="mt-5 text-center">
                {#if mode === "login"}
                    <p class="text-sm text-discord-textMuted">
                        {t("loginView.donTHaveAnAccount")}
                        <button
                            onclick={() => setMode("register")}
                            disabled={!!stage}
                            class="text-discord-accent hover:underline font-medium"
                        >
                            {t("loginView.register")}
                        </button>
                    </p>
                {:else}
                    <p class="text-sm text-discord-textMuted">
                        {t("loginView.alreadyHaveAnAccount")}
                        <button
                            onclick={() => setMode("login")}
                            disabled={!!stage}
                            class="text-discord-accent hover:underline font-medium"
                        >
                            {t("loginView.signIn2")}
                        </button>
                    </p>
                {/if}
            </div>

            <!-- Advanced: sliding sync. On by default and almost never worth
                 changing, so it stays out of a first-time user's way. -->
            <div class="mt-4">
                <button
                    type="button"
                    onclick={() => (showAdvanced = !showAdvanced)}
                    aria-expanded={showAdvanced}
                    aria-controls="login-advanced"
                    class="text-xs text-discord-textMuted hover:text-discord-textPrimary"
                    >{showAdvanced ? "▾" : "▸"}
                    {t("loginView.advancedOptions")}</button
                >
                {#if showAdvanced}
                    <label
                        id="login-advanced"
                        class="mt-2 flex items-start gap-3 cursor-pointer"
                    >
                        <input
                            id="sliding-sync"
                            type="checkbox"
                            bind:checked={useSlidingSync}
                            disabled={isLoading}
                            class="mt-0.5 w-4 h-4 accent-discord-accent"
                        />
                        <span class="text-sm text-discord-textSecondary">
                            {t("loginView.useSlidingSync")}
                            <span class="block text-xs text-discord-textMuted">
                                {t(
                                    "loginView.fasterStartupOnServersThatSupport",
                                )}
                            </span>
                        </span>
                    </label>
                {/if}
            </div>

            {#if isAddAccountMode && accountsState.registry.activeUserId}
                <div class="mt-3 text-center">
                    <button
                        onclick={onBackToActive}
                        class="text-sm text-discord-accent hover:underline font-medium"
                        >{t("loginView.backTo", {
                            activeUserId: accountsState.registry.activeUserId,
                        })}</button
                    >
                </div>
            {/if}

            {#if dormantAccounts.length > 0}
                <div class="mt-5 pt-4 border-t border-discord-divider">
                    <p
                        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                    >
                        {t("loginView.orContinueAs")}
                    </p>
                    <div class="space-y-1">
                        {#each dormantAccounts as account (account.userId)}
                            <button
                                onclick={() => onContinueAs(account.userId)}
                                disabled={isLoading}
                                class="w-full flex items-center gap-2.5 p-2 rounded bg-discord-backgroundSecondary hover:bg-discord-messageHover text-start transition-colors disabled:opacity-50"
                            >
                                <AccountAvatar {account} size={28} />
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
                {t("loginView.yourCredentialsAreSentDirectlyTo")}
            </p>
        </div>
    </div>
</div>

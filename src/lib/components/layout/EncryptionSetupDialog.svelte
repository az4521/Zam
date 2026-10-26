<script lang="ts">
    // Guided first-run encryption setup. Opens after a sign-in (and from the
    // footer nudge) and walks the user through the ONE thing their account
    // needs: create recovery on a new account, or confirm this session on an
    // existing one (another device, or the recovery key). Security settings
    // keeps the full toolbox; this is the short path for everyone else.
    import { t } from "$lib/i18n";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import {
        accountHasCrossSigning,
        getBackupStatus,
        getCryptoInitError,
        getSecurityStatus,
        setupRecovery,
        unlockWithPassphrase,
        unlockWithRecoveryKey,
        type AccountApprovalPrompt,
        type SecurityStatus,
        type BackupStatus,
    } from "$lib/matrix/crypto";
    import { auth, isOAuthSession } from "$lib/stores/auth.svelte";
    import { securityState } from "$lib/stores/security.svelte";
    import { refreshVerificationStatus } from "$lib/stores/verificationStatus.svelte";
    import { verifyWithAnotherDevice } from "$lib/stores/verification.svelte";
    import { openAppSettingsTab } from "$lib/stores/interface.svelte";
    import {
        closeEncryptionSetup,
        forgetSignInPassword,
        onboardingState,
        peekSignInPassword,
    } from "$lib/stores/onboarding.svelte";
    import {
        planEncryptionSetup,
        type EncryptionSetupPlan,
    } from "$lib/utils/encryptionSetupPlan";
    import {
        formatRecoveryKey,
        isLikelyRecoveryKey,
    } from "$lib/utils/recoveryKey";
    import {
        restoreProgressView,
        type RestoreProgress,
    } from "$lib/utils/keyBackup";
    import { revokeLater, saveObjectUrl } from "$lib/utils/saveFile";

    // How long an automatic open waits for encryption to start before giving
    // up quietly (the footer nudge still offers setup later).
    const AUTO_WAIT_MS = 30_000;

    // ── Reading the account ───────────────────────────────────────────────
    let status = $state<SecurityStatus | null>(null);
    let backup = $state<BackupStatus | null>(null);
    let onServer = $state<boolean | null | undefined>(undefined);
    let readSeq = 0;
    const openedAt = Date.now();

    async function read() {
        const seq = ++readSeq;
        const [s, b, cs] = await Promise.all([
            getSecurityStatus(),
            getBackupStatus(),
            accountHasCrossSigning(),
        ]);
        if (seq !== readSeq) return;
        status = s;
        backup = b;
        onServer = cs;
    }

    const plan = $derived<EncryptionSetupPlan>(
        planEncryptionSetup({
            read: status?.read ?? null,
            backupRead: backup?.read ?? null,
            recoveryExists:
                (status?.secretStorageReady ?? false) ||
                (status?.defaultKeyId ?? null) !== null,
            thisDeviceVerified: status?.thisDeviceVerified ?? false,
            backupExists: backup?.exists ?? false,
            backupActive: backup?.active ?? false,
            crossSigningOnServer: onServer,
            crossSigningUnpublished: status?.crossSigningUnpublished ?? false,
        }),
    );

    // Re-read whenever crypto state moves (setup, verification, unlock).
    $effect(() => {
        void securityState.securityTick;
        void read();
    });

    // Right after sign-in encryption may still be starting: an automatic
    // open keeps polling quietly instead of announcing "unavailable".
    const cryptoStarting = $derived(
        plan.kind === "unavailable" &&
            !getCryptoInitError() &&
            Date.now() - openedAt < AUTO_WAIT_MS,
    );
    $effect(() => {
        if (!cryptoStarting) return;
        const timer = setTimeout(() => void read(), 2000);
        return () => clearTimeout(timer);
    });

    // The flow the user is in, once they've started something. Until then
    // the screen follows `plan`.
    type Flow =
        | "idle"
        | "setup-password"
        | "setup-working"
        | "show-key"
        | "unlock"
        | "unlock-working"
        | "finished";
    let flow = $state<Flow>("idle");
    let error = $state("");

    // An automatic open stays invisible until there is something to say, and
    // closes itself when the account needs nothing.
    const visible = $derived(
        !onboardingState.automatic ||
            flow !== "idle" ||
            !(plan.kind === "checking" || cryptoStarting),
    );
    $effect(() => {
        if (!onboardingState.automatic || flow !== "idle") return;
        // Nothing to do, or nothing trustworthy to say yet: the footer
        // nudge still leads here once there is.
        if (
            plan.kind === "done" ||
            plan.kind === "advanced" ||
            plan.kind === "error" ||
            (plan.kind === "unavailable" && !cryptoStarting)
        ) {
            close();
        }
    });

    function close() {
        // Never leave a key or password lingering in a closed dialog.
        answerApproval(false);
        recoveryKey = "";
        password = "";
        unlockKey = "";
        unlockPassphrase = "";
        if (flow === "finished" || plan.kind === "done") forgetSignInPassword();
        closeEncryptionSetup();
    }

    // ── Setup (new account) ───────────────────────────────────────────────
    const oauthSession = isOAuthSession();
    let password = $state("");
    let usedRememberedPassword = false;
    let recoveryKey = $state("");
    let saved = $state(false);
    let copied = $state(false);

    // OAuth-delegated servers (matrix.org) approve on their account page.
    let approval = $state<{
        url: string;
        retry: boolean;
        resolve: (proceed: boolean) => void;
    } | null>(null);
    const approveOnAccountPage: AccountApprovalPrompt = (url, retry) =>
        new Promise((resolve) => {
            approval = { url, retry, resolve };
        });
    function answerApproval(proceed: boolean) {
        const pending = approval;
        approval = null;
        pending?.resolve(proceed);
    }
    $effect(() => () => answerApproval(false));

    async function startSetup() {
        error = "";
        if (oauthSession) return runSetup("");
        const remembered = peekSignInPassword(auth.userId);
        if (remembered) {
            usedRememberedPassword = true;
            return runSetup(remembered);
        }
        flow = "setup-password";
    }

    async function runSetup(pw: string) {
        flow = "setup-working";
        error = "";
        try {
            const result = await setupRecovery(
                pw,
                undefined,
                approveOnAccountPage,
            );
            recoveryKey = result.recoveryKey;
            password = "";
            saved = false;
            copied = false;
            forgetSignInPassword();
            flow = "show-key";
        } catch (e) {
            const message =
                e instanceof Error
                    ? e.message
                    : t("securitySettings.couldNotSetUpRecovery");
            // A remembered password that no longer works (changed elsewhere)
            // just means asking for it, not an error.
            if (usedRememberedPassword) {
                usedRememberedPassword = false;
                forgetSignInPassword();
                flow = "setup-password";
                error =
                    message === t("crypto.incorrectPassword") ? "" : message;
                return;
            }
            error = message;
            flow = oauthSession ? "idle" : "setup-password";
        }
    }

    async function copyKey() {
        try {
            await navigator.clipboard.writeText(formatRecoveryKey(recoveryKey));
            copied = true;
        } catch {
            copied = false;
        }
    }

    async function downloadKey() {
        const text = `${t("encryptionSetup.keyFileHeader", {
            userId: auth.userId ?? "",
        })}\n\n${formatRecoveryKey(recoveryKey)}\n`;
        const url = URL.createObjectURL(
            new Blob([text], { type: "text/plain;charset=utf-8" }),
        );
        try {
            await saveObjectUrl(url, "zam-recovery-key.txt");
            saved = true;
        } catch {
            // The key is still on screen to copy by hand.
        } finally {
            revokeLater(url);
        }
    }

    function finishSetup() {
        recoveryKey = "";
        flow = "finished";
        void refreshVerificationStatus();
    }

    // ── Confirm (existing account) ────────────────────────────────────────
    let unlockMode = $state<"key" | "passphrase">("key");
    let unlockKey = $state("");
    let unlockPassphrase = $state("");
    let progress = $state<RestoreProgress | null>(null);
    const progressView = $derived(restoreProgressView(progress));
    const canUsePassphrase = $derived(status?.passphraseRecovery ?? false);
    const effectiveMode = $derived(canUsePassphrase ? unlockMode : "key");
    const unlockReady = $derived(
        effectiveMode === "key"
            ? isLikelyRecoveryKey(unlockKey)
            : unlockPassphrase.length > 0,
    );

    function startUnlock() {
        error = "";
        unlockKey = "";
        unlockPassphrase = "";
        unlockMode = "key";
        flow = "unlock";
    }

    async function runUnlock() {
        if (!unlockReady || flow === "unlock-working") return;
        error = "";
        progress = null;
        flow = "unlock-working";
        try {
            const onProgress = (p: RestoreProgress) => (progress = p);
            if (effectiveMode === "key")
                await unlockWithRecoveryKey(unlockKey, onProgress);
            else await unlockWithPassphrase(unlockPassphrase, onProgress);
            unlockKey = "";
            unlockPassphrase = "";
            await read();
            void refreshVerificationStatus();
            flow = "finished";
        } catch (e) {
            error =
                e instanceof Error
                    ? e.message
                    : t("securitySettings.couldNotVerifyThisSession");
            flow = "unlock";
        }
    }

    async function useAnotherDevice() {
        error = "";
        try {
            await verifyWithAnotherDevice();
            // The verification modal takes over; come back once it ends.
            onboardingState.resumeAfterVerification = true;
            closeEncryptionSetup();
        } catch (e) {
            error =
                e instanceof Error
                    ? e.message
                    : t("verification.couldNotSendVerificationRequest");
        }
    }

    function openSecuritySettings() {
        close();
        openAppSettingsTab("security");
    }

    // Leaving mid-setup is fine before the key exists; after, the user must
    // see it saved first (closing would lose it for good).
    const closable = $derived(
        flow !== "setup-working" &&
            flow !== "unlock-working" &&
            flow !== "show-key",
    );
</script>

{#snippet primary(label: string, onclick: () => void, disabled = false)}
    <button
        type="button"
        {onclick}
        {disabled}
        class="w-full py-2.5 bg-discord-accent hover:bg-discord-accentHover text-white font-semibold rounded text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >{label}</button
    >
{/snippet}

{#snippet secondary(label: string, onclick: () => void, disabled = false)}
    <button
        type="button"
        {onclick}
        {disabled}
        class="w-full py-2.5 bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary font-semibold rounded border border-discord-divider text-sm disabled:opacity-60"
        >{label}</button
    >
{/snippet}

{#snippet approvalPrompt()}
    {#if approval}
        <div class="space-y-2 rounded border border-discord-divider p-3">
            <p class="text-sm font-medium text-discord-textPrimary">
                {t("securitySettings.approveOnAccountPage")}
            </p>
            <p
                class="text-xs {approval.retry
                    ? 'text-discord-warning'
                    : 'text-discord-textMuted'}"
            >
                {approval.retry
                    ? t("securitySettings.approveOnAccountPageRetry")
                    : t("securitySettings.approveOnAccountPageBody")}
            </p>
            <div class="flex flex-wrap gap-2">
                <a
                    href={approval.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="px-3 py-1.5 bg-discord-accent text-white rounded text-sm"
                    >{t("securitySettings.openAccountPage")}</a
                >
                <button
                    type="button"
                    onclick={() => answerApproval(true)}
                    class="px-3 py-1.5 bg-discord-messageHover text-discord-textPrimary rounded text-sm"
                    >{t("securitySettings.iVeApprovedIt")}</button
                >
                <button
                    type="button"
                    onclick={() => answerApproval(false)}
                    class="px-3 py-1.5 bg-discord-messageHover text-discord-textPrimary rounded text-sm"
                    >{t("common.cancel")}</button
                >
            </div>
        </div>
    {/if}
{/snippet}

{#if visible}
    <ModalDialog
        onClose={() => closable && close()}
        labelledBy="encryption-setup-title"
        panelClass="relative w-full max-w-md mx-4 max-h-[90dvh] overflow-y-auto bg-discord-background rounded-lg shadow-2xl p-6 space-y-4"
    >
        <div class="flex items-start gap-3">
            <div
                aria-hidden="true"
                class="flex-shrink-0 w-10 h-10 rounded-full bg-discord-accent/15 text-discord-accent flex items-center justify-center text-xl"
            >
                {flow === "finished" || plan.kind === "done" ? "✓" : "🔒"}
            </div>
            <div class="min-w-0">
                <h2
                    id="encryption-setup-title"
                    class="text-lg font-bold text-discord-textPrimary"
                >
                    {#if flow === "show-key"}
                        {t("encryptionSetup.saveKeyTitle")}
                    {:else if flow === "finished" || plan.kind === "done"}
                        {t("encryptionSetup.doneTitle")}
                    {:else if flow === "unlock" || flow === "unlock-working"}
                        {t("encryptionSetup.enterKeyTitle")}
                    {:else if plan.kind === "confirm"}
                        {t("encryptionSetup.confirmTitle")}
                    {:else if plan.kind === "connect-backup"}
                        {t("encryptionSetup.connectBackupTitle")}
                    {:else}
                        {t("encryptionSetup.setupTitle")}
                    {/if}
                </h2>
            </div>
        </div>

        {#if flow === "show-key"}
            <p class="text-sm text-discord-textSecondary">
                {t("encryptionSetup.saveKeyBody")}
            </p>
            <div
                class="font-mono text-sm text-discord-textPrimary bg-discord-backgroundTertiary rounded px-3 py-2.5 break-all select-all"
            >
                {formatRecoveryKey(recoveryKey)}
            </div>
            <div class="flex gap-2">
                <button
                    type="button"
                    onclick={copyKey}
                    class="flex-1 py-2 bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary rounded border border-discord-divider text-sm"
                    >{copied
                        ? t("securitySettings.copied")
                        : t("securitySettings.copyKey")}</button
                >
                <button
                    type="button"
                    onclick={downloadKey}
                    class="flex-1 py-2 bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary rounded border border-discord-divider text-sm"
                    >{t("encryptionSetup.downloadKey")}</button
                >
            </div>
            <label
                class="flex items-start gap-2 text-sm text-discord-textSecondary cursor-pointer"
            >
                <input
                    type="checkbox"
                    bind:checked={saved}
                    class="mt-0.5 w-4 h-4 accent-discord-accent"
                />
                <span>{t("securitySettings.iVeSavedMyRecoveryKey")}</span>
            </label>
            {@render primary(t("securitySettings.done"), finishSetup, !saved)}
        {:else if flow === "finished" || plan.kind === "done"}
            <p class="text-sm text-discord-textSecondary">
                {t("encryptionSetup.doneBody")}
            </p>
            {@render primary(t("common.close"), close)}
        {:else if flow === "unlock" || flow === "unlock-working"}
            {#if canUsePassphrase}
                <div class="flex gap-2 text-xs">
                    <button
                        type="button"
                        onclick={() => (unlockMode = "key")}
                        disabled={flow === "unlock-working"}
                        class="px-2 py-1 rounded {effectiveMode === 'key'
                            ? 'bg-discord-accent text-white'
                            : 'bg-discord-messageHover text-discord-textPrimary'}"
                        >{t("securitySettings.recoveryKey2")}</button
                    >
                    <button
                        type="button"
                        onclick={() => (unlockMode = "passphrase")}
                        disabled={flow === "unlock-working"}
                        class="px-2 py-1 rounded {effectiveMode === 'passphrase'
                            ? 'bg-discord-accent text-white'
                            : 'bg-discord-messageHover text-discord-textPrimary'}"
                        >{t("securitySettings.passphrase")}</button
                    >
                </div>
            {/if}
            <p class="text-sm text-discord-textSecondary">
                {effectiveMode === "key"
                    ? t("encryptionSetup.enterKeyBody")
                    : t("encryptionSetup.enterPassphraseBody")}
            </p>
            {#if effectiveMode === "key"}
                <input
                    type="text"
                    bind:value={unlockKey}
                    placeholder="EsTx xxxx xxxx …"
                    autocomplete="off"
                    autocapitalize="none"
                    spellcheck="false"
                    disabled={flow === "unlock-working"}
                    onkeydown={(e) =>
                        e.key === "Enter" && unlockReady && runUnlock()}
                    class="w-full px-3 py-2.5 bg-discord-backgroundSecondary text-discord-textPrimary font-mono placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm disabled:opacity-60"
                />
            {:else}
                <input
                    type="password"
                    bind:value={unlockPassphrase}
                    placeholder={t("securitySettings.recoveryPassphrase")}
                    autocomplete="current-password"
                    disabled={flow === "unlock-working"}
                    onkeydown={(e) =>
                        e.key === "Enter" && unlockReady && runUnlock()}
                    class="w-full px-3 py-2.5 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm disabled:opacity-60"
                />
            {/if}
            {#if flow === "unlock-working"}
                <div class="space-y-1.5">
                    <p class="text-xs text-discord-textMuted">
                        {progressView.label}
                    </p>
                    <div
                        class="h-1.5 w-full rounded bg-discord-backgroundTertiary overflow-hidden"
                    >
                        <div
                            class="h-full bg-discord-accent transition-all"
                            style="width: {progressView.percent ?? 15}%"
                        ></div>
                    </div>
                </div>
            {:else}
                {@render primary(
                    t("loginView.continue"),
                    runUnlock,
                    !unlockReady,
                )}
                {@render secondary(t("encryptionSetup.back"), () => {
                    error = "";
                    flow = "idle";
                })}
            {/if}
        {:else if plan.kind === "checking" || cryptoStarting}
            <p
                class="text-sm text-discord-textMuted flex items-center gap-2"
                role="status"
            >
                <span
                    aria-hidden="true"
                    class="w-4 h-4 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"
                ></span>
                {t("encryptionSetup.checking")}
            </p>
        {:else if plan.kind === "unavailable" || plan.kind === "error"}
            <p class="text-sm text-discord-textSecondary">
                {plan.kind === "unavailable"
                    ? (getCryptoInitError() ??
                      t("verificationStatus.encryptionUnavailable"))
                    : t("securityStatusView.couldnTReadThisAccountS")}
            </p>
            {@render primary(t("encryptionSetup.tryAgain"), () => void read())}
            {@render secondary(t("encryptionSetup.later"), close)}
        {:else if plan.kind === "advanced"}
            <p class="text-sm text-discord-textSecondary">
                {t("securitySettings.keysNotOnServerHint")}
            </p>
            {@render primary(
                t("encryptionSetup.openSecuritySettings"),
                openSecuritySettings,
            )}
        {:else if plan.kind === "confirm"}
            <p class="text-sm text-discord-textSecondary">
                {t("encryptionSetup.confirmBody")}
            </p>
            <div class="space-y-2">
                {#if plan.withDevice}
                    {@render primary(
                        t("encryptionSetup.useAnotherDevice"),
                        useAnotherDevice,
                    )}
                {/if}
                {#if plan.withRecoveryKey}
                    {@render (plan.withDevice ? secondary : primary)(
                        t("encryptionSetup.useRecoveryKey"),
                        startUnlock,
                    )}
                {/if}
            </div>
            <p class="text-xs text-discord-textMuted">
                {plan.withDevice
                    ? t("encryptionSetup.anotherDeviceHint")
                    : t("encryptionSetup.recoveryKeyHint")}
            </p>
            <div class="flex items-center justify-between gap-3 pt-1">
                <button
                    type="button"
                    onclick={openSecuritySettings}
                    class="text-xs text-discord-textMuted underline hover:text-discord-textPrimary text-start"
                    >{t("encryptionSetup.cantConfirm")}</button
                >
                <button
                    type="button"
                    onclick={close}
                    class="text-sm text-discord-textMuted hover:text-discord-textPrimary"
                    >{t("encryptionSetup.later")}</button
                >
            </div>
        {:else if plan.kind === "connect-backup"}
            <p class="text-sm text-discord-textSecondary">
                {t("encryptionSetup.connectBackupBody")}
            </p>
            {@render primary(t("encryptionSetup.useRecoveryKey"), startUnlock)}
            {@render secondary(t("encryptionSetup.later"), close)}
        {:else}
            <!-- setup -->
            <p class="text-sm text-discord-textSecondary">
                {t("encryptionSetup.setupBody")}
            </p>
            {#if flow === "setup-password" || (flow === "setup-working" && !oauthSession && password)}
                <div class="space-y-1.5">
                    <label
                        for="setup-password"
                        class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                        >{t("securitySettings.accountPassword")}</label
                    >
                    <p class="text-xs text-discord-textMuted">
                        {t("encryptionSetup.passwordBody")}
                    </p>
                    <input
                        id="setup-password"
                        type="password"
                        bind:value={password}
                        autocomplete="current-password"
                        disabled={flow === "setup-working"}
                        onkeydown={(e) =>
                            e.key === "Enter" && password && runSetup(password)}
                        class="w-full px-3 py-2.5 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm disabled:opacity-60"
                    />
                </div>
            {/if}
            {@render approvalPrompt()}
            {#if !approval}
                {@render primary(
                    flow === "setup-working"
                        ? t("securitySettings.settingUp")
                        : t("encryptionSetup.setUp"),
                    () =>
                        void (flow === "setup-password"
                            ? runSetup(password)
                            : startSetup()),
                    flow === "setup-working" ||
                        (flow === "setup-password" && !password),
                )}
            {/if}
            {#if flow !== "setup-working"}
                {@render secondary(t("encryptionSetup.later"), close)}
            {/if}
        {/if}

        {#if error}
            <p class="text-sm text-discord-danger" role="alert">{error}</p>
        {/if}
    </ModalDialog>
{/if}

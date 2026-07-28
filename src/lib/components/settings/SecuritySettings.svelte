<script lang="ts">
    import {
        getSecurityStatus,
        setupRecovery,
        resetRecovery,
        getBackupStatus,
        unlockWithRecoveryKey,
        unlockWithPassphrase,
        type SecurityStatus,
        type BackupStatus,
        type UnlockResult,
    } from "$lib/matrix/crypto";
    import { securityState } from "$lib/stores/security.svelte";
    import {
        formatRecoveryKey,
        isLikelyRecoveryKey,
    } from "$lib/utils/recoveryKey";
    import {
        backupBadge,
        backupDetailLines,
        backupSummaryLabel,
        restoreProgressView,
        restoreResultLabel,
        secretStorageKeyLabel,
        type RestoreProgress,
    } from "$lib/utils/keyBackup";
    import {
        passphraseIssue,
        MIN_PASSPHRASE_LENGTH,
    } from "$lib/utils/recoveryPassphrase";

    // The Set-up-recovery wizard is a small linear state machine:
    //   idle → password (collect account password for the UIA-guarded upload)
    //        → working (running setupRecovery) → show (display key + save gate)
    //        → done.
    type Step = "idle" | "password" | "working" | "show" | "done";

    let status = $state<SecurityStatus | null>(null);
    let step = $state<Step>("idle");
    let password = $state("");
    let recoveryKey = $state("");
    let saved = $state(false);
    let copied = $state(false);
    let error = $state("");

    // Optional passphrase: an ADDITIONAL way to unlock recovery. The random
    // recovery key is always generated and shown; this only adds a second door.
    let usePassphrase = $state(false);
    let passphrase = $state("");
    let keyHasPassphrase = $state(false);

    // Only nag once the user has actually typed something — an empty field is
    // "not filled in yet", not an error.
    const passphraseError = $derived(
        usePassphrase && passphrase.length > 0
            ? passphraseIssue(passphrase)
            : null,
    );
    const setupBlocked = $derived(
        !password || (usePassphrase && passphraseIssue(passphrase) !== null),
    );

    // Reset-recovery sub-flow, offered from the "Recovery is set up" panel for a
    // user who lost their key: confirm → password → working, then hands off into
    // step="show" with the freshly-minted key (reusing the show screen above).
    type ResetStep = "idle" | "confirm" | "password" | "working";
    let resetStep = $state<ResetStep>("idle");

    const recoveryDone = $derived(status?.secretStorageReady ?? false);
    const canSetUp = $derived((status?.available ?? false) && !recoveryDone);

    // ── Layer 3: enter-recovery-key → verify this session & restore history ──
    //   idle → entry (paste key) → working (restoring, with progress) → done.
    type UnlockStep = "idle" | "entry" | "working" | "done";

    let backup = $state<BackupStatus | null>(null);
    let unlockStep = $state<UnlockStep>("idle");
    let unlockKey = $state("");
    let unlockError = $state("");
    let progress = $state<RestoreProgress | null>(null);
    let unlockResult = $state<UnlockResult | null>(null);

    // Which credential the user is entering. Defaults to the recovery key;
    // the passphrase option only appears when the account's 4S key actually
    // carries derivation params (status.passphraseRecovery).
    type UnlockMode = "key" | "passphrase";
    let unlockMode = $state<UnlockMode>("key");
    let unlockPassphrase = $state("");

    const canUnlockByPassphrase = $derived(status?.passphraseRecovery ?? false);
    // The stored mode is only meaningful while the passphrase path exists; if
    // it disappears under us, fall back to key entry rather than stranding the
    // user on an input that can no longer work.
    const effectiveUnlockMode = $derived(
        canUnlockByPassphrase ? unlockMode : "key",
    );
    const unlockReady = $derived(
        effectiveUnlockMode === "key"
            ? isLikelyRecoveryKey(unlockKey)
            : unlockPassphrase.length > 0,
    );

    // Plain badge model from the backup status (undefined until first load).
    const backupModel = $derived(
        backup
            ? {
                  exists: backup.exists,
                  active: backup.active,
                  trusted: backup.trusted,
                  version: backup.version,
              }
            : null,
    );
    const badge = $derived(backupModel ? backupBadge(backupModel) : null);
    const summary = $derived(
        backupModel ? backupSummaryLabel(backupModel) : null,
    );
    const progressView = $derived(restoreProgressView(progress));

    // Additive detail the SDK already reports (server key count, this session's
    // upload queue). Empty when there's no backup — the summary line above
    // already says so. The key-mismatch fact is not a line here; it's rendered
    // by the "Backup key on this session" status row further down.
    const detailLines = $derived(
        backup
            ? backupDetailLines({
                  exists: backup.exists,
                  active: backup.active,
                  matchesDecryptionKey: backup.matchesDecryptionKey,
                  count: backup.count,
                  sessionsRemaining: backup.sessionsRemaining,
              })
            : [],
    );

    // Recovery is set up on the account (a 4S default key exists), so this
    // session can be unlocked with the recovery key.
    const recoverySetUp = $derived(
        (status?.secretStorageReady ?? false) ||
            (status?.defaultKeyId ?? null) !== null,
    );
    // Show the "verify this session & restore" call-to-action when recovery
    // exists but this session isn't trusted yet, or a backup exists that this
    // session isn't connected to. Not shown on the session that just set up.
    const needsUnlock = $derived(
        (status?.available ?? false) &&
            recoverySetUp &&
            (!(status?.thisDeviceVerified ?? false) ||
                ((backup?.exists ?? false) && !(backup?.active ?? false))),
    );

    async function loadStatus() {
        [status, backup] = await Promise.all([
            getSecurityStatus(),
            getBackupStatus(),
        ]);
    }

    // Initial load + refresh whenever crypto state changes (securityTick bumps
    // from CryptoEvent listeners in crypto.ts, e.g. after setup completes).
    let loaded = false;
    let lastTick = 0;
    $effect(() => {
        const tick = securityState.securityTick;
        if (!loaded || tick !== lastTick) {
            loaded = true;
            lastTick = tick;
            loadStatus();
        }
    });

    function beginSetup() {
        error = "";
        password = "";
        step = "password";
    }

    async function runSetup() {
        if (setupBlocked || step === "working") return;
        error = "";
        step = "working";
        try {
            const result = await setupRecovery(
                password,
                usePassphrase ? passphrase : undefined,
            );
            keyHasPassphrase = result.hasPassphrase;
            recoveryKey = result.recoveryKey;
            password = "";
            passphrase = "";
            usePassphrase = false;
            saved = false;
            copied = false;
            step = "show";
        } catch (e) {
            error =
                e instanceof Error ? e.message : "Could not set up recovery";
            step = "password";
        }
    }

    async function copyKey() {
        try {
            await navigator.clipboard.writeText(recoveryKey);
            copied = true;
        } catch {
            // Clipboard blocked (permissions / insecure context): the key is
            // still shown for manual copy, so this is non-fatal.
            copied = false;
        }
    }

    function finishSetup() {
        // Drop the key from memory once the user confirms they've saved it.
        // `keyHasPassphrase` is deliberately left alone: it's only read on the
        // show screen, which unmounts as this runs.
        recoveryKey = "";
        passphrase = "";
        usePassphrase = false;
        saved = false;
        step = "done";
        loadStatus();
    }

    function cancel() {
        // Never leave the plaintext key or passphrase lingering after a cancel.
        password = "";
        passphrase = "";
        usePassphrase = false;
        recoveryKey = "";
        saved = false;
        error = "";
        step = "idle";
    }

    function beginReset() {
        error = "";
        password = "";
        resetStep = "confirm";
    }

    async function runReset() {
        if (setupBlocked || resetStep === "working") return;
        error = "";
        resetStep = "working";
        try {
            const result = await resetRecovery(
                password,
                usePassphrase ? passphrase : undefined,
            );
            keyHasPassphrase = result.hasPassphrase;
            recoveryKey = result.recoveryKey;
            password = "";
            passphrase = "";
            usePassphrase = false;
            saved = false;
            copied = false;
            resetStep = "idle";
            // Hand off to the shared show-key screen with the NEW key.
            step = "show";
        } catch (e) {
            error = e instanceof Error ? e.message : "Could not reset recovery";
            resetStep = "password";
        }
    }

    function cancelReset() {
        password = "";
        passphrase = "";
        usePassphrase = false;
        error = "";
        resetStep = "idle";
    }

    function beginUnlock() {
        unlockError = "";
        unlockKey = "";
        unlockPassphrase = "";
        // Always open on the recovery key: it's the path every account has.
        unlockMode = "key";
        unlockResult = null;
        progress = null;
        unlockStep = "entry";
    }

    async function runUnlock() {
        if (!unlockReady || unlockStep === "working") return;
        unlockError = "";
        progress = null;
        unlockStep = "working";
        try {
            const onProgress = (p: RestoreProgress) => {
                progress = p;
            };
            const result =
                effectiveUnlockMode === "key"
                    ? await unlockWithRecoveryKey(unlockKey, onProgress)
                    : await unlockWithPassphrase(unlockPassphrase, onProgress);
            unlockKey = "";
            unlockPassphrase = "";
            unlockResult = result;
            unlockStep = "done";
            loadStatus();
        } catch (e) {
            unlockError =
                e instanceof Error
                    ? e.message
                    : "Could not verify this session";
            // Stay on the entry step so the user can fix a typo and retry.
            unlockStep = "entry";
        }
    }

    function cancelUnlock() {
        unlockKey = "";
        unlockPassphrase = "";
        unlockError = "";
        progress = null;
        unlockStep = "idle";
    }

    function finishUnlock() {
        unlockResult = null;
        unlockStep = "idle";
    }
</script>

{#snippet statusRow(
    label: string,
    ok: boolean,
    okText: string,
    offText: string,
)}
    <div class="flex items-center justify-between gap-3 py-1.5">
        <span class="text-sm text-discord-textPrimary">{label}</span>
        <span
            class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase {ok
                ? 'bg-discord-online/20 text-discord-online'
                : 'bg-discord-messageHover text-discord-textMuted'}"
            >{ok ? okText : offText}</span
        >
    </div>
{/snippet}

<div class="space-y-6">
    <div>
        <h3 class="text-sm font-semibold text-discord-textPrimary mb-1">
            Security &amp; Encryption
        </h3>
        <p class="text-xs text-discord-textMuted">
            Set up recovery so your cross-signing identity and encrypted message
            history survive signing out on every device.
        </p>
    </div>

    <!-- Status rows -->
    <section class="rounded bg-discord-backgroundTertiary px-4 py-2">
        {#if status}
            {@render statusRow(
                "End-to-end encryption",
                status.available,
                "Active",
                "Unavailable",
            )}
            {@render statusRow(
                "Cross-signing",
                status.crossSigningReady,
                "Ready",
                "Not set up",
            )}
            {@render statusRow(
                "Recovery (secure backup)",
                status.secretStorageReady,
                "Set up",
                "Not set up",
            )}
            {@render statusRow(
                "Keys in secure storage",
                status.privateKeysInSecretStorage,
                "Stored",
                "Not stored",
            )}
            {@render statusRow(
                "Unlock with passphrase",
                status.passphraseRecovery,
                "Available",
                "Key only",
            )}
            {@render statusRow(
                "This session",
                status.thisDeviceVerified,
                "Verified",
                "Unverified",
            )}
        {:else}
            <p class="text-xs text-discord-textMuted py-1.5">
                Loading encryption status…
            </p>
        {/if}
        {#if status}
            <p class="text-[11px] text-discord-textMuted pt-1 pb-1.5">
                Recovery key ID: <span class="font-mono"
                    >{secretStorageKeyLabel(status.defaultKeyId)}</span
                >
            </p>
        {/if}
    </section>

    {#if status && !status.available}
        <p class="text-xs text-discord-textMuted">
            End-to-end encryption could not start on this session, so recovery
            can't be set up here. Encrypted rooms will show placeholders.
        </p>
    {/if}

    <!-- Set-up-recovery wizard -->
    <!-- `|| step === "show"` is load-bearing: completing setup flips
         secretStorageReady → true (via securityTick), which makes canSetUp false.
         Without this, the freshly-minted key's "save it" screen would unmount the
         instant setup finishes and the user would never see their recovery key. -->
    {#if canSetUp || step === "show"}
        <section
            class="rounded bg-discord-backgroundTertiary px-4 py-4 space-y-3"
        >
            {#if step === "idle" || step === "password" || step === "working"}
                <div class="space-y-1">
                    <p class="text-sm font-medium text-discord-textPrimary">
                        Set up recovery
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        We'll create a <strong>recovery key</strong> — a one-time
                        code that unlocks your encrypted history and verifies new
                        sessions. Store it somewhere safe like a password manager;
                        it's shown only once and we can't recover it for you.
                    </p>
                </div>
            {/if}

            {#if step === "idle"}
                <button
                    onclick={beginSetup}
                    class="px-3 py-1.5 bg-discord-accent text-white rounded text-sm font-medium"
                    >Set up recovery</button
                >
            {:else if step === "password" || step === "working"}
                <div class="space-y-2">
                    <p class="text-xs text-discord-textMuted">
                        Confirm your account password to create your encryption
                        keys.
                    </p>
                    <input
                        type="password"
                        bind:value={password}
                        placeholder="Account password"
                        disabled={step === "working"}
                        onkeydown={(e) =>
                            e.key === "Enter" && password && runSetup()}
                        class="w-full bg-discord-backgroundDark text-discord-textPrimary text-sm rounded px-3 py-1.5 outline-none disabled:opacity-50"
                    />
                    <label
                        class="flex items-start gap-2 text-xs text-discord-textMuted cursor-pointer"
                    >
                        <input
                            type="checkbox"
                            bind:checked={usePassphrase}
                            disabled={step === "working"}
                            class="mt-0.5"
                        />
                        <span
                            >Also let me unlock with a passphrase I choose
                            (optional — your recovery key still works and is
                            still shown).</span
                        >
                    </label>
                    {#if usePassphrase}
                        <input
                            type="password"
                            bind:value={passphrase}
                            placeholder="Recovery passphrase"
                            autocomplete="new-password"
                            disabled={step === "working"}
                            class="w-full bg-discord-backgroundDark text-discord-textPrimary text-sm rounded px-3 py-1.5 outline-none disabled:opacity-50"
                        />
                        {#if passphraseError}
                            <p class="text-xs text-discord-danger">
                                {passphraseError}
                            </p>
                        {:else}
                            <p class="text-xs text-discord-textMuted">
                                At least {MIN_PASSPHRASE_LENGTH} characters. We can't
                                reset it for you.
                            </p>
                        {/if}
                    {/if}
                    <div class="flex gap-2">
                        <button
                            onclick={runSetup}
                            disabled={step === "working" || setupBlocked}
                            class="px-3 py-1.5 bg-discord-accent text-white rounded text-sm disabled:opacity-50"
                            >{step === "working"
                                ? "Setting up…"
                                : "Continue"}</button
                        >
                        <button
                            onclick={cancel}
                            disabled={step === "working"}
                            class="px-3 py-1.5 bg-discord-messageHover text-discord-textPrimary rounded text-sm disabled:opacity-50"
                            >Cancel</button
                        >
                    </div>
                </div>
            {:else if step === "show"}
                <div class="space-y-3">
                    <p class="text-sm font-medium text-discord-textPrimary">
                        Save your recovery key
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        This is shown <strong>only once</strong>. Store it now —
                        without it you can't recover your encrypted history if
                        you lose access to your sessions.
                    </p>
                    <div
                        class="font-mono text-sm text-discord-textPrimary bg-discord-backgroundDark rounded px-3 py-2 break-all select-all"
                    >
                        {formatRecoveryKey(recoveryKey)}
                    </div>
                    <button
                        onclick={copyKey}
                        class="px-3 py-1.5 bg-discord-messageHover text-discord-textPrimary rounded text-xs"
                        >{copied ? "Copied ✓" : "Copy key"}</button
                    >
                    {#if keyHasPassphrase}
                        <p class="text-xs text-discord-textMuted">
                            You can also unlock with the passphrase you chose.
                            Keep the key anyway — it's the only way in if you
                            forget the passphrase.
                        </p>
                    {/if}
                    <label
                        class="flex items-start gap-2 text-xs text-discord-textMuted cursor-pointer"
                    >
                        <input
                            type="checkbox"
                            bind:checked={saved}
                            class="mt-0.5"
                        />
                        <span>I've saved my recovery key somewhere safe.</span>
                    </label>
                    <button
                        onclick={finishSetup}
                        disabled={!saved}
                        class="px-3 py-1.5 bg-discord-accent text-white rounded text-sm disabled:opacity-50"
                        >Done</button
                    >
                </div>
            {/if}

            {#if error}
                <p class="text-sm text-discord-danger">{error}</p>
            {/if}
        </section>
    {:else if step === "done" || recoveryDone}
        <section
            class="rounded bg-discord-backgroundTertiary px-4 py-4 space-y-3"
        >
            <div class="space-y-1">
                <p class="text-sm font-medium text-discord-textPrimary">
                    Recovery is set up
                </p>
                <p class="text-xs text-discord-textMuted">
                    Your cross-signing keys and a key backup are stored securely
                    on the server, protected by your recovery key.
                </p>
            </div>

            {#if resetStep === "idle"}
                <button
                    onclick={beginReset}
                    class="text-xs text-discord-textMuted underline hover:text-discord-textPrimary"
                    >Lost your recovery key? Reset recovery</button
                >
            {:else if resetStep === "confirm"}
                <div class="space-y-2 pt-3 border-t border-discord-divider">
                    <p class="text-xs text-discord-warning">
                        Resetting creates a <strong>new</strong> recovery key and
                        replaces your current backup. Your old recovery key stops
                        working and other sessions may need re-verifying. Only do
                        this if you've lost your current key.
                    </p>
                    <div class="flex gap-2">
                        <button
                            onclick={() => (resetStep = "password")}
                            class="px-3 py-1.5 bg-discord-danger text-white rounded text-sm"
                            >Continue</button
                        >
                        <button
                            onclick={cancelReset}
                            class="px-3 py-1.5 bg-discord-messageHover text-discord-textPrimary rounded text-sm"
                            >Cancel</button
                        >
                    </div>
                </div>
            {:else if resetStep === "password" || resetStep === "working"}
                <div class="space-y-2 pt-3 border-t border-discord-divider">
                    <p class="text-xs text-discord-textMuted">
                        Confirm your account password to reset recovery.
                    </p>
                    <input
                        type="password"
                        bind:value={password}
                        placeholder="Account password"
                        disabled={resetStep === "working"}
                        onkeydown={(e) =>
                            e.key === "Enter" && password && runReset()}
                        class="w-full bg-discord-backgroundDark text-discord-textPrimary text-sm rounded px-3 py-1.5 outline-none disabled:opacity-50"
                    />
                    <label
                        class="flex items-start gap-2 text-xs text-discord-textMuted cursor-pointer"
                    >
                        <input
                            type="checkbox"
                            bind:checked={usePassphrase}
                            disabled={resetStep === "working"}
                            class="mt-0.5"
                        />
                        <span
                            >Also let me unlock with a passphrase I choose
                            (optional — your recovery key still works and is
                            still shown).</span
                        >
                    </label>
                    {#if usePassphrase}
                        <input
                            type="password"
                            bind:value={passphrase}
                            placeholder="Recovery passphrase"
                            autocomplete="new-password"
                            disabled={resetStep === "working"}
                            class="w-full bg-discord-backgroundDark text-discord-textPrimary text-sm rounded px-3 py-1.5 outline-none disabled:opacity-50"
                        />
                        {#if passphraseError}
                            <p class="text-xs text-discord-danger">
                                {passphraseError}
                            </p>
                        {:else}
                            <p class="text-xs text-discord-textMuted">
                                At least {MIN_PASSPHRASE_LENGTH} characters. We can't
                                reset it for you.
                            </p>
                        {/if}
                    {/if}
                    <div class="flex gap-2">
                        <button
                            onclick={runReset}
                            disabled={resetStep === "working" || setupBlocked}
                            class="px-3 py-1.5 bg-discord-danger text-white rounded text-sm disabled:opacity-50"
                            >{resetStep === "working"
                                ? "Resetting…"
                                : "Reset & create new key"}</button
                        >
                        <button
                            onclick={cancelReset}
                            disabled={resetStep === "working"}
                            class="px-3 py-1.5 bg-discord-messageHover text-discord-textPrimary rounded text-sm disabled:opacity-50"
                            >Cancel</button
                        >
                    </div>
                </div>
            {/if}

            {#if error}
                <p class="text-sm text-discord-danger">{error}</p>
            {/if}
        </section>
    {/if}

    <!-- Message-history backup + restore-on-this-session (Layer 3) -->
    {#if status?.available && backup}
        <section
            class="rounded bg-discord-backgroundTertiary px-4 py-4 space-y-3"
        >
            <div class="flex items-center justify-between gap-3">
                <p class="text-sm font-medium text-discord-textPrimary">
                    Message history backup
                </p>
                {#if badge}
                    <span
                        class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase {badge.tone ===
                        'active'
                            ? 'bg-discord-online/20 text-discord-online'
                            : badge.tone === 'warning'
                              ? 'bg-discord-warning/20 text-discord-warning'
                              : 'bg-discord-messageHover text-discord-textMuted'}"
                        >{badge.label}</span
                    >
                {/if}
            </div>
            {#if summary}
                <p class="text-xs text-discord-textMuted">{summary}</p>
            {/if}
            {#if detailLines.length > 0}
                <ul class="text-xs text-discord-textMuted space-y-0.5">
                    {#each detailLines as line (line)}
                        <li>{line}</li>
                    {/each}
                </ul>
            {/if}
            <!-- The `exists` gate is load-bearing: matchesDecryptionKey is false
                 both when no backup exists at all and when this session has
                 simply never unlocked one, so rendering it ungated asserts a
                 mismatch against a backup that may not exist. "Not loaded" is
                 truthful for every off-state the single boolean can represent. -->
            {#if backup.exists}
                {@render statusRow(
                    "Backup key on this session",
                    backup.matchesDecryptionKey,
                    "Matches",
                    "Not loaded",
                )}
            {/if}

            {#if needsUnlock}
                {#if unlockStep === "idle"}
                    <button
                        onclick={beginUnlock}
                        class="px-3 py-1.5 bg-discord-accent text-white rounded text-sm font-medium"
                        >Verify this session &amp; restore history</button
                    >
                {:else if unlockStep === "entry"}
                    <div class="space-y-2">
                        {#if canUnlockByPassphrase}
                            <div class="flex gap-2 text-xs">
                                <button
                                    onclick={() => (unlockMode = "key")}
                                    class="px-2 py-1 rounded {unlockMode ===
                                    'key'
                                        ? 'bg-discord-accent text-white'
                                        : 'bg-discord-messageHover text-discord-textPrimary'}"
                                    >Recovery key</button
                                >
                                <button
                                    onclick={() => (unlockMode = "passphrase")}
                                    class="px-2 py-1 rounded {unlockMode ===
                                    'passphrase'
                                        ? 'bg-discord-accent text-white'
                                        : 'bg-discord-messageHover text-discord-textPrimary'}"
                                    >Passphrase</button
                                >
                            </div>
                        {/if}
                        <p class="text-xs text-discord-textMuted">
                            Enter your <strong
                                >{effectiveUnlockMode === "key"
                                    ? "recovery key"
                                    : "recovery passphrase"}</strong
                            > to verify this session and restore your encrypted message
                            history.
                        </p>
                        {#if effectiveUnlockMode === "key"}
                            <input
                                type="text"
                                bind:value={unlockKey}
                                placeholder="Recovery key"
                                autocomplete="off"
                                autocapitalize="none"
                                spellcheck="false"
                                onkeydown={(e) =>
                                    e.key === "Enter" &&
                                    unlockReady &&
                                    runUnlock()}
                                class="w-full bg-discord-backgroundDark text-discord-textPrimary font-mono text-sm rounded px-3 py-1.5 outline-none"
                            />
                        {:else}
                            <input
                                type="password"
                                bind:value={unlockPassphrase}
                                placeholder="Recovery passphrase"
                                autocomplete="current-password"
                                onkeydown={(e) =>
                                    e.key === "Enter" &&
                                    unlockReady &&
                                    runUnlock()}
                                class="w-full bg-discord-backgroundDark text-discord-textPrimary text-sm rounded px-3 py-1.5 outline-none"
                            />
                        {/if}
                        <div class="flex gap-2">
                            <button
                                onclick={runUnlock}
                                disabled={!unlockReady}
                                class="px-3 py-1.5 bg-discord-accent text-white rounded text-sm disabled:opacity-50"
                                >Continue</button
                            >
                            <button
                                onclick={cancelUnlock}
                                class="px-3 py-1.5 bg-discord-messageHover text-discord-textPrimary rounded text-sm"
                                >Cancel</button
                            >
                        </div>
                    </div>
                {:else if unlockStep === "working"}
                    <div class="space-y-2">
                        <p class="text-sm text-discord-textPrimary">
                            {progressView.label}
                        </p>
                        <div
                            class="h-1.5 w-full rounded bg-discord-backgroundDark overflow-hidden"
                        >
                            <div
                                class="h-full bg-discord-accent transition-all"
                                style="width: {progressView.percent ?? 15}%"
                            ></div>
                        </div>
                    </div>
                {/if}
            {/if}

            {#if unlockStep === "done" && unlockResult}
                <div class="space-y-2">
                    <p class="text-sm font-medium text-discord-online">
                        {unlockResult.sessionVerified
                            ? "This session is now verified"
                            : "Encrypted history restored"}
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        {restoreResultLabel(unlockResult)}.
                    </p>
                    <button
                        onclick={finishUnlock}
                        class="px-3 py-1.5 bg-discord-messageHover text-discord-textPrimary rounded text-sm"
                        >Done</button
                    >
                </div>
            {/if}

            {#if unlockError}
                <p class="text-sm text-discord-danger">{unlockError}</p>
            {/if}
        </section>
    {/if}
</div>

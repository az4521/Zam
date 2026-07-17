<script lang="ts">
    import {
        getSecurityStatus,
        setupRecovery,
        type SecurityStatus,
    } from "$lib/matrix/crypto";
    import { securityState } from "$lib/stores/security.svelte";
    import { formatRecoveryKey } from "$lib/utils/recoveryKey";

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

    const recoveryDone = $derived(status?.secretStorageReady ?? false);
    const canSetUp = $derived((status?.available ?? false) && !recoveryDone);

    async function loadStatus() {
        status = await getSecurityStatus();
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
        if (!password || step === "working") return;
        error = "";
        step = "working";
        try {
            const result = await setupRecovery(password);
            recoveryKey = result.recoveryKey;
            password = "";
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
        recoveryKey = "";
        saved = false;
        step = "done";
        loadStatus();
    }

    function cancel() {
        // Never leave the plaintext key lingering after a cancel.
        password = "";
        recoveryKey = "";
        saved = false;
        error = "";
        step = "idle";
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
    </section>

    {#if status && !status.available}
        <p class="text-xs text-discord-textMuted">
            End-to-end encryption could not start on this session, so recovery
            can't be set up here. Encrypted rooms will show placeholders.
        </p>
    {/if}

    <!-- Set-up-recovery wizard -->
    {#if canSetUp}
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
                    <div class="flex gap-2">
                        <button
                            onclick={runSetup}
                            disabled={step === "working" || !password}
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
            class="rounded bg-discord-backgroundTertiary px-4 py-4 space-y-1"
        >
            <p class="text-sm font-medium text-discord-textPrimary">
                Recovery is set up
            </p>
            <p class="text-xs text-discord-textMuted">
                Your cross-signing keys and a key backup are stored securely on
                the server, protected by your recovery key.
            </p>
        </section>
    {/if}
</div>

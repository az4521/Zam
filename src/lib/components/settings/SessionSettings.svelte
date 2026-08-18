<script lang="ts">
    import {
        deleteOwnDevice,
        getOwnDeviceId,
        getOwnDevices,
        getOwnUserId,
        renameDevice,
    } from "$lib/matrix/client";
    import {
        describeUserAgent,
        formatLastSeen,
        sortDevices,
        type DeviceInfo,
    } from "$lib/utils/deviceSessions";
    import {
        isCryptoAvailable,
        getOwnDeviceKeyInfo,
        getDeviceTrust,
        applyVerifiedOnlySending,
    } from "$lib/matrix/crypto";
    import { deviceTrustBadge } from "$lib/utils/verification";
    import {
        verificationState,
        verifyOwnDevice,
    } from "$lib/stores/verification.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        settingsState,
        setEncryptNewDms,
        setSendToVerifiedOnly,
    } from "$lib/stores/settings.svelte";

    let devices = $state<DeviceInfo[]>([]);
    let loaded = $state(false);
    let attemptedInitialLoad = false;
    let loading = $state(false);
    let error = $state("");
    let fetchedAt = $state(0);
    let currentId = $state<string | null>(null);
    let renamingId = $state<string | null>(null);
    let renameValue = $state("");
    let renameSaving = $state(false);
    let confirmId = $state<string | null>(null);
    let passwordId = $state<string | null>(null);
    let password = $state("");
    let signOutBusy = $state(false);

    // Read-only E2EE status for this device (Layer 0). Useful for live
    // cross-client verification; carries no actions yet.
    let cryptoActive = $state(false);
    let deviceEd25519 = $state<string | null>(null);

    // Per-device trust (Layer 1): deviceId → reduced verification status, for
    // the badge + Verify button. Reloaded when a verification completes.
    let trust = $state<
        Record<string, { isVerified: boolean; signedByOwner?: boolean } | null>
    >({});
    let verifyError = $state("");

    const current = $derived(
        devices.find((device) => device.deviceId === currentId) ?? null,
    );
    const others = $derived(
        devices.filter((device) => device.deviceId !== currentId),
    );

    async function load() {
        loading = true;
        error = "";
        try {
            currentId = getOwnDeviceId();
            devices = sortDevices(await getOwnDevices(), currentId);
            fetchedAt = Date.now();
            loaded = true;
        } catch (loadError) {
            error = (loadError as Error)?.message ?? "Failed to load sessions";
        } finally {
            loading = false;
        }
    }

    function startRename(device: DeviceInfo) {
        renamingId = device.deviceId;
        renameValue = device.displayName ?? "";
    }

    async function saveRename() {
        if (!renamingId || renameSaving) return;
        renameSaving = true;
        error = "";
        try {
            await renameDevice(renamingId, renameValue.trim());
            renamingId = null;
            await load();
        } catch (renameError) {
            error =
                (renameError as Error)?.message ?? "Failed to rename session";
        } finally {
            renameSaving = false;
        }
    }

    function requestSignOut(deviceId: string) {
        error = "";
        if (confirmId !== deviceId) {
            confirmId = deviceId;
            passwordId = null;
            return;
        }
        void performSignOut(deviceId);
    }

    async function performSignOut(deviceId: string, authPassword?: string) {
        signOutBusy = true;
        error = "";
        try {
            const result = await deleteOwnDevice(deviceId, authPassword);
            if (result === "password-required") {
                passwordId = deviceId;
                password = "";
            } else {
                confirmId = null;
                passwordId = null;
                password = "";
                await load();
            }
        } catch (signOutError) {
            error =
                (signOutError as Error)?.message ??
                "Failed to sign out session";
        } finally {
            signOutBusy = false;
        }
    }

    function cancelSignOut() {
        confirmId = null;
        passwordId = null;
        password = "";
        error = "";
    }

    async function loadCryptoStatus() {
        cryptoActive = isCryptoAvailable();
        const keys = await getOwnDeviceKeyInfo();
        deviceEd25519 = keys?.ed25519 ?? null;
    }

    function toggleVerifiedOnly(value: boolean) {
        setSendToVerifiedOnly(value);
        applyVerifiedOnlySending(value);
    }

    async function loadTrust() {
        if (!isCryptoAvailable()) return;
        const userId = getOwnUserId();
        if (!userId) return;
        const entries = await Promise.all(
            devices.map(
                async (device) =>
                    [
                        device.deviceId,
                        await getDeviceTrust(userId, device.deviceId),
                    ] as const,
            ),
        );
        trust = Object.fromEntries(entries);
    }

    async function startVerify(deviceId: string) {
        verifyError = "";
        try {
            await verifyOwnDevice(deviceId);
        } catch (e) {
            verifyError =
                e instanceof Error ? e.message : "Could not start verification";
        }
    }

    $effect(() => {
        if (!attemptedInitialLoad) {
            attemptedInitialLoad = true;
            load().then(loadTrust);
            loadCryptoStatus();
        }
    });

    // Refresh trust badges when a verification completes (tick bumps on Done).
    let lastSeenTick = 0;
    $effect(() => {
        const tick = verificationState.verificationTick;
        if (tick !== lastSeenTick && loaded) {
            lastSeenTick = tick;
            loadTrust();
        }
    });
</script>

{#snippet deviceRow(device: DeviceInfo, isCurrent: boolean)}
    {@const details = [
        describeUserAgent(device.lastSeenUserAgent),
        `Last seen ${formatLastSeen(device.lastSeenTs, fetchedAt)}`,
        device.lastSeenIp,
    ]
        .filter(Boolean)
        .join(" · ")}
    {@const badge = cryptoActive
        ? deviceTrustBadge(trust[device.deviceId] ?? null)
        : null}
    <div class="rounded bg-discord-backgroundTertiary px-4 py-3 space-y-3">
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
                {#if renamingId === device.deviceId}
                    <div class="flex gap-2">
                        <input
                            bind:value={renameValue}
                            maxlength="100"
                            placeholder="Session name"
                            onkeydown={(event) =>
                                event.key === "Enter" && saveRename()}
                            class="flex-1 bg-discord-backgroundDark text-discord-textPrimary text-sm rounded px-2 py-1 outline-none"
                        />
                        <button
                            onclick={saveRename}
                            disabled={renameSaving}
                            class="px-2.5 py-1 bg-discord-accent text-white rounded text-xs"
                            >{renameSaving ? "Saving…" : "Save"}</button
                        >
                        <button
                            onclick={() => (renamingId = null)}
                            class="px-2.5 py-1 bg-discord-messageHover text-discord-textPrimary rounded text-xs"
                            >Cancel</button
                        >
                    </div>
                {:else}
                    <p
                        class="text-sm font-medium text-discord-textPrimary truncate"
                    >
                        {device.displayName || device.deviceId}
                        {#if isCurrent}<span
                                class="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-discord-accent/20 text-discord-accent"
                                >Current</span
                            >{/if}
                        {#if badge}<span
                                class="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase {badge.tone ===
                                'verified'
                                    ? 'bg-discord-online/20 text-discord-online'
                                    : badge.tone === 'warning'
                                      ? 'bg-discord-warning/20 text-discord-warning'
                                      : 'bg-discord-messageHover text-discord-textMuted'}"
                                >{badge.label}</span
                            >{/if}
                    </p>
                {/if}
                <p class="text-xs text-discord-textMuted font-mono mt-0.5">
                    {device.deviceId}
                </p>
                <p class="text-xs text-discord-textMuted mt-1">{details}</p>
            </div>
            <div class="flex gap-2 flex-shrink-0">
                {#if !isCurrent && badge && badge.tone !== "verified"}
                    <button
                        onclick={() => startVerify(device.deviceId)}
                        class="px-2.5 py-1 bg-discord-accent/20 text-discord-accent rounded text-xs"
                        >Verify</button
                    >
                {/if}
                {#if renamingId !== device.deviceId}
                    <button
                        onclick={() => startRename(device)}
                        class="px-2.5 py-1 bg-discord-messageHover text-discord-textPrimary rounded text-xs"
                        >Rename</button
                    >
                {/if}
                {#if !isCurrent && passwordId !== device.deviceId}
                    <button
                        onclick={() => requestSignOut(device.deviceId)}
                        disabled={signOutBusy}
                        class="px-2.5 py-1 rounded text-xs {confirmId ===
                        device.deviceId
                            ? 'bg-discord-danger text-white'
                            : 'bg-discord-messageHover text-discord-danger'}"
                        >{confirmId === device.deviceId
                            ? "Sign out?"
                            : "Sign out"}</button
                    >
                {/if}
            </div>
        </div>
        {#if passwordId === device.deviceId}
            <div class="pt-3 border-t border-discord-divider space-y-2">
                <p class="text-xs text-discord-textMuted">
                    Confirm your account password to sign out this session.
                </p>
                <div class="flex gap-2">
                    <input
                        type="password"
                        bind:value={password}
                        placeholder="Account password"
                        onkeydown={(event) =>
                            event.key === "Enter" &&
                            password &&
                            performSignOut(device.deviceId, password)}
                        class="flex-1 bg-discord-backgroundDark text-discord-textPrimary text-sm rounded px-3 py-1.5 outline-none"
                    />
                    <button
                        onclick={() =>
                            performSignOut(device.deviceId, password)}
                        disabled={signOutBusy || !password}
                        class="px-3 py-1.5 bg-discord-danger text-white rounded text-xs disabled:opacity-50"
                        >{signOutBusy ? "Signing out…" : "Sign out"}</button
                    >
                    <button
                        onclick={cancelSignOut}
                        class="px-3 py-1.5 bg-discord-messageHover text-discord-textPrimary rounded text-xs"
                        >Cancel</button
                    >
                </div>
            </div>
        {/if}
    </div>
{/snippet}

<div class="space-y-6">
    <section
        class="rounded bg-discord-backgroundTertiary px-4 py-3 space-y-1.5"
    >
        <div class="flex items-center gap-2">
            <span
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                >Encryption</span
            >
            <span
                class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase {cryptoActive
                    ? 'bg-discord-accent/20 text-discord-accent'
                    : 'bg-discord-messageHover text-discord-textMuted'}"
                >{cryptoActive ? "Active" : "Unavailable"}</span
            >
        </div>
        {#if deviceEd25519}
            <p class="text-xs text-discord-textMuted">
                This device's key
                <span
                    class="font-mono text-discord-textPrimary break-all select-all"
                    >{deviceEd25519}</span
                >
            </p>
        {:else if cryptoActive}
            <p class="text-xs text-discord-textMuted">Loading device key…</p>
        {:else}
            <p class="text-xs text-discord-textMuted">
                End-to-end encryption could not start on this session. Encrypted
                rooms will show placeholders.
            </p>
        {/if}
        {#if cryptoActive}
            <div
                class="flex items-center gap-3 pt-2 mt-1 border-t border-discord-divider"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-discord-textPrimary">
                        Encrypt new direct messages
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        New DMs you start are encrypted by default. Existing DMs
                        are left unchanged. Turn this off if you message people
                        whose clients don't support encryption.
                    </p>
                </div>
                <ToggleSwitch
                    checked={settingsState.encryptNewDms}
                    onChange={setEncryptNewDms}
                    label="Encrypt new direct messages"
                />
            </div>
            <div
                class="flex items-center gap-3 pt-2 mt-1 border-t border-discord-divider"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-discord-textPrimary">
                        Only send to verified devices
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        Refuse to encrypt messages for sessions you haven't
                        verified. They will not receive your messages at all -
                        including your own unverified sessions. Off by default.
                    </p>
                </div>
                <ToggleSwitch
                    checked={settingsState.sendToVerifiedOnly}
                    onChange={toggleVerifiedOnly}
                    label="Only send to verified devices"
                />
            </div>
        {/if}
    </section>
    <div class="flex items-center justify-between gap-3">
        <p class="text-xs text-discord-textMuted">
            Devices currently signed in to this account.
        </p>
        <button
            onclick={load}
            disabled={loading}
            class="px-3 py-1.5 rounded text-xs bg-discord-backgroundTertiary text-discord-textPrimary disabled:opacity-50"
            >{loading ? "Refreshing…" : "Refresh"}</button
        >
    </div>
    {#if error}<p class="text-sm text-discord-danger">{error}</p>{/if}
    {#if verifyError}<p class="text-sm text-discord-danger">
            {verifyError}
        </p>{/if}
    {#if current}
        {@render deviceRow(current, true)}
    {:else if loading}
        <p class="text-sm text-discord-textMuted">Loading sessions…</p>
    {/if}
    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Other sessions {loaded ? `(${others.length})` : ""}
        </p>
        {#if loaded && others.length === 0}
            <p class="text-sm text-discord-textMuted">
                No other sessions - you're only signed in here.
            </p>
        {:else}
            <div class="space-y-2">
                {#each others as device (device.deviceId)}
                    {@render deviceRow(device, false)}
                {/each}
            </div>
        {/if}
    </section>
</div>

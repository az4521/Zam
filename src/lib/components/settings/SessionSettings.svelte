<script lang="ts">
    import {
        deleteOwnDevice,
        getOwnDeviceId,
        getOwnDevices,
        renameDevice,
    } from "$lib/matrix/client";
    import {
        describeUserAgent,
        formatLastSeen,
        sortDevices,
        type DeviceInfo,
    } from "$lib/utils/deviceSessions";

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

    $effect(() => {
        if (!attemptedInitialLoad) {
            attemptedInitialLoad = true;
            load();
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
                    </p>
                {/if}
                <p class="text-xs text-discord-textMuted font-mono mt-0.5">
                    {device.deviceId}
                </p>
                <p class="text-xs text-discord-textMuted mt-1">{details}</p>
            </div>
            <div class="flex gap-2 flex-shrink-0">
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
                No other sessions — you're only signed in here.
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

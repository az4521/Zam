<script lang="ts">
    import {
        getSpaces,
        getOrphanRooms,
        getDirectRooms,
        getRoomsInSpace,
        getRoomDisplayName,
        getRoomNotificationSetting,
        setRoomNotificationSetting,
        getDefaultPushRuleLevel,
        setDefaultPushRuleLevel,
        DEFAULT_PUSH_RULES,
        getClient,
        getPushRuleSummary,
        type RoomNotificationSetting,
        type PushRuleLevel,
        type PushRuleSummary,
    } from "$lib/matrix/client";
    import { auth } from "$lib/stores/auth.svelte";
    import {
        APP_VERSION,
        CAN_INSTALL_UPDATE,
        checkForUpdate,
        openReleasePage,
        type UpdateInfo,
    } from "$lib/update";
    import {
        pushDebug,
        fetchRegisteredPushers,
        checkGatewayHealth,
        PUSH_GATEWAY_NOTIFY_URL,
        PUSH_APP_ID,
        type RegisteredPusher,
        type GatewayHealth,
    } from "$lib/push";
    import {
        readNativeSession,
        type NativeSessionState,
    } from "$lib/nativeSession";

    interface Props {
        onClose: () => void;
        onLogout: () => void;
    }

    let { onClose, onLogout }: Props = $props();

    type Tab = "account" | "notifications" | "about" | "debug";
    let activeTab = $state<Tab>("account");

    const tabs: { id: Tab; label: string }[] = [
        { id: "account", label: "Account" },
        { id: "notifications", label: "Notifications" },
        { id: "about", label: "About" },
        { id: "debug", label: "Debug Info" },
    ];

    // ── Debug Info tab ─────────────────────────────────────────────────────────
    let debugLoading = $state(false);
    let debugPushers = $state<RegisteredPusher[] | null>(null);
    let debugPushersError = $state("");
    let gatewayHealth = $state<GatewayHealth | null>(null);
    let nativeSession = $state<NativeSessionState | null>(null);
    let ruleSummary = $state<PushRuleSummary[] | null>(null);

    async function runPushDiagnostics() {
        debugLoading = true;
        debugPushersError = "";
        debugPushers = null;
        gatewayHealth = null;
        nativeSession = null;
        // Catch-all push-rule levels — synchronous, from the live client state.
        ruleSummary = getPushRuleSummary();

        // Each probe assigns its own result as soon as it resolves, so a slow
        // or hung network probe can't prevent the others (notably the local
        // native-session readback) from rendering.
        const client = getClient();
        const tasks: Promise<void>[] = [];

        tasks.push(
            readNativeSession()
                .then((r) => {
                    nativeSession = r;
                })
                .catch((e) => {
                    nativeSession = {
                        native: true,
                        homeserverUrl: null,
                        userId: null,
                        hasToken: false,
                        error: e?.message ?? String(e),
                    };
                }),
        );

        tasks.push(
            checkGatewayHealth()
                .then((r) => {
                    gatewayHealth = r;
                })
                .catch((e) => {
                    gatewayHealth = {
                        reachable: false,
                        status: null,
                        detail: e?.message ?? String(e),
                    };
                }),
        );

        tasks.push(
            (client
                ? fetchRegisteredPushers(client)
                : Promise.resolve([] as RegisteredPusher[])
            )
                .then((r) => {
                    debugPushers = r;
                })
                .catch((e) => {
                    debugPushersError =
                        e?.message ??
                        "Failed to fetch pushers from homeserver.";
                }),
        );

        await Promise.allSettled(tasks);
        debugLoading = false;
    }

    // Whether the homeserver has a pusher pointing at our configured gateway.
    const matchingPusher = $derived(
        debugPushers?.find(
            (p) =>
                p.app_id === PUSH_APP_ID &&
                p.url === PUSH_GATEWAY_NOTIFY_URL,
        ) ?? null,
    );

    // ── About / updates tab ────────────────────────────────────────────────────
    let updateChecking = $state(false);
    let updateInfo = $state<UpdateInfo | null>(null);
    let updateError = $state("");

    async function checkUpdates() {
        updateChecking = true;
        updateError = "";
        updateInfo = null;
        try {
            updateInfo = await checkForUpdate();
        } catch (e: any) {
            updateError = e?.message ?? "Failed to check for updates.";
        } finally {
            updateChecking = false;
        }
    }

    // ── Notifications tab ──────────────────────────────────────────────────────

    type NotifRoom = { roomId: string; name: string };
    type NotifGroup = { label: string; rooms: NotifRoom[] };

    const notifGroups = $derived.by((): NotifGroup[] => {
        const groups: NotifGroup[] = [];
        const spaces = getSpaces();
        for (const space of spaces) {
            const rooms = getRoomsInSpace(space.roomId).map((r) => ({
                roomId: r.roomId,
                name: getRoomDisplayName(r),
            }));
            if (rooms.length > 0) {
                groups.push({ label: getRoomDisplayName(space), rooms });
            }
        }
        const orphans = getOrphanRooms().map((r) => ({
            roomId: r.roomId,
            name: getRoomDisplayName(r),
        }));
        if (orphans.length > 0)
            groups.push({ label: "Other Rooms", rooms: orphans });
        const dms = getDirectRooms().map((r) => ({
            roomId: r.roomId,
            name: getRoomDisplayName(r),
        }));
        if (dms.length > 0)
            groups.push({ label: "Direct Messages", rooms: dms });
        return groups;
    });

    const NOTIF_OPTIONS: {
        value: RoomNotificationSetting;
        label: string;
        desc: string;
    }[] = [
        {
            value: "default",
            label: "Default",
            desc: "Use global notification settings",
        },
        {
            value: "all",
            label: "All Messages",
            desc: "Notify for every message",
        },
        {
            value: "mentions",
            label: "Mentions Only",
            desc: "Notify for mentions only",
        },
        { value: "mute", label: "Mute", desc: "No notifications" },
    ];

    async function setNotif(roomId: string, setting: RoomNotificationSetting) {
        await setRoomNotificationSetting(roomId, setting);
    }

    let defaultRulesTick = $state(0);

    const ruleLevels = $derived.by(() => {
        void defaultRulesTick;
        return Object.fromEntries(
            DEFAULT_PUSH_RULES.map((r) => [
                r.ruleId,
                getDefaultPushRuleLevel(r.ruleId),
            ]),
        ) as Record<string, PushRuleLevel>;
    });

    async function setRuleLevel(
        ruleId: string,
        kind: import("matrix-js-sdk").PushRuleKind,
        level: PushRuleLevel,
    ) {
        await setDefaultPushRuleLevel(ruleId, kind, level);
        defaultRulesTick++;
    }

    // Global notification sound setting (stored locally)
    let soundEnabled = $state(
        localStorage.getItem("notifSoundEnabled") !== "false",
    );
    function toggleSound() {
        soundEnabled = !soundEnabled;
        localStorage.setItem("notifSoundEnabled", String(soundEnabled));
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-1 sm:p-4"
    onclick={(e) => {
        if (e.target === e.currentTarget) onClose();
    }}
>
    <div
        class="bg-discord-backgroundSecondary rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
        style="max-height: 85dvh;"
    >
        <!-- Header -->
        <div
            class="flex items-center justify-between px-6 py-4 border-b border-discord-divider flex-shrink-0"
        >
            <h2 class="text-lg font-bold text-discord-textPrimary">Settings</h2>
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button
                onclick={onClose}
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                    />
                </svg>
            </button>
        </div>

        <div class="flex flex-1 min-h-0">
            <!-- Tab sidebar -->
            <nav
                class="w-40 flex-shrink-0 border-r border-discord-divider py-3 flex flex-col gap-0.5 px-2"
            >
                {#each tabs as tab (tab.id)}
                    <button
                        onclick={() => (activeTab = tab.id)}
                        class="w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors"
                        class:bg-discord-messageHover={activeTab === tab.id}
                        class:text-discord-textPrimary={activeTab === tab.id}
                        class:text-discord-textMuted={activeTab !== tab.id}
                        >{tab.label}</button
                    >
                {/each}
            </nav>

            <!-- Tab content -->
            <div class="flex-1 overflow-y-auto p-6 min-w-0">
                <!-- ── Account ───────────────────────────────────────────── -->
                {#if activeTab === "account"}
                    <div class="space-y-5">
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
                            >
                                Account
                            </p>
                            <div class="space-y-3 text-sm">
                                <div
                                    class="flex justify-between items-center py-2 border-b border-discord-divider"
                                >
                                    <span
                                        class="text-discord-textMuted font-medium"
                                        >User ID</span
                                    >
                                    <span
                                        class="text-discord-textPrimary font-mono text-xs"
                                        >{auth.userId}</span
                                    >
                                </div>
                                <div
                                    class="flex justify-between items-center py-2 border-b border-discord-divider"
                                >
                                    <span
                                        class="text-discord-textMuted font-medium"
                                        >Homeserver</span
                                    >
                                    <span
                                        class="text-discord-textPrimary text-xs"
                                        >{auth.homeserverUrl}</span
                                    >
                                </div>
                                <div
                                    class="flex justify-between items-center py-2 border-b border-discord-divider"
                                >
                                    <span
                                        class="text-discord-textMuted font-medium"
                                        >Sync state</span
                                    >
                                    <span
                                        class="text-discord-textPrimary text-xs"
                                        >{auth.syncState}</span
                                    >
                                </div>
                            </div>
                        </div>
                        <div class="pt-2">
                            <button
                                onclick={onLogout}
                                class="px-4 py-2 bg-discord-danger hover:bg-discord-danger/80 text-white rounded font-medium text-sm transition-colors"
                                >Log Out</button
                            >
                        </div>
                    </div>

                    <!-- ── Notifications ─────────────────────────────────────── -->
                {:else if activeTab === "notifications"}
                    <div class="space-y-6">
                        <!-- Global sound toggle -->
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                            >
                                Sound
                            </p>
                            <div
                                class="flex items-center gap-3 py-2 border-b border-discord-divider"
                            >
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm text-discord-textPrimary">
                                        Notification sound
                                    </p>
                                    <p class="text-xs text-discord-textMuted">
                                        Play a sound for loud notifications
                                    </p>
                                </div>
                                <button
                                    onclick={toggleSound}
                                    class="relative flex-shrink-0 w-10 h-5 rounded-full transition-colors"
                                    class:bg-discord-accent={soundEnabled}
                                    class:bg-discord-backgroundTertiary={!soundEnabled}
                                    title={soundEnabled
                                        ? "Disable sound"
                                        : "Enable sound"}
                                >
                                    <span
                                        class="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                                        class:-translate-x-4={!soundEnabled}
                                    ></span>
                                </button>
                            </div>
                        </div>

                        <!-- Default push rules -->
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1"
                            >
                                Notification Rules
                            </p>
                            <p class="text-xs text-discord-textMuted mb-3">
                                Loud = notify with sound &nbsp;·&nbsp; Silent =
                                notify without sound &nbsp;·&nbsp; Off = no
                                notification
                            </p>
                            <div class="space-y-1">
                                {#each DEFAULT_PUSH_RULES as rule}
                                    <div
                                        class="flex items-center gap-3 py-2 border-b border-discord-divider"
                                    >
                                        <div class="flex-1 min-w-0">
                                            <p
                                                class="text-sm text-discord-textPrimary"
                                            >
                                                {rule.label}
                                            </p>
                                            <p
                                                class="text-xs text-discord-textMuted"
                                            >
                                                {rule.description}
                                            </p>
                                        </div>
                                        <div class="flex gap-1 flex-shrink-0">
                                            {#each ["loud", "silent", "off"] as PushRuleLevel[] as lvl}
                                                <button
                                                    onclick={() =>
                                                        setRuleLevel(
                                                            rule.ruleId,
                                                            rule.kind,
                                                            lvl,
                                                        )}
                                                    class="px-2 py-1 rounded text-xs font-medium transition-colors capitalize"
                                                    class:bg-discord-accent={ruleLevels[
                                                        rule.ruleId
                                                    ] === lvl}
                                                    class:text-white={ruleLevels[
                                                        rule.ruleId
                                                    ] === lvl}
                                                    class:bg-discord-backgroundTertiary={ruleLevels[
                                                        rule.ruleId
                                                    ] !== lvl}
                                                    class:text-discord-textMuted={ruleLevels[
                                                        rule.ruleId
                                                    ] !== lvl}>{lvl}</button
                                                >
                                            {/each}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>

                        <!-- Per-room overrides -->
                        {#if notifGroups.length > 0}
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide -mb-2"
                            >
                                Per-room Overrides
                            </p>
                        {/if}
                        {#each notifGroups as group}
                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                                >
                                    {group.label}
                                </p>
                                <div class="space-y-1">
                                    {#each group.rooms as room}
                                        {@const current =
                                            getRoomNotificationSetting(
                                                room.roomId,
                                            )}
                                        <div
                                            class="flex items-center gap-3 py-2 border-b border-discord-divider"
                                        >
                                            <span
                                                class="flex-1 text-sm text-discord-textPrimary truncate"
                                                >{room.name}</span
                                            >
                                            <div
                                                class="flex gap-1 flex-shrink-0"
                                            >
                                                {#each NOTIF_OPTIONS as opt}
                                                    <button
                                                        onclick={() =>
                                                            setNotif(
                                                                room.roomId,
                                                                opt.value,
                                                            )}
                                                        title={opt.desc}
                                                        class="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                                                        class:bg-discord-accent={current ===
                                                            opt.value}
                                                        class:text-white={current ===
                                                            opt.value}
                                                        class:bg-discord-backgroundTertiary={current !==
                                                            opt.value}
                                                        class:text-discord-textMuted={current !==
                                                            opt.value}
                                                        class:hover:bg-discord-messageHover={current !==
                                                            opt.value}
                                                        >{opt.label}</button
                                                    >
                                                {/each}
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                        {#if notifGroups.length === 0}
                            <p class="text-sm text-discord-textMuted italic">
                                No rooms found.
                            </p>
                        {/if}
                    </div>

                    <!-- ── About ──────────────────────────────────────────────── -->
                {:else if activeTab === "about"}
                    <div class="space-y-6">
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                            >
                                Version
                            </p>
                            <div
                                class="flex items-center gap-3 py-2 border-b border-discord-divider"
                            >
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm text-discord-textPrimary">
                                        Matrix Client
                                    </p>
                                    <p class="text-xs text-discord-textMuted">
                                        Current version v{APP_VERSION}
                                    </p>
                                </div>
                                <button
                                    onclick={checkUpdates}
                                    disabled={updateChecking}
                                    class="px-3 py-1.5 rounded text-sm font-medium bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                                >
                                    {#if updateChecking}
                                        <span
                                            class="w-3.5 h-3.5 border-2 border-discord-textMuted border-t-transparent rounded-full animate-spin"
                                        ></span>
                                        Checking…
                                    {:else}
                                        Check for updates
                                    {/if}
                                </button>
                            </div>
                        </div>

                        {#if updateError}
                            <p class="text-sm text-discord-textMuted">
                                {updateError}
                            </p>
                        {:else if updateInfo}
                            {@const info = updateInfo}
                            {#if info.updateAvailable}
                                <div
                                    class="rounded-lg border border-discord-accent bg-discord-accent/10 p-4 flex items-center gap-4"
                                >
                                    <div class="flex-1 min-w-0">
                                        <p
                                            class="text-sm font-semibold text-discord-textPrimary"
                                        >
                                            Update available
                                        </p>
                                        <p
                                            class="text-xs text-discord-textMuted"
                                        >
                                            v{info.current} → v{info.latest}
                                        </p>
                                    </div>
                                    <button
                                        onclick={() => openReleasePage(info.url)}
                                        disabled={!CAN_INSTALL_UPDATE}
                                        title={CAN_INSTALL_UPDATE
                                            ? ""
                                            : "Reload the page to get the latest web version"}
                                        class="px-4 py-2 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-discord-accent"
                                        >Update</button
                                    >
                                </div>
                            {:else}
                                <p class="text-sm text-discord-textMuted">
                                    You’re on the latest version.
                                </p>
                            {/if}
                        {/if}
                    </div>

                    <!-- ── Debug Info ─────────────────────────────────────────── -->
                {:else if activeTab === "debug"}
                    {@const rows = [
                        ["Platform", pushDebug.native ? "Native (Capacitor)" : "Web/Desktop"],
                        ["Push enabled in build", pushDebug.pushEnabled ? "Yes" : "No"],
                        ["Gateway URL", PUSH_GATEWAY_NOTIFY_URL],
                        ["App ID", PUSH_APP_ID],
                        ["Notification permission", pushDebug.permission],
                        ["FCM token", pushDebug.fcmToken
                            ? pushDebug.fcmToken.slice(0, 12) + "…" + pushDebug.fcmToken.slice(-6)
                            : "(none)"],
                        ["Pusher registered this session", pushDebug.pusherRegistered ? "Yes" : "No"],
                    ] as [string, string][]}
                    <div class="space-y-6">
                        <div>
                            <p
                                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                            >
                                Push Status
                            </p>
                            <div class="space-y-1.5">
                                {#each rows as [label, value]}
                                    <div
                                        class="flex items-start gap-3 text-sm py-1 border-b border-discord-divider"
                                    >
                                        <span
                                            class="text-discord-textMuted flex-shrink-0 w-44"
                                            >{label}</span
                                        >
                                        <span
                                            class="text-discord-textPrimary break-all font-mono text-xs"
                                            >{value}</span
                                        >
                                    </div>
                                {/each}
                            </div>
                            {#if pushDebug.lastError}
                                <p
                                    class="mt-3 text-xs text-discord-error break-all font-mono"
                                >
                                    Last error: {pushDebug.lastError}
                                </p>
                            {/if}
                        </div>

                        <div>
                            <button
                                onclick={runPushDiagnostics}
                                disabled={debugLoading}
                                class="px-3 py-1.5 rounded text-sm font-medium bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {#if debugLoading}
                                    <span
                                        class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"
                                    ></span>
                                    Checking…
                                {:else}
                                    Run diagnostics
                                {/if}
                            </button>
                        </div>

                        <!-- Homeserver pushers -->
                        {#if debugPushers !== null || debugPushersError}
                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                                >
                                    Homeserver Pushers
                                </p>
                                {#if debugPushersError}
                                    <p
                                        class="text-xs text-discord-error break-all"
                                    >
                                        {debugPushersError}
                                    </p>
                                {:else if debugPushers && debugPushers.length === 0}
                                    <p class="text-sm text-discord-textMuted">
                                        The homeserver has no pushers registered
                                        for this account — the gateway URL was
                                        never sent.
                                    </p>
                                {:else if debugPushers}
                                    <p
                                        class="text-sm mb-2 {matchingPusher
                                            ? 'text-green-400'
                                            : 'text-discord-warning'}"
                                    >
                                        {matchingPusher
                                            ? "✓ A pusher matches the configured gateway URL."
                                            : "⚠ No pusher matches the configured gateway URL."}
                                    </p>
                                    <div class="space-y-2">
                                        {#each debugPushers as p}
                                            <div
                                                class="text-xs font-mono bg-discord-backgroundTertiary rounded p-2 space-y-0.5 break-all"
                                            >
                                                <div>
                                                    app_id: {p.app_id}
                                                </div>
                                                <div>url: {p.url ?? "(none)"}</div>
                                                <div>
                                                    device: {p.device_display_name ??
                                                        "(none)"}
                                                </div>
                                                <div>
                                                    pushkey: {p.pushkeyPreview}
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        <!-- Gateway / Firebase health -->
                        {#if gatewayHealth}
                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                                >
                                    Gateway (Sygnal / Firebase)
                                </p>
                                <p
                                    class="text-sm {gatewayHealth.reachable
                                        ? 'text-green-400'
                                        : 'text-discord-error'}"
                                >
                                    {gatewayHealth.reachable
                                        ? "✓ Gateway reachable"
                                        : "✗ Gateway not reachable"}
                                </p>
                                <p
                                    class="text-xs text-discord-textMuted break-all font-mono mt-1"
                                >
                                    {gatewayHealth.detail}
                                </p>
                            </div>
                        {/if}

                        <!-- Native session (used by the background push service) -->
                        {#if nativeSession}
                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                                >
                                    Native Session (push enrichment)
                                </p>
                                {#if !nativeSession.native}
                                    <p class="text-sm text-discord-textMuted">
                                        Not running natively — enrichment only
                                        applies to the Android app.
                                    </p>
                                {:else if nativeSession.error}
                                    <p
                                        class="text-xs text-discord-error break-all"
                                    >
                                        {nativeSession.error}
                                    </p>
                                {:else}
                                    {@const ok =
                                        !!nativeSession.homeserverUrl &&
                                        nativeSession.hasToken}
                                    <p
                                        class="text-sm {ok
                                            ? 'text-green-400'
                                            : 'text-discord-warning'}"
                                    >
                                        {ok
                                            ? "✓ Session mirrored to native storage."
                                            : "⚠ Session not in native storage — notifications can't be enriched."}
                                    </p>
                                    <div
                                        class="text-xs font-mono text-discord-textMuted mt-1 space-y-0.5 break-all"
                                    >
                                        <div>
                                            homeserver: {nativeSession.homeserverUrl ??
                                                "(none)"}
                                        </div>
                                        <div>
                                            user: {nativeSession.userId ??
                                                "(none)"}
                                        </div>
                                        <div>
                                            access token: {nativeSession.hasToken
                                                ? "present"
                                                : "(none)"}
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        <!-- Catch-all push rules (govern background pushes) -->
                        {#if ruleSummary}
                            <div>
                                <p
                                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
                                >
                                    Notification Rules (server)
                                </p>
                                {#if ruleSummary.some((r) => r.ruleId === ".m.rule.message" && r.level !== "off")}
                                    <p
                                        class="text-sm text-discord-warning mb-2"
                                    >
                                        ⚠ "Rooms" is on — you'll be pushed for
                                        every message in every room. Set it to
                                        Off in the Notifications tab unless this
                                        is intended.
                                    </p>
                                {/if}
                                <div
                                    class="text-xs font-mono text-discord-textMuted space-y-0.5"
                                >
                                    {#each ruleSummary as r}
                                        <div class="flex justify-between gap-3">
                                            <span class="break-all"
                                                >{r.label}</span
                                            >
                                            <span
                                                class={r.level === "off"
                                                    ? "text-discord-textMuted"
                                                    : "text-discord-textPrimary"}
                                                >{r.level}</span
                                            >
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

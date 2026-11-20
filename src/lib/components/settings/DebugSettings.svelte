<script lang="ts">
    import { t } from "$lib/i18n";
    import ExtendedProfileDebug from "$lib/components/settings/ExtendedProfileDebug.svelte";
    import GpuDebug from "$lib/components/settings/GpuDebug.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import { pluginRegistry } from "$lib/stores/plugins.svelte";
    import { pluginMount } from "$lib/plugins/pluginMount";
    import { auth } from "$lib/stores/auth.svelte";
    import {
        isSlidingSyncEnabled,
        setSlidingSyncEnabled,
    } from "$lib/matrix/slidingSyncPref";
    import {
        getClient,
        getPushRuleSummary,
        isAccountNotificationsDisabled,
        getSlidingSyncProgress,
        getSlidingSyncFallbackReason,
        stickyEventsAdvertised,
    } from "$lib/matrix/client";
    import {
        checkGatewayHealth,
        fetchRegisteredPushers,
        PUSH_APP_ID,
        PUSH_GATEWAY_NOTIFY_URL,
        pushDebug,
        type GatewayHealth,
        type RegisteredPusher,
    } from "$lib/push";
    import {
        readNativeSession,
        type NativeSessionState,
    } from "$lib/nativeSession";
    import {
        readWebPushState,
        WEBPUSH_APP_ID,
        type WebPushDebug,
    } from "$lib/webPush";
    import {
        setDfAttenuationDb,
        setIgnoreCodecSupport,
        setH264ProfileFix,
        setMicPauseGate,
        setSoundIntervalMs,
        setShowAllEvents,
        setOrderHints,
        setDisableGallerySend,
        setStickyCallMembership,
        setUpdateNagDisabled,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import {
        refreshDecodeSupport,
        setVoiceCaptureConstraints,
    } from "$lib/matrix/livekitCall";
    import {
        DEFAULT_ATTENUATION_DB,
        MAX_ATTENUATION_DB,
        MIN_ATTENUATION_DB,
    } from "$lib/utils/micProcessing";
    import { getSyncLog } from "$lib/matrix/syncLog";
    import {
        eventIndexPrefetchStatus,
        isEventIndexActive,
    } from "$lib/matrix/eventIndex";
    import { historyPrefetchAvailable } from "$lib/matrix/historyPrefetch";
    import type { PrefetchStatus } from "$lib/utils/historyPrefetchPlan";
    import {
        cancelFullIndexBuild,
        indexBuild,
        startFullIndexBuild,
    } from "$lib/stores/indexBuild.svelte";
    import {
        fullIndexPercent,
        groupThousands,
    } from "$lib/utils/fullIndexProgress";
    import { buildLogExport, saveLogExport } from "$lib/logExport";
    import { bootTimeline } from "$lib/utils/bootTiming";
    import {
        canToggleWebViewDebugging,
        getWebViewDebugging,
        setWebViewDebugging,
    } from "$lib/debugTools";
    import {
        getIndexSyncStatus,
        requestIndexSyncNow,
    } from "$lib/matrix/eventIndexSync";
    import { onMount } from "svelte";
    import { showToast } from "$lib/stores/toasts.svelte";

    let loading = $state(false);
    let pushers = $state<RegisteredPusher[] | null>(null);
    let pushersError = $state("");
    let gateway = $state<GatewayHealth | null>(null);
    let nativeSession = $state<NativeSessionState | null>(null);
    let webPush = $state<WebPushDebug | null>(null);
    let rules = $state(getPushRuleSummary());
    const accountNotificationsOff = $derived(isAccountNotificationsDisabled());

    // Snapshot when the panel opens; Refresh re-reads it.
    let syncLog = $state(getSyncLog());
    let syncLogCopied = $state(false);
    async function copySyncLog() {
        syncLog = getSyncLog();
        const text = [
            `state: ${auth.syncState}`,
            `copied: ${new Date().toISOString()}`,
            ...syncLog,
        ].join("\n");
        try {
            await navigator.clipboard.writeText(text);
            syncLogCopied = true;
            setTimeout(() => (syncLogCopied = false), 2000);
        } catch {
            /* clipboard denied: the log is still on screen to select */
        }
    }

    // Startup timing: snapshot when the panel opens; Copy re-reads it.
    let bootSteps = $state(bootTimeline());
    let bootCopied = $state(false);
    async function copyBootTiming() {
        bootSteps = bootTimeline();
        const text = bootSteps
            .map(
                (s) =>
                    `${s.name} +${s.dt.toFixed(1)}ms (at ${s.t.toFixed(1)}ms)`,
            )
            .join("\n");
        try {
            await navigator.clipboard.writeText(text);
            bootCopied = true;
            setTimeout(() => (bootCopied = false), 2000);
        } catch {
            /* clipboard denied: the rows are still on screen */
        }
    }

    // Client logs: everything logCapture.ts kept since launch, redacted.
    let logsBusy = $state(false);
    let logsCopied = $state(false);
    async function copyLogs() {
        logsBusy = true;
        try {
            await navigator.clipboard.writeText(await buildLogExport());
            logsCopied = true;
            setTimeout(() => (logsCopied = false), 2000);
        } catch (e) {
            console.warn("[debug] copying client logs failed", e);
            showToast(t("debugSettings.clientLogsCopyFailed"), {
                tone: "danger",
            });
        } finally {
            logsBusy = false;
        }
    }
    async function saveLogs() {
        logsBusy = true;
        try {
            await saveLogExport();
        } catch (e) {
            console.warn("[debug] saving client logs failed", e);
            showToast(t("debugSettings.clientLogsSaveFailed"), {
                tone: "danger",
            });
        } finally {
            logsBusy = false;
        }
    }

    // Search index sync with our other sessions: polled while the panel is open.
    let indexSync = $state(getIndexSyncStatus());
    // Whether the local index is running (not reactive, so polled with the sync status).
    let indexActive = $state(isEventIndexActive());
    onMount(() => {
        const timer = setInterval(() => {
            indexSync = getIndexSyncStatus();
            indexActive = isEventIndexActive();
        }, 1_000);
        return () => clearInterval(timer);
    });
    onMount(() => {
        if (prefetchOn) void refreshPrefetch();
    });

    // Whether this homeserver advertises MSC4354 sticky events. null while the
    // probe is pending, which leaves the toggle enabled.
    let stickyAdvertised = $state<boolean | null>(null);
    onMount(() => {
        let live = true;
        void stickyEventsAdvertised().then((ok) => {
            if (live) stickyAdvertised = ok;
        });
        return () => {
            live = false;
        };
    });
    // Unsupported and off: nothing to switch on. Unsupported but still on
    // (saved earlier, or on another homeserver) stays switchable so it can be
    // turned off.
    const stickyDisabled = $derived(
        stickyAdvertised === false && !settingsState.stickyCallMembership,
    );

    // Android background download of raw history pages. Read on demand (Refresh).
    const prefetchOn = historyPrefetchAvailable();
    let prefetch = $state<PrefetchStatus | null>(null);
    let prefetchBusy = $state(false);
    async function refreshPrefetch(): Promise<void> {
        if (prefetchBusy) return;
        prefetchBusy = true;
        try {
            prefetch = await eventIndexPrefetchStatus();
        } finally {
            prefetchBusy = false;
        }
    }
    const prefetchRows = $derived(
        prefetch
            ? [
                  [
                      t("debugSettings.prefetchPages"),
                      groupThousands(prefetch.pages),
                  ],
                  [
                      t("debugSettings.prefetchSize"),
                      `${(prefetch.bytes / (1024 * 1024)).toFixed(1)} MB`,
                  ],
                  [
                      t("debugSettings.prefetchRooms"),
                      groupThousands(prefetch.rooms),
                  ],
                  [
                      t("debugSettings.prefetchLastRun"),
                      prefetch.lastRunAt
                          ? new Date(prefetch.lastRunAt).toLocaleString()
                          : t("debugSettings.indexSyncNever"),
                  ],
                  [
                      t("debugSettings.prefetchLastResult"),
                      prefetch.lastResult ?? "-",
                  ],
                  [
                      t("debugSettings.prefetchLastError"),
                      prefetch.lastError ?? "-",
                  ],
              ]
            : [],
    );

    // Full index build: the run lives in indexBuild, so it survives closing this panel.
    const buildState = $derived(indexBuild.value);
    const buildAllowed = $derived(
        settingsState.indexEncryptedRooms && indexActive,
    );
    const buildHint = $derived(
        !settingsState.indexEncryptedRooms
            ? t("debugSettings.searchIndexDisabled")
            : !indexActive
              ? t("debugSettings.searchIndexNotRunning")
              : t("debugSettings.searchIndexHint"),
    );
    const buildPercent = $derived(
        buildState.status === "running"
            ? fullIndexPercent(
                  buildState.progress.roomsDone,
                  buildState.progress.roomsTotal,
              )
            : 0,
    );
    const buildResult = $derived.by(() => {
        if (buildState.status !== "finished") return null;
        const r = buildState.result;
        switch (r.reason) {
            case "complete":
                return t("debugSettings.searchIndexComplete");
            case "partial":
                return t("debugSettings.searchIndexPartial", {
                    failed: r.failedRooms,
                });
            case "storage":
                return t("debugSettings.searchIndexStorage");
            case "aborted":
                return t("debugSettings.searchIndexAborted");
            case "unavailable":
                return t("debugSettings.searchIndexUnavailable");
        }
    });
    const ago = (at: number | null) => {
        if (!at) return t("debugSettings.indexSyncNever");
        const sec = Math.max(0, Math.round((Date.now() - at) / 1000));
        return sec < 90 ? `${sec}s` : `${Math.round(sec / 60)}m`;
    };
    const indexSyncRows = $derived([
        [
            t("debugSettings.indexSyncSessions"),
            `${indexSync.eligibleSessions} / ${indexSync.verifiedSessions} / ${indexSync.otherSessions}`,
        ],
        [
            t("debugSettings.indexSyncAsked"),
            `${indexSync.asks} (${ago(indexSync.lastAskAt)})`,
        ],
        [
            t("debugSettings.indexSyncRoomsMissing"),
            String(indexSync.roomsMissing),
        ],
        [
            t("debugSettings.indexSyncRequestsReceived"),
            String(indexSync.requestsReceived),
        ],
        [
            t("debugSettings.indexSyncChunks"),
            `${indexSync.chunksSent} / ${indexSync.chunksReceived}`,
        ],
        [
            t("debugSettings.indexSyncMerged"),
            `${indexSync.entriesMerged} (${ago(indexSync.lastMergeAt)})`,
        ],
    ] as [string, string][]);

    const webViewDebugAvailable = canToggleWebViewDebugging();
    let webViewDebug = $state(false);
    if (webViewDebugAvailable) {
        getWebViewDebugging().then(
            (on) => (webViewDebug = on),
            () => {},
        );
    }
    async function toggleWebViewDebug(on: boolean) {
        webViewDebug = on;
        try {
            webViewDebug = await setWebViewDebugging(on);
        } catch (e) {
            console.warn("[debug] toggling WebView debugging failed", e);
            webViewDebug = !on;
        }
    }

    // Rebuild the live mic chain with the new tuning (no-op outside a call).
    function applyMicTuning() {
        void setVoiceCaptureConstraints({
            noiseSuppressionMode: settingsState.noiseSuppressionMode,
            echoCancellation: settingsState.echoCancellation,
            micGainMode: settingsState.micGainMode,
        });
    }

    // Flipping the mode needs a fresh client: sliding sync and /sync feed the
    // store differently (each has its own cache), so apply it with a reload.
    function toggleSlidingSync(enabled: boolean) {
        if (!auth.userId) return;
        setSlidingSyncEnabled(auth.userId, enabled);
        window.location.reload();
    }

    const syncRows = $derived.by(() => {
        const client = getClient();
        const progress = getSlidingSyncProgress();
        const sliding = auth.userId ? isSlidingSyncEnabled(auth.userId) : false;
        return [
            [
                t("debugSettings.syncMode"),
                sliding
                    ? t("debugSettings.slidingSyncMsc4186")
                    : t("debugSettings.classicSyncV2"),
            ],
            [t("debugSettings.syncState"), auth.syncState],
            ...(getSlidingSyncFallbackReason()
                ? ([
                      [
                          t("debugSettings.fallback"),
                          getSlidingSyncFallbackReason()!,
                      ],
                  ] as [string, string][])
                : []),
            [
                t("debugSettings.slidingSyncEndpoint"),
                sliding ? auth.homeserverUrl : "(n/a)",
            ],
            [
                t("debugSettings.joinedRoomsLoaded"),
                String(client?.getRooms().length ?? 0),
            ],
            [
                t("debugSettings.roomListWindow"),
                progress
                    ? t("debugSettings.of", {
                          requested: progress.requested,
                          total: progress.total,
                      })
                    : "(n/a)",
            ],
        ] as [string, string][];
    });

    const rows = $derived([
        [
            t("debugSettings.platform"),
            pushDebug.native
                ? t("debugSettings.nativeCapacitor")
                : "Web/Desktop",
        ],
        [
            t("debugSettings.pushEnabledInBuild"),
            pushDebug.pushEnabled
                ? t("debugSettings.yes")
                : t("debugSettings.no"),
        ],
        [t("debugSettings.gatewayUrl"), PUSH_GATEWAY_NOTIFY_URL],
        [t("debugSettings.appId2"), PUSH_APP_ID],
        [t("debugSettings.notificationPermission"), pushDebug.permission],
        [
            t("debugSettings.fcmToken"),
            pushDebug.fcmToken
                ? `${pushDebug.fcmToken.slice(0, 12)}…${pushDebug.fcmToken.slice(-6)}`
                : "(none)",
        ],
        [t("debugSettings.pushProvider"), pushDebug.provider ?? "(none)"],
        ...(pushDebug.provider === "unifiedpush"
            ? ([
                  [
                      t("debugSettings.unifiedPushDistributor"),
                      pushDebug.upDistributor ?? "(none)",
                  ],
                  [
                      t("debugSettings.unifiedPushEndpoint"),
                      pushDebug.upEndpoint
                          ? `${pushDebug.upEndpoint.slice(0, 24)}…${pushDebug.upEndpoint.slice(-6)}`
                          : "(none)",
                  ],
                  [
                      t("debugSettings.unifiedPushGateway"),
                      pushDebug.upGateway ?? "(none)",
                  ],
              ] as [string, string][])
            : []),
        [
            t("debugSettings.pusherRegisteredThisSession"),
            pushDebug.pusherRegistered
                ? t("debugSettings.yes")
                : t("debugSettings.no"),
        ],
    ] as [string, string][]);

    const matchingPusher = $derived(
        pushers?.find(
            (pusher) =>
                pusher.app_id === PUSH_APP_ID &&
                (pusher.url === PUSH_GATEWAY_NOTIFY_URL ||
                    (!!pushDebug.upGateway &&
                        pusher.url === pushDebug.upGateway)),
        ) ?? null,
    );

    async function diagnose() {
        loading = true;
        pushers = null;
        pushersError = "";
        gateway = null;
        nativeSession = null;
        webPush = null;
        rules = getPushRuleSummary();
        const client = getClient();
        await Promise.allSettled([
            readWebPushState().then(
                (result) => (webPush = result),
                (error) =>
                    (webPush = {
                        supported: true,
                        configured: true,
                        permission: "default",
                        subscribed: false,
                        endpoint: null,
                        error: error?.message ?? String(error),
                    }),
            ),
            readNativeSession().then(
                (result) => (nativeSession = result),
                (error) =>
                    (nativeSession = {
                        native: true,
                        homeserverUrl: null,
                        userId: null,
                        deviceId: null,
                        hasToken: false,
                        hideNotificationBody: false,
                        error: error?.message ?? String(error),
                    }),
            ),
            checkGatewayHealth().then(
                (result) => (gateway = result),
                (error) =>
                    (gateway = {
                        reachable: false,
                        status: null,
                        detail: error?.message ?? String(error),
                    }),
            ),
            (client
                ? fetchRegisteredPushers(client)
                : Promise.resolve([] as RegisteredPusher[])
            ).then(
                (result) => (pushers = result),
                (error) =>
                    (pushersError =
                        error?.message ??
                        t("debugSettings.failedToFetchPushersFromHomeserver")),
            ),
        ]);
        loading = false;
    }
</script>

<div class="space-y-6">
    <section>
        <p
            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-2"
        >
            {t("debugSettings.clientLogs")}
        </p>
        <div
            class="flex flex-wrap items-center gap-3 py-2 border-b border-zam-divider"
        >
            <p class="flex-1 min-w-48 text-xs text-zam-textMuted">
                {t("debugSettings.clientLogsHint")}
            </p>
            <div class="flex gap-2">
                <button
                    onclick={copyLogs}
                    disabled={logsBusy}
                    class="px-2.5 py-1 rounded text-xs font-semibold bg-zam-backgroundSecondary hover:bg-zam-messageHover text-zam-textPrimary disabled:opacity-50"
                    >{logsCopied
                        ? t("debugSettings.copied")
                        : t("debugSettings.copyLogs")}</button
                >
                <button
                    onclick={saveLogs}
                    disabled={logsBusy}
                    class="px-2.5 py-1 rounded text-xs font-semibold bg-zam-backgroundSecondary hover:bg-zam-messageHover text-zam-textPrimary disabled:opacity-50"
                    >{t("debugSettings.saveLogs")}</button
                >
            </div>
        </div>
        {#if webViewDebugAvailable}
            <div
                class="flex items-center gap-3 py-2 border-b border-zam-divider"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-zam-textPrimary">
                        {t("debugSettings.webViewDebugging")}
                    </p>
                    <p class="text-xs text-zam-textMuted">
                        {t("debugSettings.webViewDebuggingHint")}
                    </p>
                </div>
                <ToggleSwitch
                    checked={webViewDebug}
                    onChange={toggleWebViewDebug}
                    label={t("debugSettings.webViewDebugging")}
                />
            </div>
        {/if}
    </section>

    <section>
        <p
            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-2"
        >
            {t("debugSettings.startupTiming")}
        </p>
        <div
            class="flex flex-wrap items-center gap-3 py-2 border-b border-zam-divider"
        >
            <p class="flex-1 min-w-48 text-xs text-zam-textMuted">
                {t("debugSettings.startupTimingHint")}
            </p>
            <button
                onclick={copyBootTiming}
                class="px-2.5 py-1 rounded text-xs font-semibold bg-zam-backgroundSecondary hover:bg-zam-messageHover text-zam-textPrimary"
                >{bootCopied
                    ? t("debugSettings.copied")
                    : t("debugSettings.copyTiming")}</button
            >
        </div>
        {#if bootSteps.length === 0}
            <p class="py-2 text-xs text-zam-textMuted">
                {t("debugSettings.startupTimingEmpty")}
            </p>
        {:else}
            <ul class="py-1 font-mono text-xs text-zam-textPrimary">
                {#each bootSteps as step, i (i)}
                    <li class="flex items-baseline gap-3 py-0.5">
                        <span class="flex-1 min-w-0 truncate">{step.name}</span>
                        <span class="text-zam-textMuted tabular-nums">
                            {t("debugSettings.startupTimingRow", {
                                dt: step.dt.toFixed(1),
                                at: step.t.toFixed(1),
                            })}
                        </span>
                    </li>
                {/each}
            </ul>
        {/if}
    </section>

    <section>
        <p
            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-2"
        >
            {t("debugSettings.developer")}
        </p>
        <div class="flex items-center gap-3 py-2 border-b border-zam-divider">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("debugSettings.showAllEvents")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("debugSettings.displayEveryMatrixTimelineEventIn")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.showAllEvents}
                onChange={setShowAllEvents}
                label={t("debugSettings.showAllEvents")}
            />
        </div>
        <div class="flex items-center gap-3 py-2 border-b border-zam-divider">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("debugSettings.orderHints")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("debugSettings.orderHintsHint")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.orderHints}
                onChange={setOrderHints}
                label={t("debugSettings.orderHints")}
            />
        </div>
        <div class="flex items-center gap-3 py-2 border-b border-zam-divider">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("debugSettings.disableGallerySend")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("debugSettings.disableGallerySendHint")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.disableGallerySend}
                onChange={setDisableGallerySend}
                label={t("debugSettings.disableGallerySend")}
            />
        </div>
        <div class="flex items-center gap-3 py-2 border-b border-zam-divider">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("debugSettings.stickyCallMembership")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("debugSettings.stickyCallMembershipHint")}
                </p>
                {#if stickyDisabled}
                    <p class="text-xs text-zam-textMuted">
                        {t("debugSettings.stickyCallMembershipUnsupported")}
                    </p>
                {/if}
            </div>
            <ToggleSwitch
                checked={settingsState.stickyCallMembership}
                onChange={setStickyCallMembership}
                label={t("debugSettings.stickyCallMembership")}
                disabled={stickyDisabled}
            />
        </div>
        <div class="flex items-center gap-3 py-2 border-b border-zam-divider">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("debugSettings.ignoreCodecSupport")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("debugSettings.ignoreCodecSupportHint")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.ignoreCodecSupport}
                onChange={(v) => {
                    setIgnoreCodecSupport(v);
                    refreshDecodeSupport();
                }}
                label={t("debugSettings.ignoreCodecSupport")}
            />
        </div>
        <div class="flex items-center gap-3 py-2 border-b border-zam-divider">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("debugSettings.h264ProfileFix")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("debugSettings.h264ProfileFixHint")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.h264ProfileFix}
                onChange={(v) => {
                    setH264ProfileFix(v);
                    void window.desktop?.gpu?.setH264ProfileFix(v);
                }}
                label={t("debugSettings.h264ProfileFix")}
            />
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-2"
        >
            {t("debugSettings.voiceProcessing")}
        </p>
        <div class="flex items-center gap-3 py-2 border-b border-zam-divider">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("debugSettings.pauseGate")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("debugSettings.pauseGateHint")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.micPauseGate}
                onChange={(v) => {
                    setMicPauseGate(v);
                    applyMicTuning();
                }}
                label={t("debugSettings.pauseGate")}
            />
        </div>
        <div class="flex items-center gap-3 py-2 border-b border-zam-divider">
            <div class="flex-1 min-w-0">
                <label
                    for="df-attenuation"
                    class="text-sm text-zam-textPrimary"
                >
                    {t("debugSettings.noiseAttenuationLimit", {
                        value: settingsState.dfAttenuationDb,
                    })}
                </label>
                <p class="text-xs text-zam-textMuted">
                    {t("debugSettings.noiseAttenuationLimitHint", {
                        value: DEFAULT_ATTENUATION_DB,
                    })}
                </p>
            </div>
            <input
                id="df-attenuation"
                type="range"
                min={MIN_ATTENUATION_DB}
                max={MAX_ATTENUATION_DB}
                step="1"
                class="w-40 flex-shrink-0"
                value={settingsState.dfAttenuationDb}
                oninput={(e) =>
                    setDfAttenuationDb(Number(e.currentTarget.value))}
                onchange={applyMicTuning}
            />
        </div>
        <div class="flex items-center gap-3 py-2 border-b border-zam-divider">
            <div class="flex-1 min-w-0">
                <label
                    for="sound-interval"
                    class="text-sm text-zam-textPrimary"
                >
                    {t("debugSettings.soundboardInterval", {
                        value: settingsState.soundIntervalMs,
                    })}
                </label>
                <p class="text-xs text-zam-textMuted">
                    {t("debugSettings.soundboardIntervalHint")}
                </p>
            </div>
            <input
                id="sound-interval"
                type="range"
                min="0"
                max="5000"
                step="100"
                class="w-40 flex-shrink-0"
                value={settingsState.soundIntervalMs}
                oninput={(e) =>
                    setSoundIntervalMs(Number(e.currentTarget.value))}
            />
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-2"
        >
            {t("debugSettings.syncStatus")}
        </p>
        <div class="flex items-center gap-3 py-2 border-b border-zam-divider">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("debugSettings.useSlidingSync")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("debugSettings.experimentalLoadsRoomsInAGrowing")}
                </p>
            </div>
            <ToggleSwitch
                checked={auth.userId
                    ? isSlidingSyncEnabled(auth.userId)
                    : false}
                onChange={toggleSlidingSync}
                label={t("debugSettings.useSlidingSync")}
            />
        </div>
        {#each syncRows as [label, value]}
            <div
                class="flex items-start gap-3 text-sm py-1 border-b border-zam-divider"
            >
                <span class="text-zam-textMuted flex-shrink-0 w-44"
                    >{label}</span
                >
                <span class="text-zam-textPrimary break-all font-mono text-xs"
                    >{value}</span
                >
            </div>
        {/each}
        <div class="mt-3 flex items-center gap-2">
            <p
                class="flex-1 text-xs font-semibold text-zam-textMuted uppercase tracking-wide"
            >
                {t("debugSettings.syncLog")}
            </p>
            <button
                onclick={() => (syncLog = getSyncLog())}
                class="px-2.5 py-1 rounded text-xs font-semibold bg-zam-backgroundSecondary hover:bg-zam-messageHover text-zam-textPrimary"
                >{t("debugSettings.refresh")}</button
            >
            <button
                onclick={copySyncLog}
                class="px-2.5 py-1 rounded text-xs font-semibold bg-zam-backgroundSecondary hover:bg-zam-messageHover text-zam-textPrimary"
                >{syncLogCopied
                    ? t("debugSettings.copied")
                    : t("common.copy")}</button
            >
        </div>
        {#if syncLog.length === 0}
            <p class="mt-1 text-xs text-zam-textMuted">
                {t("debugSettings.syncLogEmpty")}
            </p>
        {:else}
            <pre
                class="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-zam-backgroundTertiary p-2 text-xs font-mono text-zam-textPrimary select-text">{syncLog.join(
                    "\n",
                )}</pre>
        {/if}
    </section>

    <section>
        <div class="mb-2 flex items-center gap-2">
            <p
                class="flex-1 text-xs font-semibold text-zam-textMuted uppercase tracking-wide"
            >
                {t("debugSettings.indexSync")}
            </p>
            <button
                onclick={() => {
                    requestIndexSyncNow();
                    indexSync = getIndexSyncStatus();
                }}
                disabled={!indexSync.attached}
                class="px-2.5 py-1 rounded text-xs font-semibold bg-zam-backgroundSecondary hover:bg-zam-messageHover text-zam-textPrimary disabled:opacity-50"
                >{t("debugSettings.indexSyncNow")}</button
            >
        </div>
        <p class="mb-2 text-xs text-zam-textMuted">
            {indexSync.attached
                ? t("debugSettings.indexSyncHint")
                : t("debugSettings.indexSyncOff")}
        </p>
        {#each indexSyncRows as [label, value]}
            <div
                class="flex items-start gap-3 text-sm py-1 border-b border-zam-divider"
            >
                <span class="text-zam-textMuted flex-shrink-0 w-44"
                    >{label}</span
                >
                <span class="text-zam-textPrimary break-all font-mono text-xs"
                    >{value}</span
                >
            </div>
        {/each}
        {#if indexSync.log.length > 0}
            <pre
                class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-zam-backgroundTertiary p-2 text-xs font-mono text-zam-textPrimary select-text">{indexSync.log.join(
                    "\n",
                )}</pre>
        {/if}
    </section>

    <section>
        <div class="mb-2 flex items-center gap-2">
            <p
                class="flex-1 text-xs font-semibold text-zam-textMuted uppercase tracking-wide"
            >
                {t("debugSettings.searchIndex")}
            </p>
            {#if buildState.status === "running"}
                <button
                    onclick={cancelFullIndexBuild}
                    class="px-2.5 py-1 rounded text-xs font-semibold bg-zam-backgroundSecondary hover:bg-zam-messageHover text-zam-textPrimary"
                    >{t("debugSettings.searchIndexCancel")}</button
                >
            {:else}
                <button
                    onclick={startFullIndexBuild}
                    disabled={!buildAllowed}
                    class="px-2.5 py-1 rounded text-xs font-semibold bg-zam-backgroundSecondary hover:bg-zam-messageHover text-zam-textPrimary disabled:opacity-50"
                    >{t("debugSettings.searchIndexBuild")}</button
                >
            {/if}
        </div>
        <p class="mb-2 text-xs text-zam-textMuted">{buildHint}</p>
        {#if buildState.status === "running"}
            <div
                role="progressbar"
                aria-label={t("debugSettings.searchIndexBar")}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={buildPercent}
                class="h-2 w-full overflow-hidden rounded bg-zam-backgroundTertiary"
            >
                <div
                    class="h-full bg-zam-accent transition-[width] duration-300"
                    style:width="{buildPercent}%"
                ></div>
            </div>
            <p class="mt-1 text-xs font-mono text-zam-textPrimary">
                {t("debugSettings.searchIndexProgress", {
                    done: buildState.progress.roomsDone,
                    total: buildState.progress.roomsTotal,
                    messages: groupThousands(
                        buildState.progress.messagesIndexed,
                    ),
                })}
            </p>
        {/if}
        {#if buildResult}
            <p class="text-sm text-zam-textPrimary" aria-live="polite">
                {buildResult}
            </p>
        {/if}
        {#if prefetchOn}
            <div class="mt-4 border-t border-zam-divider pt-3">
                <div class="mb-1 flex items-center gap-2">
                    <p
                        class="flex-1 text-xs font-semibold text-zam-textMuted uppercase tracking-wide"
                    >
                        {t("debugSettings.prefetchTitle")}
                    </p>
                    <button
                        onclick={refreshPrefetch}
                        disabled={prefetchBusy}
                        class="px-2.5 py-1 rounded text-xs font-semibold bg-zam-backgroundSecondary hover:bg-zam-messageHover text-zam-textPrimary disabled:opacity-50"
                        >{t("debugSettings.prefetchRefresh")}</button
                    >
                </div>
                <p class="mb-2 text-xs text-zam-textMuted">
                    {t("debugSettings.prefetchHint")}
                </p>
                {#if prefetch}
                    {#each prefetchRows as [label, value]}
                        <div
                            class="flex items-start gap-3 text-sm py-1 border-b border-zam-divider"
                        >
                            <span class="text-zam-textMuted flex-shrink-0 w-44"
                                >{label}</span
                            >
                            <span
                                class="text-zam-textPrimary break-all font-mono text-xs"
                                >{value}</span
                            >
                        </div>
                    {/each}
                {:else}
                    <p class="text-xs text-zam-textMuted">
                        {t("debugSettings.searchIndexNotRunning")}
                    </p>
                {/if}
            </div>
        {/if}
    </section>

    <GpuDebug />

    <ExtendedProfileDebug />

    <!-- Plugin debug tools (zam.ui.addDebugSection). -->
    {#each (void pluginRegistry.tick, pluginRegistry.debugSections) as entry (entry.entryId)}
        <section>
            <p
                class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-2"
            >
                {String(entry.value.title)}
            </p>
            <div
                data-zam-plugin={entry.pluginId}
                use:pluginMount={(el) => entry.value.render(el)}
            ></div>
        </section>
    {/each}

    <section>
        <p
            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-2"
        >
            {t("debugSettings.pushStatus")}
        </p>
        {#each rows as [label, value]}
            <div
                class="flex items-start gap-3 text-sm py-1 border-b border-zam-divider"
            >
                <span class="text-zam-textMuted flex-shrink-0 w-44"
                    >{label}</span
                >
                <span class="text-zam-textPrimary break-all font-mono text-xs"
                    >{value}</span
                >
            </div>
        {/each}
        {#if pushDebug.lastError}
            <p class="mt-3 text-xs text-zam-danger break-all font-mono">
                {t("debugSettings.lastError", {
                    lastError: pushDebug.lastError,
                })}
            </p>
        {/if}
    </section>

    <button
        onclick={diagnose}
        disabled={loading}
        class="px-3 py-1.5 rounded text-sm font-medium bg-zam-accent hover:bg-zam-accentHover text-white disabled:opacity-50"
    >
        {loading ? t("common.checking") : t("debugSettings.runDiagnostics")}
    </button>

    {#if pushers !== null || pushersError}
        <section class="space-y-2">
            <p
                class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide"
            >
                {t("debugSettings.homeserverPushers")}
            </p>
            {#if pushersError}
                <p class="text-xs text-zam-danger break-all">
                    {pushersError}
                </p>
            {:else if pushers?.length === 0}
                <p class="text-sm text-zam-textMuted">
                    {t("debugSettings.theHomeserverHasNoPushersRegistered")}
                </p>
            {:else}
                <p
                    class="text-sm {matchingPusher
                        ? 'text-zam-textPositive'
                        : 'text-zam-warning'}"
                >
                    {matchingPusher
                        ? t("debugSettings.aPusherMatchesTheConfiguredGateway")
                        : t(
                              "debugSettings.noPusherMatchesTheConfiguredGateway",
                          )}
                </p>
                {#each pushers ?? [] as pusher}
                    <div
                        class="text-xs font-mono bg-zam-backgroundTertiary rounded p-2 break-all"
                    >
                        <div>
                            {t("debugSettings.appId", {
                                app_id: pusher.app_id,
                            })}
                        </div>
                        <div>
                            {t("debugSettings.url", {
                                value: pusher.url ?? t("debugSettings.none"),
                            })}
                        </div>
                        <div>
                            {t("debugSettings.pushkey", {
                                pushkeyPreview: pusher.pushkeyPreview,
                            })}
                        </div>
                    </div>
                {/each}
            {/if}
        </section>
    {/if}

    {#if webPush?.supported}
        <section class="space-y-1 text-xs font-mono text-zam-textMuted">
            <p class="font-semibold uppercase tracking-wide text-zam-textMuted">
                {t("debugSettings.webPushPwa")}
            </p>
            <div>
                {t("debugSettings.vapidKey", {
                    value: webPush.configured
                        ? t("debugSettings.set")
                        : t("debugSettings.missing"),
                })}
            </div>
            <div>
                {t("debugSettings.permission", {
                    permission: webPush.permission,
                })}
            </div>
            <div>
                {t("debugSettings.subscription", {
                    value: webPush.subscribed
                        ? t("debugSettings.active")
                        : t("debugSettings.none"),
                })}
            </div>
            <div>
                {t("debugSettings.homeserverPusher", {
                    value: pushers?.some(
                        (pusher) => pusher.app_id === WEBPUSH_APP_ID,
                    )
                        ? "registered"
                        : t("debugSettings.notFound"),
                })}
            </div>
            {#if webPush.error}<div class="text-zam-danger">
                    {t("debugSettings.error", { error: webPush.error })}
                </div>{/if}
        </section>
    {/if}

    {#if gateway}
        <section>
            <p
                class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-2"
            >
                {t("debugSettings.gatewaySygnalFirebase")}
            </p>
            <p
                class="text-sm {gateway.reachable
                    ? 'text-zam-textPositive'
                    : 'text-zam-danger'}"
            >
                {gateway.reachable
                    ? t("debugSettings.gatewayReachable")
                    : t("debugSettings.gatewayNotReachable")}
            </p>
            <p class="text-xs text-zam-textMuted break-all font-mono mt-1">
                {gateway.detail}
            </p>
        </section>
    {/if}

    {#if nativeSession}
        <section class="text-xs text-zam-textMuted space-y-1">
            <p class="font-semibold uppercase tracking-wide">
                {t("debugSettings.nativeSessionPushEnrichment")}
            </p>
            {#if nativeSession.error}
                <p class="text-zam-danger">{nativeSession.error}</p>
            {:else}
                <div>
                    {t("debugSettings.homeserver", {
                        value:
                            nativeSession.homeserverUrl ??
                            t("debugSettings.none"),
                    })}
                </div>
                <div>
                    {t("debugSettings.user", {
                        value: nativeSession.userId ?? t("debugSettings.none"),
                    })}
                </div>
                <div>
                    {t("debugSettings.device", {
                        value:
                            nativeSession.deviceId ?? t("debugSettings.none"),
                    })}
                </div>
                <div>
                    {t("debugSettings.accessToken", {
                        value: nativeSession.hasToken
                            ? "present"
                            : t("debugSettings.none"),
                    })}
                </div>
                <div>
                    {t("debugSettings.hideMessageText", {
                        value: nativeSession.hideNotificationBody
                            ? "on"
                            : "off",
                    })}
                </div>
            {/if}
        </section>
    {/if}

    {#if rules}
        <section>
            <p
                class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-2"
            >
                {t("debugSettings.notificationRulesServer")}
            </p>
            <div class="flex justify-between gap-3 text-xs font-mono">
                <span>{t("debugSettings.allNotificationsMasterRule")}</span
                ><span class={accountNotificationsOff ? "text-zam-warning" : ""}
                    >{accountNotificationsOff === null
                        ? "?"
                        : accountNotificationsOff
                          ? "off"
                          : "on"}</span
                >
            </div>
            {#each rules as rule}
                <div class="flex justify-between gap-3 text-xs font-mono">
                    <span>{rule.label}</span><span>{rule.level}</span>
                </div>
            {/each}
        </section>
    {/if}

    <section>
        <div class="flex items-center gap-3 py-2">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("debugSettings.hideUpdatePrompts")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("debugSettings.hideUpdatePromptsHint")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.updateNagDisabled}
                onChange={setUpdateNagDisabled}
                label={t("debugSettings.hideUpdatePrompts")}
            />
        </div>
    </section>
</div>

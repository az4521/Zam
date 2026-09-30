<script lang="ts">
    import { t } from "$lib/i18n";
    import ExtendedProfileDebug from "$lib/components/settings/ExtendedProfileDebug.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import {
        isSlidingSyncEnabled,
        setSlidingSyncEnabled,
    } from "$lib/matrix/slidingSyncPref";
    import {
        getClient,
        getPushRuleSummary,
        getSlidingSyncProgress,
        getSlidingSyncFallbackReason,
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
        setShowAllEvents,
        settingsState,
    } from "$lib/stores/settings.svelte";

    let loading = $state(false);
    let pushers = $state<RegisteredPusher[] | null>(null);
    let pushersError = $state("");
    let gateway = $state<GatewayHealth | null>(null);
    let nativeSession = $state<NativeSessionState | null>(null);
    let webPush = $state<WebPushDebug | null>(null);
    let rules = $state(getPushRuleSummary());

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
                pusher.url === PUSH_GATEWAY_NOTIFY_URL,
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
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            {t("debugSettings.developer")}
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("debugSettings.showAllEvents")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("debugSettings.displayEveryMatrixTimelineEventIn")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.showAllEvents}
                onChange={setShowAllEvents}
                label={t("debugSettings.showAllEvents")}
            />
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            {t("debugSettings.syncStatus")}
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("debugSettings.useSlidingSync")}
                </p>
                <p class="text-xs text-discord-textMuted">
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
                class="flex items-start gap-3 text-sm py-1 border-b border-discord-divider"
            >
                <span class="text-discord-textMuted flex-shrink-0 w-44"
                    >{label}</span
                >
                <span
                    class="text-discord-textPrimary break-all font-mono text-xs"
                    >{value}</span
                >
            </div>
        {/each}
    </section>

    <ExtendedProfileDebug />

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            {t("debugSettings.pushStatus")}
        </p>
        {#each rows as [label, value]}
            <div
                class="flex items-start gap-3 text-sm py-1 border-b border-discord-divider"
            >
                <span class="text-discord-textMuted flex-shrink-0 w-44"
                    >{label}</span
                >
                <span
                    class="text-discord-textPrimary break-all font-mono text-xs"
                    >{value}</span
                >
            </div>
        {/each}
        {#if pushDebug.lastError}
            <p class="mt-3 text-xs text-discord-danger break-all font-mono">
                {t("debugSettings.lastError", {
                    lastError: pushDebug.lastError,
                })}
            </p>
        {/if}
    </section>

    <button
        onclick={diagnose}
        disabled={loading}
        class="px-3 py-1.5 rounded text-sm font-medium bg-discord-accent hover:bg-discord-accentHover text-white disabled:opacity-50"
    >
        {loading ? t("common.checking") : t("debugSettings.runDiagnostics")}
    </button>

    {#if pushers !== null || pushersError}
        <section class="space-y-2">
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
            >
                {t("debugSettings.homeserverPushers")}
            </p>
            {#if pushersError}
                <p class="text-xs text-discord-danger break-all">
                    {pushersError}
                </p>
            {:else if pushers?.length === 0}
                <p class="text-sm text-discord-textMuted">
                    {t("debugSettings.theHomeserverHasNoPushersRegistered")}
                </p>
            {:else}
                <p
                    class="text-sm {matchingPusher
                        ? 'text-discord-textPositive'
                        : 'text-discord-warning'}"
                >
                    {matchingPusher
                        ? t("debugSettings.aPusherMatchesTheConfiguredGateway")
                        : t(
                              "debugSettings.noPusherMatchesTheConfiguredGateway",
                          )}
                </p>
                {#each pushers ?? [] as pusher}
                    <div
                        class="text-xs font-mono bg-discord-backgroundTertiary rounded p-2 break-all"
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
        <section class="space-y-1 text-xs font-mono text-discord-textMuted">
            <p
                class="font-semibold uppercase tracking-wide text-discord-textMuted"
            >
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
            {#if webPush.error}<div class="text-discord-danger">
                    {t("debugSettings.error", { error: webPush.error })}
                </div>{/if}
        </section>
    {/if}

    {#if gateway}
        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
            >
                {t("debugSettings.gatewaySygnalFirebase")}
            </p>
            <p
                class="text-sm {gateway.reachable
                    ? 'text-discord-textPositive'
                    : 'text-discord-danger'}"
            >
                {gateway.reachable
                    ? t("debugSettings.gatewayReachable")
                    : t("debugSettings.gatewayNotReachable")}
            </p>
            <p class="text-xs text-discord-textMuted break-all font-mono mt-1">
                {gateway.detail}
            </p>
        </section>
    {/if}

    {#if nativeSession}
        <section class="text-xs text-discord-textMuted space-y-1">
            <p class="font-semibold uppercase tracking-wide">
                {t("debugSettings.nativeSessionPushEnrichment")}
            </p>
            {#if nativeSession.error}
                <p class="text-discord-danger">{nativeSession.error}</p>
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
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
            >
                {t("debugSettings.notificationRulesServer")}
            </p>
            {#each rules as rule}
                <div class="flex justify-between gap-3 text-xs font-mono">
                    <span>{rule.label}</span><span>{rule.level}</span>
                </div>
            {/each}
        </section>
    {/if}
</div>

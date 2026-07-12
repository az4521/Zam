<script lang="ts">
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import { getClient, getPushRuleSummary } from "$lib/matrix/client";
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

    const rows = $derived([
        ["Platform", pushDebug.native ? "Native (Capacitor)" : "Web/Desktop"],
        ["Push enabled in build", pushDebug.pushEnabled ? "Yes" : "No"],
        ["Gateway URL", PUSH_GATEWAY_NOTIFY_URL],
        ["App ID", PUSH_APP_ID],
        ["Notification permission", pushDebug.permission],
        [
            "FCM token",
            pushDebug.fcmToken
                ? `${pushDebug.fcmToken.slice(0, 12)}…${pushDebug.fcmToken.slice(-6)}`
                : "(none)",
        ],
        [
            "Pusher registered this session",
            pushDebug.pusherRegistered ? "Yes" : "No",
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
                        hasToken: false,
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
                        "Failed to fetch pushers from homeserver."),
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
            Developer
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">Show all events</p>
                <p class="text-xs text-discord-textMuted">
                    Display every Matrix timeline event in the chat log.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.showAllEvents}
                onChange={setShowAllEvents}
                label="Show all events"
            />
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            Push Status
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
            <p class="mt-3 text-xs text-discord-error break-all font-mono">
                Last error: {pushDebug.lastError}
            </p>
        {/if}
    </section>

    <button
        onclick={diagnose}
        disabled={loading}
        class="px-3 py-1.5 rounded text-sm font-medium bg-discord-accent hover:bg-discord-accentHover text-white disabled:opacity-50"
    >
        {loading ? "Checking…" : "Run diagnostics"}
    </button>

    {#if pushers !== null || pushersError}
        <section class="space-y-2">
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
            >
                Homeserver Pushers
            </p>
            {#if pushersError}
                <p class="text-xs text-discord-error break-all">
                    {pushersError}
                </p>
            {:else if pushers?.length === 0}
                <p class="text-sm text-discord-textMuted">
                    The homeserver has no pushers registered for this account.
                </p>
            {:else}
                <p
                    class="text-sm {matchingPusher
                        ? 'text-green-400'
                        : 'text-discord-warning'}"
                >
                    {matchingPusher
                        ? "A pusher matches the configured gateway URL."
                        : "No pusher matches the configured gateway URL."}
                </p>
                {#each pushers ?? [] as pusher}
                    <div
                        class="text-xs font-mono bg-discord-backgroundTertiary rounded p-2 break-all"
                    >
                        <div>app_id: {pusher.app_id}</div>
                        <div>url: {pusher.url ?? "(none)"}</div>
                        <div>pushkey: {pusher.pushkeyPreview}</div>
                    </div>
                {/each}
            {/if}
        </section>
    {/if}

    {#if webPush?.supported}
        <section class="space-y-1 text-xs font-mono text-discord-textMuted">
            <p
                class="font-sans font-semibold uppercase tracking-wide text-discord-textMuted"
            >
                Web Push (PWA)
            </p>
            <div>VAPID key: {webPush.configured ? "set" : "(missing)"}</div>
            <div>permission: {webPush.permission}</div>
            <div>
                subscription: {webPush.subscribed ? "active" : "(none)"}
            </div>
            <div>
                homeserver pusher: {pushers?.some(
                    (pusher) => pusher.app_id === WEBPUSH_APP_ID,
                )
                    ? "registered"
                    : "not found"}
            </div>
            {#if webPush.error}<div class="text-discord-error">
                    error: {webPush.error}
                </div>{/if}
        </section>
    {/if}

    {#if gateway}
        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
            >
                Gateway (Sygnal / Firebase)
            </p>
            <p
                class="text-sm {gateway.reachable
                    ? 'text-green-400'
                    : 'text-discord-error'}"
            >
                {gateway.reachable
                    ? "Gateway reachable"
                    : "Gateway not reachable"}
            </p>
            <p class="text-xs text-discord-textMuted break-all font-mono mt-1">
                {gateway.detail}
            </p>
        </section>
    {/if}

    {#if nativeSession}
        <section class="text-xs text-discord-textMuted space-y-1">
            <p class="font-semibold uppercase tracking-wide">
                Native Session (push enrichment)
            </p>
            {#if nativeSession.error}
                <p class="text-discord-error">{nativeSession.error}</p>
            {:else}
                <div>homeserver: {nativeSession.homeserverUrl ?? "(none)"}</div>
                <div>user: {nativeSession.userId ?? "(none)"}</div>
                <div>
                    access token: {nativeSession.hasToken
                        ? "present"
                        : "(none)"}
                </div>
            {/if}
        </section>
    {/if}

    {#if rules}
        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
            >
                Notification Rules (server)
            </p>
            {#each rules as rule}
                <div class="flex justify-between gap-3 text-xs font-mono">
                    <span>{rule.label}</span><span>{rule.level}</span>
                </div>
            {/each}
        </section>
    {/if}
</div>

<script lang="ts">
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import { getClient } from "$lib/matrix/client";
    import {
        pushDebug,
        verifyPushGateways,
        PUSH_GATEWAY_NOTIFY_URL,
    } from "$lib/push";
    import type { PusherGatewayStatus } from "$lib/utils/pusherVerification";

    // SEC-L4: after login, re-read the pushers the homeserver actually kept and
    // report whether it honoured our gateway URL. null while the check is in
    // flight or when there is no client to ask.
    let gatewayStatus = $state<PusherGatewayStatus | null>(null);
    onMount(async () => {
        const client = getClient();
        if (!client) return;
        gatewayStatus = await verifyPushGateways(client).catch(() => null);
    });
</script>

<section data-setting-anchor="debug-push">
    <p
        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
    >
        {t("pushDiagnostics.pushGateway")}
    </p>
    <div class="py-2 border-b border-discord-divider">
        <p class="text-sm text-discord-textPrimary">
            {t("pushDiagnostics.notificationRelay")}
        </p>
        <p class="text-xs text-discord-textMuted mb-1">
            {t("pushDiagnostics.pushNotificationsAreRelayedThroughThis")}
        </p>
        <p class="text-xs font-mono text-discord-textMuted break-all">
            {pushDebug.provider === "unifiedpush" && pushDebug.upGateway
                ? pushDebug.upGateway
                : PUSH_GATEWAY_NOTIFY_URL}
        </p>
        {#if gatewayStatus?.status === "mismatch"}
            <p class="text-xs text-discord-danger mt-1">
                {t("pushDiagnostics.warningYourHomeserverIsRoutingThis", {
                    join: gatewayStatus.mismatchedUrls.join(", "),
                })}
            </p>
        {:else if gatewayStatus?.status === "verified"}
            <p class="text-xs text-discord-textPositive mt-1">
                {t(
                    "pushDiagnostics.verifiedYourHomeserverRoutesNotificationsTo",
                )}
            </p>
        {:else if gatewayStatus?.status === "none"}
            <p class="text-xs text-discord-textMuted mt-1 italic">
                {t("pushDiagnostics.noPushNotificationsAreRegisteredOn")}
            </p>
        {/if}
    </div>
</section>

<script lang="ts">
    import { onMount } from "svelte";
    import { getClient } from "$lib/matrix/client";
    import { verifyPushGateways, PUSH_GATEWAY_NOTIFY_URL } from "$lib/push";
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
        Push Gateway
    </p>
    <div class="py-2 border-b border-discord-divider">
        <p class="text-sm text-discord-textPrimary">Notification relay</p>
        <p class="text-xs text-discord-textMuted mb-1">
            Push notifications are relayed through this gateway. It can see
            which rooms and senders notify you, but never your message text.
        </p>
        <p class="text-xs font-mono text-discord-textMuted break-all">
            {PUSH_GATEWAY_NOTIFY_URL}
        </p>
        {#if gatewayStatus?.status === "mismatch"}
            <p class="text-xs text-discord-danger mt-1">
                Warning: your homeserver is routing this device's push
                notifications to a different gateway ({gatewayStatus.mismatchedUrls.join(
                    ", ",
                )}). That gateway, not the one above, sees your notification
                metadata.
            </p>
        {:else if gatewayStatus?.status === "verified"}
            <p class="text-xs text-discord-textPositive mt-1">
                Verified: your homeserver routes notifications to this gateway.
            </p>
        {:else if gatewayStatus?.status === "none"}
            <p class="text-xs text-discord-textMuted mt-1 italic">
                No push notifications are registered on this account yet.
            </p>
        {/if}
    </div>
</section>

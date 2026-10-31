<script lang="ts">
    import { t } from "$lib/i18n";
    import { Send } from "lucide-svelte";
    import type { MatrixEvent } from "matrix-js-sdk";
    import {
        acceptOffer,
        cancelTransfer,
        withdrawOffer,
    } from "$lib/matrix/fileTransfer";
    import { getClient } from "$lib/matrix/runtime";
    import {
        isOffered,
        transfersFor,
        type TransferFailure,
        type TransferView,
    } from "$lib/stores/fileTransfers.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import {
        formatTransferBytes,
        parseFileOffer,
    } from "$lib/utils/fileTransfer";
    import type { MessageKey } from "$lib/i18n/en";

    interface Props {
        event: MatrixEvent;
    }

    let { event }: Props = $props();

    const FAILURE_TEXT: Record<TransferFailure, MessageKey> = {
        offline: "fileOffer.failedOffline",
        refused: "fileOffer.failedRefused",
        "no-sfu": "fileOffer.failedNoSfu",
        connection: "fileOffer.failedConnection",
        stalled: "fileOffer.failedStalled",
        corrupt: "fileOffer.failedCorrupt",
        "write-failed": "fileOffer.failedWrite",
        "storage-full": "fileOffer.failedStorageFull",
        "hash-mismatch": "fileOffer.failedHash",
        unsupported: "fileOffer.failedUnsupported",
    };

    const offer = $derived(parseFileOffer(event.getContent()));
    const sender = $derived(event.getSender() ?? "");
    const client = $derived(getClient());
    const fromThisDevice = $derived(
        !!offer &&
            sender === client?.getUserId() &&
            offer.senderDevice === client?.getDeviceId(),
    );
    const fromMyOtherDevice = $derived(
        sender === client?.getUserId() && !fromThisDevice,
    );
    const views = $derived(offer ? transfersFor(offer.transferId) : []);
    const incoming = $derived(views.find((v) => v.direction === "receive"));
    const outgoing = $derived(views.filter((v) => v.direction === "send"));
    const stillOffered = $derived(!!offer && isOffered(offer.transferId));
    const expired = $derived(!!offer && offer.expiresTs < Date.now());
    const canAccept = $derived(
        !fromThisDevice &&
            !expired &&
            (!incoming ||
                incoming.phase === "failed" ||
                incoming.phase === "cancelled"),
    );

    function displayName(userId: string): string {
        const room = client?.getRoom(event.getRoomId() ?? "");
        return room?.getMember(userId)?.name ?? userId;
    }

    function percent(view: TransferView): number {
        return view.total > 0 ? (view.bytes / view.total) * 100 : 0;
    }

    function isActive(view: TransferView): boolean {
        return (
            view.phase === "connecting" ||
            view.phase === "transferring" ||
            view.phase === "verifying"
        );
    }

    function statusText(view: TransferView): string {
        switch (view.phase) {
            case "connecting":
                return t("fileOffer.connecting");
            case "verifying":
                return t("fileOffer.verifying");
            case "cancelled":
                return t("fileOffer.cancelled");
            case "done":
                return view.direction === "receive"
                    ? t("fileOffer.savedDone")
                    : t("fileOffer.sentDone", {
                          peer: displayName(view.peerUserId),
                      });
            case "failed":
                return t(FAILURE_TEXT[view.failure ?? "connection"]);
            default:
                return t("fileOffer.progress", {
                    done: formatTransferBytes(view.bytes),
                    total: formatTransferBytes(view.total),
                    rate: formatTransferBytes(Math.round(view.rate)),
                });
        }
    }

    function accept() {
        if (!offer) return;
        acceptOffer(event.getRoomId() ?? "", sender, offer).catch((err) => {
            console.error("Failed to accept file:", err);
            showErrorToast(t("fileOffer.failedConnection"));
        });
    }

    function withdraw() {
        if (!offer) return;
        withdrawOffer(offer.transferId).catch((err) => {
            console.error("Failed to withdraw file offer:", err);
            showErrorToast(t("fileOffer.failedConnection"));
        });
    }
</script>

{#snippet progress(view: TransferView)}
    <div class="mt-2">
        <p class="text-xs text-discord-textMuted" aria-live="polite">
            {statusText(view)}
        </p>
        {#if isActive(view)}
            <div class="mt-1 flex items-center gap-2">
                <div
                    class="h-1 flex-1 rounded-full bg-discord-background overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round(percent(view))}
                    aria-valuemin="0"
                    aria-valuemax="100"
                >
                    <div
                        class="h-full bg-discord-accent transition-[width]"
                        style:width="{percent(view)}%"
                    ></div>
                </div>
                <button
                    class="text-xs text-discord-textMuted hover:text-discord-textPrimary"
                    onclick={() =>
                        offer && cancelTransfer(view.id, offer.transferId)}
                >
                    {t("fileOffer.cancel")}
                </button>
            </div>
        {/if}
    </div>
{/snippet}

<div
    class="mt-1 max-w-md rounded-lg border border-discord-divider bg-discord-backgroundSecondary px-3 py-2.5"
>
    {#if !offer}
        <p class="text-sm text-discord-textMuted">
            {t("fileOffer.unavailable")}
        </p>
    {:else}
        <div class="flex items-center gap-2.5">
            <Send size={20} class="flex-shrink-0 text-discord-textMuted" />
            <div class="min-w-0">
                <p
                    class="truncate text-sm font-semibold text-discord-textPrimary"
                    title={offer.name}
                >
                    {offer.name}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("fileOffer.details", {
                        size: formatTransferBytes(offer.size),
                    })}
                </p>
            </div>
        </div>

        {#if fromThisDevice}
            {#each outgoing as view (view.id)}
                <p class="mt-2 text-xs text-discord-textPrimary">
                    {t("fileOffer.sendingTo", {
                        peer: displayName(view.peerUserId),
                    })}
                </p>
                {@render progress(view)}
            {/each}
            {#if stillOffered}
                {#if outgoing.length === 0}
                    <p class="mt-2 text-xs text-discord-textMuted">
                        {expired
                            ? t("fileOffer.expired")
                            : t("fileOffer.waiting")}
                    </p>
                {/if}
                <button
                    class="mt-2 px-2.5 py-1 rounded bg-discord-danger hover:bg-discord-dangerHover text-white text-xs font-semibold transition-colors"
                    onclick={withdraw}
                >
                    {t("fileOffer.withdraw")}
                </button>
            {:else}
                <p class="mt-2 text-xs text-discord-textMuted">
                    {t("fileOffer.gone")}
                </p>
            {/if}
        {:else}
            {#if incoming}
                {@render progress(incoming)}
            {:else if fromMyOtherDevice}
                <p class="mt-2 text-xs text-discord-textMuted">
                    {t("fileOffer.fromElsewhere")}
                </p>
            {:else if expired}
                <p class="mt-2 text-xs text-discord-textMuted">
                    {t("fileOffer.expired")}
                </p>
            {/if}
            {#if canAccept}
                <button
                    class="mt-2 px-3 py-1.5 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-xs font-semibold transition-colors"
                    onclick={accept}
                >
                    {incoming ? t("fileOffer.retry") : t("fileOffer.accept")}
                </button>
            {/if}
        {/if}
    {/if}
</div>

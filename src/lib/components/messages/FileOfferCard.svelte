<script lang="ts">
    import { t } from "$lib/i18n";
    import { Send } from "lucide-svelte";
    import { untrack } from "svelte";
    import type { MatrixEvent } from "matrix-js-sdk";
    import {
        acceptOffer,
        cancelTransfer,
        offerFromSenderDevice,
        withdrawOffer,
    } from "$lib/matrix/fileTransfer";
    import { getClient } from "$lib/matrix/runtime";
    import {
        acceptedOnDevice,
        isOffered,
        transfersFor,
        type TransferFailure,
        type TransferView,
    } from "$lib/stores/fileTransfers.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import {
        formatTransferBytes,
        offerExpiresAt,
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
        "no-relay": "fileOffer.failedNoRelay",
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
    const expired = $derived(
        !!offer && offerExpiresAt(offer, event.getTs()) < Date.now(),
    );
    const acceptedElsewhere = $derived(
        event.getId() ? acceptedOnDevice(event.getId() ?? "") : null,
    );
    // null while the check runs; false when the device proof fails or throws.
    let fromNamedDevice = $state<boolean | null>(null);
    $effect(() => {
        const current = event;
        fromNamedDevice = null;
        let stale = false;
        untrack(() =>
            offerFromSenderDevice(current)
                .then((ok) => {
                    if (!stale) fromNamedDevice = ok;
                })
                .catch((err) => {
                    // Not proven is not trusted: a failed check counts as false.
                    console.warn("[file-transfer] offer check", err);
                    if (!stale) fromNamedDevice = false;
                }),
        );
        return () => {
            stale = true;
        };
    });
    const untrusted = $derived(fromNamedDevice === false && !fromThisDevice);
    // Accept needs the device proof itself: while the check runs it is disabled.
    const verified = $derived(fromThisDevice || fromNamedDevice === true);
    const canAccept = $derived(
        !fromThisDevice &&
            !expired &&
            !untrusted &&
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
            view.phase === "preparing" ||
            view.phase === "transferring" ||
            view.phase === "verifying"
        );
    }

    function statusText(view: TransferView): string {
        switch (view.phase) {
            case "preparing":
                return view.direction === "receive"
                    ? t("fileOffer.preparingReceive")
                    : t("fileOffer.preparingSend");
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
        if (!offer || !verified) return;
        acceptOffer(
            event.getRoomId() ?? "",
            event.getId() ?? "",
            sender,
            offer,
        ).catch((err) => {
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
        <p class="text-xs text-zam-textMuted" aria-live="polite">
            {statusText(view)}
        </p>
        {#if isActive(view)}
            <div class="mt-1 flex items-center gap-2">
                <div
                    class="h-1 flex-1 rounded-full bg-zam-background overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round(percent(view))}
                    aria-valuemin="0"
                    aria-valuemax="100"
                >
                    <div
                        class="h-full bg-zam-accent transition-[width]"
                        style:width="{percent(view)}%"
                    ></div>
                </div>
                <button
                    class="text-xs text-zam-textMuted hover:text-zam-textPrimary"
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
    class="mt-1 max-w-md rounded-lg border border-zam-divider bg-zam-backgroundSecondary px-3 py-2.5"
>
    {#if !offer}
        <p class="text-sm text-zam-textMuted">
            {t("fileOffer.unavailable")}
        </p>
    {:else}
        <div class="flex items-center gap-2.5">
            <Send size={20} class="flex-shrink-0 text-zam-textMuted" />
            <div class="min-w-0">
                <p
                    class="truncate text-sm font-semibold text-zam-textPrimary"
                    title={offer.name}
                >
                    {offer.name}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("fileOffer.details", {
                        size: formatTransferBytes(offer.size),
                    })}
                </p>
            </div>
        </div>

        {#if fromThisDevice}
            {#each outgoing as view (view.id)}
                <p class="mt-2 text-xs text-zam-textPrimary">
                    {t("fileOffer.sendingTo", {
                        peer: displayName(view.peerUserId),
                    })}
                </p>
                {@render progress(view)}
            {/each}
            {#if stillOffered}
                {#if outgoing.length === 0}
                    <p class="mt-2 text-xs text-zam-textMuted">
                        {expired
                            ? t("fileOffer.expired")
                            : t("fileOffer.waiting")}
                    </p>
                {/if}
                <button
                    class="mt-2 px-2.5 py-1 rounded bg-zam-danger hover:bg-zam-dangerHover text-white text-xs font-semibold transition-colors"
                    onclick={withdraw}
                >
                    {t("fileOffer.withdraw")}
                </button>
            {:else}
                <p class="mt-2 text-xs text-zam-textMuted">
                    {t("fileOffer.gone")}
                </p>
            {/if}
        {:else}
            {#if incoming}
                {@render progress(incoming)}
            {:else if fromMyOtherDevice}
                <p class="mt-2 text-xs text-zam-textMuted">
                    {t("fileOffer.fromElsewhere")}
                </p>
            {:else if expired}
                <p class="mt-2 text-xs text-zam-textMuted">
                    {t("fileOffer.expired")}
                </p>
            {/if}
            {#if acceptedElsewhere && views.length === 0 && !untrusted}
                <p class="mt-2 text-xs text-zam-textMuted">
                    {t("fileOffer.acceptedElsewhere", {
                        device: acceptedElsewhere,
                    })}
                </p>
            {/if}
            {#if canAccept}
                <button
                    class="mt-2 px-3 py-1.5 rounded bg-zam-accent hover:bg-zam-accentHover text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!verified}
                    onclick={accept}
                >
                    {incoming ? t("fileOffer.retry") : t("fileOffer.accept")}
                </button>
            {:else if untrusted}
                <p class="mt-2 text-xs text-zam-danger">
                    {t("fileOffer.untrusted")}
                </p>
            {/if}
        {/if}
    {/if}
</div>

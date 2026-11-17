<script lang="ts">
    import { t } from "$lib/i18n";
    import { ShieldQuestion } from "lucide-svelte";
    import {
        verificationState,
        acceptIncoming,
        declineIncoming,
        isAcceptingRequest,
        acceptRequestError,
    } from "$lib/stores/verification.svelte";
    import { verificationRequestMessageView } from "$lib/utils/verificationMessage";

    interface Props {
        /** Event id of the request — the SDK keys in-room requests by it. */
        eventId: string;
        senderName: string;
        isOwn: boolean;
    }
    let { eventId, senderName, isOwn }: Props = $props();

    // Controllers mutate in place, so read through the tick. A request that is
    // still live appears in the incoming queue (or as the active flow) under
    // the request event's id.
    const controller = $derived(
        (void verificationState.verificationTick,
        verificationState.incoming.find((c) => c.id === eventId) ??
            (verificationState.active?.id === eventId
                ? verificationState.active
                : null)),
    );
    const view = $derived(
        verificationRequestMessageView({
            isOwn,
            senderName,
            pending: !!controller,
        }),
    );

    // Accept state comes from the store so this card and the stacked one show
    // the same truth, and so it survives the timeline recycling this component
    // while accept() is still in flight.
    const busy = $derived(
        (void verificationState.verificationTick,
        controller ? isAcceptingRequest(controller) : false),
    );
    const acceptError = $derived(
        (void verificationState.verificationTick,
        controller ? acceptRequestError(controller) : null),
    );

    async function accept() {
        if (!controller) return;
        await acceptIncoming(controller);
    }
</script>

<div
    class="mt-1 flex max-w-md items-center gap-3 rounded-lg border border-zam-divider bg-zam-backgroundSecondary px-3 py-2.5"
>
    <div
        class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-zam-accent/20"
    >
        <ShieldQuestion size={20} class="text-zam-accent" />
    </div>
    <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-zam-textPrimary">
            {view.heading}
        </p>
        {#if acceptError}
            <p class="text-xs text-zam-danger">{acceptError}</p>
        {:else}
            <p class="truncate text-xs text-zam-textMuted">
                {view.subtitle}
            </p>
        {/if}
    </div>
    {#if view.showActions && controller}
        <!-- Never disabled while an accept is in flight: nothing bounds accept()
             client-side, so declining (which drops the card AND frees the
             store's one-at-a-time gate) is the only way out of a hung one short
             of a reload. -->
        <button
            type="button"
            class="rounded px-2.5 py-1 text-xs text-zam-textPrimary transition-colors bg-zam-messageHover hover:bg-zam-danger/20 hover:text-zam-danger disabled:opacity-60"
            onclick={() => declineIncoming(controller)}
        >
            {t("common.decline")}
        </button>
        <button
            type="button"
            class="rounded bg-zam-accent px-2.5 py-1 text-xs text-white transition-colors hover:bg-zam-accentHover disabled:opacity-60"
            disabled={busy}
            onclick={accept}
        >
            {busy ? "…" : t("common.verify")}
        </button>
    {/if}
</div>

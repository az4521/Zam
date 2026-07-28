<script lang="ts">
    import { ShieldQuestion } from "lucide-svelte";
    import {
        verificationState,
        acceptIncoming,
        declineIncoming,
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

    let busy = $state(false);
    async function accept() {
        if (busy || !controller) return;
        busy = true;
        try {
            await acceptIncoming(controller);
        } finally {
            busy = false;
        }
    }
</script>

<div
    class="mt-1 flex max-w-md items-center gap-3 rounded-lg border border-discord-divider bg-discord-backgroundSecondary px-3 py-2.5"
>
    <div
        class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-discord-accent/20"
    >
        <ShieldQuestion size={20} class="text-discord-accent" />
    </div>
    <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-discord-textPrimary">
            {view.heading}
        </p>
        <p class="truncate text-xs text-discord-textMuted">{view.subtitle}</p>
    </div>
    {#if view.showActions && controller}
        <button
            type="button"
            class="rounded px-2.5 py-1 text-xs text-discord-textPrimary transition-colors bg-discord-messageHover hover:bg-discord-danger/20 hover:text-discord-danger"
            onclick={() => declineIncoming(controller)}
        >
            Decline
        </button>
        <button
            type="button"
            class="rounded bg-discord-accent px-2.5 py-1 text-xs text-white transition-colors hover:bg-discord-accentHover disabled:opacity-60"
            disabled={busy}
            onclick={accept}
        >
            {busy ? "…" : "Verify"}
        </button>
    {/if}
</div>

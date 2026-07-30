<script lang="ts">
    import { ShieldQuestion } from "lucide-svelte";
    import type { VerificationController } from "$lib/matrix/crypto";
    import {
        verificationState,
        acceptIncoming,
        declineIncoming,
        isAcceptingRequest,
        acceptRequestError,
    } from "$lib/stores/verification.svelte";

    interface Props {
        controller: VerificationController;
    }
    let { controller }: Props = $props();

    // The controller mutates in place — read through the tick.
    const view = $derived(
        (void verificationState.verificationTick, controller.view()),
    );
    const heading = $derived(
        view.isSelfVerification
            ? "Verify your other session"
            : "Verification request",
    );
    const subtitle = $derived(
        view.isSelfVerification
            ? (view.otherDeviceId ?? "Another of your sessions")
            : view.otherUserId,
    );

    // Accept state lives in the store, not here: it has to outlive this
    // component (the card can remount while accept() is still in flight) and
    // the in-timeline card has to agree with it.
    const busy = $derived(
        (void verificationState.verificationTick,
        isAcceptingRequest(controller)),
    );
    const acceptError = $derived(
        (void verificationState.verificationTick,
        acceptRequestError(controller)),
    );

    async function accept() {
        await acceptIncoming(controller);
    }
</script>

<div
    class="flex items-center gap-3 w-80 px-4 py-3 rounded-lg shadow-lg bg-discord-background border border-discord-divider"
>
    <div
        class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-discord-accent/20"
    >
        <ShieldQuestion size={20} class="text-discord-accent" />
    </div>
    <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-discord-textPrimary truncate">
            {heading}
        </p>
        {#if acceptError}
            <p class="text-xs text-discord-danger">{acceptError}</p>
        {:else}
            <p class="text-xs text-discord-textMuted truncate">{subtitle}</p>
        {/if}
    </div>
    <!-- Never disabled while an accept is in flight: nothing bounds accept()
         client-side, so declining (which drops the card AND frees the store's
         one-at-a-time gate) is the only way out of a hung one short of a
         reload. -->
    <button
        type="button"
        class="px-2.5 py-1 rounded text-xs bg-discord-messageHover text-discord-textPrimary hover:bg-discord-danger/20 hover:text-discord-danger transition-colors disabled:opacity-60"
        onclick={() => declineIncoming(controller)}
    >
        Decline
    </button>
    <button
        type="button"
        class="px-2.5 py-1 rounded text-xs bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-60"
        disabled={busy}
        onclick={accept}
    >
        {busy ? "…" : "Verify"}
    </button>
</div>

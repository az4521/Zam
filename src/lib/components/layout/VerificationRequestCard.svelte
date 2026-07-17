<script lang="ts">
    import { ShieldQuestion } from "lucide-svelte";
    import type { VerificationController } from "$lib/matrix/crypto";
    import {
        verificationState,
        acceptIncoming,
        declineIncoming,
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

    let busy = $state(false);
    async function accept() {
        if (busy) return;
        busy = true;
        try {
            await acceptIncoming(controller);
        } finally {
            busy = false;
        }
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
        <p class="text-xs text-discord-textMuted truncate">{subtitle}</p>
    </div>
    <button
        type="button"
        class="px-2.5 py-1 rounded text-xs bg-discord-messageHover text-discord-textPrimary hover:bg-discord-danger/20 hover:text-discord-danger transition-colors"
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

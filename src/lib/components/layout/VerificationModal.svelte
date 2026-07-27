<script lang="ts">
    import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-svelte";
    import {
        verificationState,
        closeActive,
    } from "$lib/stores/verification.svelte";
    import {
        verificationPhaseKind,
        verificationPhaseLabel,
        formatSasEmojis,
        sasEmojiRows,
    } from "$lib/utils/verification";
    import { focusTrap } from "$lib/actions/focusTrap";

    // The active controller mutates in place, so every read hangs off the tick.
    const view = $derived(
        (void verificationState.verificationTick,
        verificationState.active?.view() ?? null),
    );
    const kind = $derived(view ? verificationPhaseKind(view.phase) : "pending");
    const isSelf = $derived(view?.isSelfVerification ?? false);
    const statusLabel = $derived(
        view ? verificationPhaseLabel(view.phase, { isSelf }) : "",
    );
    const emojiRows = $derived(
        view?.sasEmoji ? sasEmojiRows(formatSasEmojis(view.sasEmoji)) : [],
    );
    const title = $derived(
        isSelf
            ? "Verify your other session"
            : `Verify ${view?.otherUserId ?? "user"}`,
    );

    // Local UX state: reset whenever the modal retargets to a new flow.
    let confirmed = $state(false);
    let busy = $state(false);
    let errorMsg = $state<string | null>(null);
    $effect(() => {
        void verificationState.active?.id;
        confirmed = false;
        busy = false;
        errorMsg = null;
    });

    async function match() {
        if (busy) return;
        busy = true;
        errorMsg = null;
        try {
            await verificationState.active?.confirm();
            confirmed = true;
        } catch (e) {
            errorMsg =
                e instanceof Error ? e.message : "Could not confirm the match";
        } finally {
            busy = false;
        }
    }

    function noMatch() {
        verificationState.active?.mismatch();
    }
</script>

{#if view}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
            type="button"
            aria-label="Close dialog"
            class="absolute inset-0 bg-black/50"
            onclick={closeActive}
        ></button>
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="verification-modal-title"
            class="relative z-10 w-full max-w-sm rounded-lg bg-discord-backgroundSecondary border border-discord-divider shadow-xl p-5"
            use:focusTrap={{ onEscape: closeActive }}
        >
            <h2
                id="verification-modal-title"
                class="text-base font-semibold text-discord-textPrimary"
            >
                {title}
            </h2>
            {#if view.otherDeviceId}
                <p class="mt-0.5 text-xs text-discord-textMuted font-mono">
                    {view.otherDeviceId}
                </p>
            {/if}

            {#if kind === "success"}
                <div class="mt-5 flex flex-col items-center text-center gap-2">
                    <ShieldCheck size={40} class="text-discord-online" />
                    <p class="text-sm font-medium text-discord-textPrimary">
                        {statusLabel}
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        {isSelf
                            ? "This session is now trusted."
                            : "Their identity is now verified."}
                    </p>
                </div>
            {:else if kind === "cancelled"}
                <div class="mt-5 flex flex-col items-center text-center gap-2">
                    <ShieldAlert size={40} class="text-discord-danger" />
                    <p class="text-sm font-medium text-discord-textPrimary">
                        {statusLabel}
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        No trust was established. You can start again anytime.
                    </p>
                </div>
            {:else if emojiRows.length > 0 && !confirmed}
                <p class="mt-4 text-xs text-discord-textMuted">
                    Confirm the same emoji appear, in the same order, on your
                    other {isSelf ? "session" : "device with this user"}.
                </p>
                <div class="mt-4 space-y-2">
                    {#each emojiRows as row, rowIndex (rowIndex)}
                        <div class="flex justify-center gap-2">
                            {#each row as emoji (emoji.symbol + emoji.name)}
                                <div
                                    class="flex w-16 flex-col items-center gap-1 rounded bg-discord-backgroundTertiary px-1 py-2"
                                >
                                    <span class="text-2xl leading-none"
                                        >{emoji.symbol}</span
                                    >
                                    <span
                                        class="text-[10px] capitalize text-discord-textMuted truncate max-w-full"
                                        >{emoji.name}</span
                                    >
                                </div>
                            {/each}
                        </div>
                    {/each}
                </div>
                {#if errorMsg}
                    <p class="mt-3 text-xs text-discord-danger">{errorMsg}</p>
                {/if}
                <div class="mt-5 flex gap-2">
                    <button
                        onclick={noMatch}
                        disabled={busy}
                        class="flex-1 px-3 py-2 rounded bg-discord-backgroundTertiary hover:bg-discord-danger/20 text-discord-danger text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                        They don't match
                    </button>
                    <button
                        onclick={match}
                        disabled={busy}
                        class="flex-1 px-3 py-2 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                        {busy ? "Confirming…" : "They match"}
                    </button>
                </div>
            {:else}
                <div class="mt-6 flex flex-col items-center text-center gap-3">
                    <Loader2
                        size={32}
                        class="animate-spin text-discord-accent"
                    />
                    <p class="text-sm text-discord-textSecondary">
                        {confirmed
                            ? "Waiting for the other side to confirm…"
                            : statusLabel}
                    </p>
                </div>
            {/if}

            <button
                onclick={closeActive}
                class="mt-5 w-full px-3 py-1.5 rounded bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary text-sm transition-colors"
            >
                {kind === "success" || kind === "cancelled"
                    ? "Close"
                    : "Cancel"}
            </button>
        </div>
    </div>
{/if}

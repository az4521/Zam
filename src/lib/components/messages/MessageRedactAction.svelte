<script lang="ts">
    import { onDestroy } from "svelte";
    import { deleteMessage } from "$lib/matrix/client";
    import {
        clearModalIfOwner,
        closeModal,
        interfaceState,
        openModal,
    } from "$lib/stores/interface.svelte";
    import { normalizeRedactionReason } from "$lib/utils/redaction";
    import { matrixErrorMessage } from "$lib/utils/knock";

    interface Props {
        roomId: string;
        eventId: string;
        keyboardOffset: number;
        open?: boolean;
    }

    let {
        roomId,
        eventId,
        keyboardOffset,
        open = $bindable(false),
    }: Props = $props();
    let dialogEl: HTMLDivElement | undefined = $state();
    let buttonEl: HTMLButtonElement | undefined = $state();
    let textareaEl: HTMLTextAreaElement | undefined = $state();
    let below = $state(false);
    let reason = $state("");
    let status = $state<"idle" | "sending" | "error">("idle");
    let error = $state("");
    let token = 0;

    function show() {
        below = (buttonEl?.getBoundingClientRect().top ?? 400) < 400;
        // Claim first - a same-id handover runs the outgoing close.
        token = openModal("redact-message", () => (open = false));
        reason = "";
        status = "idle";
        error = "";
        open = true;
        setTimeout(() => textareaEl?.focus(), 0);
    }

    async function submit() {
        if (status === "sending") return;
        status = "sending";
        error = "";
        try {
            await deleteMessage(
                roomId,
                eventId,
                normalizeRedactionReason(reason),
            );
            if (open) closeModal();
        } catch (deleteError) {
            status = "error";
            error = matrixErrorMessage(deleteError, "Failed to remove message");
        }
    }

    $effect(() => {
        if (!open || interfaceState.isTouchscreen) return;
        const onMouseDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                dialogEl &&
                !dialogEl.contains(target) &&
                !buttonEl?.contains(target)
            ) {
                closeModal();
            }
        };
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    });

    onDestroy(() => clearModalIfOwner(token));
</script>

<div class="relative">
    <!--
        `data-message-action` enlists this trigger in MessageItem's roving
        toolbar (the bar's arrow-key navigation); the popover's own controls
        stay out of it deliberately.
    -->
    <button
        data-message-action
        bind:this={buttonEl}
        onclick={() => (open ? closeModal() : show())}
        class="p-1.5 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors"
        title="Remove message"
        aria-label="Remove message"
        aria-expanded={open}
    >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path
                d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
            />
        </svg>
    </button>
    {#if open}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        {#if interfaceState.isTouchscreen}<div
                class="fixed inset-0 z-40"
                onclick={closeModal}
            ></div>{/if}
        <div
            bind:this={dialogEl}
            class="{interfaceState.isTouchscreen
                ? 'fixed left-2 right-2 z-50'
                : below
                  ? 'absolute top-full right-0 mt-1 z-50 w-72'
                  : 'absolute bottom-full right-0 mb-1 z-50 w-72'} bg-discord-backgroundTertiary border border-discord-divider rounded-lg shadow-xl p-3 text-left"
            style={interfaceState.isTouchscreen
                ? `bottom: ${keyboardOffset + 8}px;`
                : ""}
        >
            <p
                class="text-xs font-semibold uppercase text-discord-textMuted mb-2"
            >
                Remove this message?
            </p>
            <textarea
                bind:this={textareaEl}
                bind:value={reason}
                rows="2"
                placeholder="Reason (optional)"
                disabled={status === "sending"}
                class="w-full resize-none rounded bg-discord-backgroundSecondary border border-discord-divider p-2 text-sm text-discord-textPrimary placeholder:text-discord-textMuted focus:outline-none focus:border-discord-accent"
            ></textarea>
            {#if status === "error"}
                <p class="text-xs text-discord-danger mt-2">{error}</p>
            {/if}
            <div class="flex justify-end gap-2 mt-2">
                <button
                    onclick={closeModal}
                    class="px-2 py-1 rounded text-xs font-semibold text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                    >Cancel</button
                >
                <button
                    onclick={submit}
                    disabled={status === "sending"}
                    class="px-2 py-1 rounded text-xs font-semibold text-white bg-discord-danger hover:bg-discord-dangerHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >{status === "sending" ? "Removing…" : "Remove"}</button
                >
            </div>
        </div>
    {/if}
</div>

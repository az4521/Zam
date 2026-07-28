<script lang="ts">
    import { reportEvent } from "$lib/matrix/client";
    import {
        closeModal,
        interfaceState,
        openModal,
    } from "$lib/stores/interface.svelte";
    import {
        buildReport,
        canSubmitReport,
        reportErrorMessage,
    } from "$lib/utils/reportMessage";

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
    let offensive = $state(false);
    let status = $state<"idle" | "sending" | "sent" | "error">("idle");
    let error = $state("");

    function show() {
        below = (buttonEl?.getBoundingClientRect().top ?? 400) < 400;
        // Claim first — a same-id handover runs the outgoing close.
        openModal("report-message", () => (open = false));
        reason = "";
        offensive = false;
        status = "idle";
        error = "";
        open = true;
        setTimeout(() => textareaEl?.focus(), 0);
    }

    async function submit() {
        if (!canSubmitReport(reason) || status === "sending") return;
        status = "sending";
        error = "";
        try {
            const report = buildReport(reason, offensive);
            await reportEvent(roomId, eventId, report.score, report.reason);
            status = "sent";
            setTimeout(() => {
                if (open) closeModal();
            }, 1200);
        } catch (submitError) {
            status = "error";
            error = reportErrorMessage(submitError);
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
</script>

<div class="relative">
    <button
        bind:this={buttonEl}
        onclick={() => (open ? closeModal() : show())}
        class="p-1.5 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors"
        title="Report message"
    >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" />
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
            {#if status === "sent"}
                <p class="text-sm text-discord-textPrimary">Report sent</p>
            {:else}
                <p
                    class="text-xs font-semibold uppercase text-discord-textMuted mb-2"
                >
                    Report message
                </p>
                <textarea
                    bind:this={textareaEl}
                    bind:value={reason}
                    rows="3"
                    placeholder="Why are you reporting this message?"
                    disabled={status === "sending"}
                    class="w-full resize-none rounded bg-discord-backgroundSecondary border border-discord-divider p-2 text-sm text-discord-textPrimary placeholder:text-discord-textMuted focus:outline-none focus:border-discord-accent"
                ></textarea>
                <label
                    class="flex items-center gap-2 mt-2 text-xs text-discord-textMuted select-none cursor-pointer"
                >
                    <input
                        type="checkbox"
                        bind:checked={offensive}
                        disabled={status === "sending"}
                    />
                    Mark as extremely offensive
                </label>
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
                        disabled={!canSubmitReport(reason) ||
                            status === "sending"}
                        class="px-2 py-1 rounded text-xs font-semibold text-white bg-discord-danger hover:bg-discord-dangerHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >{status === "sending"
                            ? "Reporting…"
                            : "Report"}</button
                    >
                </div>
            {/if}
        </div>
    {/if}
</div>

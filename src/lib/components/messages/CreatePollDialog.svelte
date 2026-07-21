<script lang="ts">
    import {
        pollDialogState,
        closeCreatePollDialog,
    } from "$lib/stores/pollDialog.svelte";
    import { sendPollStart } from "$lib/matrix/client";
    import {
        validatePollDraft,
        draftToPollData,
        type PollDraft,
    } from "$lib/utils/pollContent";
    import { showErrorToast } from "$lib/stores/toasts.svelte";

    const MAX_OPTIONS = 20;

    let question = $state("");
    let answers = $state<string[]>(["", ""]);
    let kind = $state<"disclosed" | "undisclosed">("disclosed");
    let allowMultiple = $state(false);
    let submitting = $state(false);

    const draft = $derived<PollDraft>({
        question,
        answers,
        kind,
        // multi-select = up to the number of non-empty answers
        maxSelections: allowMultiple
            ? Math.max(2, answers.filter((a) => a.trim()).length)
            : 1,
    });
    const validation = $derived(validatePollDraft(draft));
    const errorReason = $derived(validation.ok ? "" : validation.reason);

    function addAnswer() {
        if (answers.length < MAX_OPTIONS) answers = [...answers, ""];
    }
    function removeAnswer(i: number) {
        if (answers.length > 2) answers = answers.filter((_, j) => j !== i);
    }
    async function create() {
        if (submitting || validation.ok !== true) return;
        const roomId = pollDialogState.roomId;
        if (!roomId) return;
        submitting = true;
        try {
            await sendPollStart(roomId, draftToPollData(draft));
            closeCreatePollDialog();
        } catch (err) {
            showErrorToast(
                err instanceof Error ? err.message : "Failed to create poll",
            );
            submitting = false;
        }
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") closeCreatePollDialog();
    }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    onclick={closeCreatePollDialog}
>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="bg-discord-backgroundSecondary rounded-lg shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto flex flex-col gap-4 p-6"
        onclick={(e) => e.stopPropagation()}
    >
        <h2 class="text-lg font-bold text-discord-textPrimary">Create poll</h2>

        <!-- Question -->
        <div class="flex flex-col gap-1.5">
            <label
                for="poll-question"
                class="text-xs font-semibold uppercase tracking-wide text-discord-textMuted"
            >
                Question
            </label>
            <input
                id="poll-question"
                type="text"
                bind:value={question}
                placeholder="Ask something…"
                maxlength="340"
                class="w-full rounded bg-discord-backgroundTertiary px-3 py-2 text-sm text-discord-textPrimary placeholder:text-discord-textMuted focus:outline-none focus:ring-2 focus:ring-discord-accent"
            />
        </div>

        <!-- Options -->
        <div class="flex flex-col gap-1.5">
            <span
                class="text-xs font-semibold uppercase tracking-wide text-discord-textMuted"
            >
                Options
            </span>
            <div class="flex flex-col gap-2">
                {#each answers as _answer, i (i)}
                    <div class="flex items-center gap-2">
                        <input
                            type="text"
                            bind:value={answers[i]}
                            placeholder={`Option ${i + 1}`}
                            aria-label={`Option ${i + 1}`}
                            maxlength="340"
                            class="flex-1 rounded bg-discord-backgroundTertiary px-3 py-2 text-sm text-discord-textPrimary placeholder:text-discord-textMuted focus:outline-none focus:ring-2 focus:ring-discord-accent"
                        />
                        <button
                            type="button"
                            onclick={() => removeAnswer(i)}
                            disabled={answers.length <= 2}
                            aria-label="Remove option"
                            title="Remove option"
                            class="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        >
                            <svg
                                class="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.29 19.7 2.87 18.3 9.17 12 2.87 5.71 4.29 4.29l6.3 6.3 6.29-6.3z"
                                />
                            </svg>
                        </button>
                    </div>
                {/each}
            </div>
            {#if answers.length < MAX_OPTIONS}
                <button
                    type="button"
                    onclick={addAnswer}
                    class="self-start mt-1 text-sm font-medium text-discord-accent hover:text-discord-accentHover transition-colors"
                >
                    + Add option
                </button>
            {/if}
        </div>

        <!-- Result visibility -->
        <div class="flex flex-col gap-1.5">
            <span
                class="text-xs font-semibold uppercase tracking-wide text-discord-textMuted"
            >
                Results
            </span>
            <div
                class="flex gap-1 rounded bg-discord-backgroundTertiary p-1 text-sm"
            >
                <button
                    type="button"
                    onclick={() => (kind = "disclosed")}
                    class="flex-1 rounded px-3 py-1.5 transition-colors {kind ===
                    'disclosed'
                        ? 'bg-discord-accent text-white'
                        : 'text-discord-textSecondary hover:text-discord-textPrimary'}"
                >
                    Show as people vote
                </button>
                <button
                    type="button"
                    onclick={() => (kind = "undisclosed")}
                    class="flex-1 rounded px-3 py-1.5 transition-colors {kind ===
                    'undisclosed'
                        ? 'bg-discord-accent text-white'
                        : 'text-discord-textSecondary hover:text-discord-textPrimary'}"
                >
                    Hide until closed
                </button>
            </div>
        </div>

        <!-- Multi-select -->
        <label class="flex items-center gap-2.5 cursor-pointer select-none">
            <input
                type="checkbox"
                bind:checked={allowMultiple}
                class="h-4 w-4 rounded accent-discord-accent"
            />
            <span class="text-sm text-discord-textPrimary">
                Allow selecting multiple options
            </span>
        </label>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 pt-1">
            {#if errorReason}
                <span class="mr-auto text-xs text-discord-textMuted"
                    >{errorReason}</span
                >
            {/if}
            <button
                type="button"
                onclick={closeCreatePollDialog}
                class="px-4 py-2 rounded text-sm font-medium text-discord-textSecondary hover:text-discord-textPrimary hover:underline transition-colors"
            >
                Cancel
            </button>
            <button
                type="button"
                onclick={create}
                disabled={submitting || validation.ok !== true}
                class="px-4 py-2 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {submitting ? "Creating…" : "Create poll"}
            </button>
        </div>
    </div>
</div>

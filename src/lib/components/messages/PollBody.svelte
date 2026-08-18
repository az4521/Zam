<script lang="ts">
    import type { MatrixEvent, Room } from "matrix-js-sdk";
    import {
        getPollView,
        fetchPollRelations,
        sendPollResponse,
        sendPollEnd,
    } from "$lib/matrix/client";
    import {
        messagesState,
        bumpReactionTick,
    } from "$lib/stores/messages.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";

    interface Props {
        event: MatrixEvent;
        room: Room;
    }

    let { event, room }: Props = $props();

    // Full vote history, fetched once per poll from /relations. The SDK only
    // aggregates relations it saw in the loaded timeline window, so without
    // this fetch votes older than the window would be missing from tallies.
    let fetchedRelations = $state<MatrixEvent[]>([]);

    $effect(() => {
        const roomId = room.roomId;
        const pollId = event.getId();
        if (!pollId) return;
        let cancelled = false;
        fetchPollRelations(roomId, pollId)
            .then((events) => {
                if (!cancelled) fetchedRelations = events;
            })
            .catch(() => {
                // Tallies fall back to locally-known relations only.
            });
        return () => {
            cancelled = true;
        };
    });

    // reactionTick bumps when poll responses/ends arrive over sync (see
    // MessageArea); roomsTick covers power-level changes that affect whose
    // end events count.
    const view = $derived.by(() => {
        void messagesState.reactionTick;
        void roomsState.roomsTick;
        return getPollView(room, event, fetchedRelations);
    });

    let draftAnswers = $state<string[] | null>(null);
    let isVoting = $state(false);
    const selectedAnswers = $derived(draftAnswers ?? view?.myAnswers ?? []);

    function toggleAnswer(answerId: string) {
        if (!view || view.ended || isVoting) return;
        if (view.poll.maxSelections === 1) {
            const next = selectedAnswers.includes(answerId) ? [] : [answerId];
            draftAnswers = next;
            submitVote(next);
            return;
        }
        const current = selectedAnswers;
        draftAnswers = current.includes(answerId)
            ? current.filter((id) => id !== answerId)
            : current.length < view.poll.maxSelections
              ? [...current, answerId]
              : current;
    }

    async function submitVote(selection = selectedAnswers) {
        if (!view || view.ended || isVoting) return;
        isVoting = true;
        try {
            await sendPollResponse(room.roomId, event, selection);
            bumpReactionTick();
            draftAnswers = null;
        } catch (err) {
            showErrorToast(
                err instanceof Error ? err.message : "Failed to submit vote",
            );
            isVoting = false;
            return;
        }

        const pollId = event.getId();
        if (pollId) {
            try {
                fetchedRelations = await fetchPollRelations(
                    room.roomId,
                    pollId,
                );
            } catch (err) {
                console.warn("[poll] vote sent but refresh failed", err);
            }
        }
        isVoting = false;
    }

    function pct(count: number, total: number): number {
        return total === 0 ? 0 : Math.round((count / total) * 100);
    }

    let confirmingEnd = $state(false);
    let endingPoll = $state(false);
    async function endPoll() {
        if (endingPoll) return;
        endingPoll = true;
        try {
            await sendPollEnd(room.roomId, event);
            bumpReactionTick();
            confirmingEnd = false;
        } catch (err) {
            showErrorToast(
                err instanceof Error ? err.message : "Failed to close poll",
            );
        } finally {
            endingPoll = false;
        }
    }
</script>

{#if view}
    <div
        class="mt-1 max-w-md rounded-lg border border-discord-divider bg-discord-backgroundSecondary px-3 py-2.5"
    >
        <div class="flex items-start gap-2">
            <svg
                class="w-4 h-4 mt-0.5 text-discord-textMuted flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z"
                />
            </svg>
            <div class="min-w-0">
                <p
                    class="text-sm font-semibold text-discord-textPrimary break-words"
                >
                    {view.poll.question}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {#if view.ended}
                        Final results
                    {:else if view.showResults}
                        Live poll
                    {:else}
                        Results are revealed when the poll ends
                    {/if}
                    {#if view.poll.maxSelections > 1}
                        · choose up to {view.poll.maxSelections}
                    {/if}
                </p>
            </div>
        </div>

        <div class="mt-2 flex flex-col gap-1.5">
            {#each view.poll.answers as answer (answer.id)}
                {@const count = view.counts[answer.id] ?? 0}
                {@const isWinner =
                    view.ended && view.winners.includes(answer.id)}
                {@const isMine = selectedAnswers.includes(answer.id)}
                <button
                    type="button"
                    onclick={() => toggleAnswer(answer.id)}
                    disabled={view.ended || isVoting}
                    aria-pressed={isMine}
                    class="rounded border px-2.5 py-1.5 {isWinner
                        ? 'border-discord-accent bg-discord-accent/10'
                        : isMine
                          ? 'border-discord-accent bg-discord-accent/10'
                          : 'border-discord-divider bg-discord-backgroundTertiary'} text-left transition-colors disabled:cursor-default enabled:hover:border-discord-accent/60"
                >
                    <div class="flex items-center justify-between gap-2">
                        <span
                            class="text-sm text-discord-textPrimary break-words min-w-0"
                        >
                            {answer.text}
                            {#if isMine}
                                <span
                                    class="text-xs text-discord-accent font-semibold whitespace-nowrap"
                                    >✓ selected</span
                                >
                            {/if}
                        </span>
                        {#if view.showResults}
                            <span
                                class="text-xs text-discord-textMuted whitespace-nowrap flex-shrink-0"
                            >
                                {count} · {pct(count, view.totalVotes)}%
                            </span>
                        {/if}
                    </div>
                    {#if view.showResults}
                        <div
                            class="mt-1 h-1 rounded-full bg-discord-background overflow-hidden"
                        >
                            <div
                                class="h-full rounded-full {isWinner
                                    ? 'bg-discord-accent'
                                    : 'bg-discord-divider'}"
                                style="width: {pct(count, view.totalVotes)}%"
                            ></div>
                        </div>
                    {/if}
                </button>
            {/each}
        </div>

        {#if !view.ended && view.poll.maxSelections > 1}
            <button
                type="button"
                onclick={() => submitVote()}
                disabled={isVoting || draftAnswers === null}
                class="mt-2 px-3 py-1.5 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isVoting ? "Submitting…" : "Submit vote"}
            </button>
        {/if}

        <p class="mt-2 text-xs text-discord-textMuted">
            {#if view.showResults}
                {view.totalVotes}
                {view.totalVotes === 1 ? "vote" : "votes"}
            {:else}
                Votes are hidden
            {/if}
            {#if !view.ended && isVoting}
                · saving vote…{/if}
        </p>

        {#if view.canEnd}
            {#if confirmingEnd}
                <div class="mt-2 flex items-center gap-2">
                    <span class="text-xs text-discord-textMuted"
                        >Close this poll?</span
                    >
                    <button
                        type="button"
                        onclick={endPoll}
                        disabled={endingPoll}
                        class="px-2.5 py-1 rounded bg-discord-danger hover:bg-discord-dangerHover text-white text-xs font-semibold transition-colors disabled:opacity-50"
                        >{endingPoll ? "Closing…" : "Close poll"}</button
                    >
                    <button
                        type="button"
                        onclick={() => (confirmingEnd = false)}
                        class="px-2.5 py-1 rounded text-xs text-discord-textMuted hover:text-discord-textPrimary"
                        >Cancel</button
                    >
                </div>
            {:else}
                <button
                    type="button"
                    onclick={() => (confirmingEnd = true)}
                    class="mt-2 text-xs text-discord-textMuted hover:text-discord-textPrimary underline"
                    >Close poll</button
                >
            {/if}
        {/if}
    </div>
{:else}
    <p class="text-xs text-discord-textMuted italic">
        [Poll - unsupported format]
    </p>
{/if}

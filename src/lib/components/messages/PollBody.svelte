<script lang="ts">
    import type { MatrixEvent, Room } from "matrix-js-sdk";
    import { getPollView, fetchPollRelations } from "$lib/matrix/client";
    import { messagesState } from "$lib/stores/messages.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";

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

    function pct(count: number, total: number): number {
        return total === 0 ? 0 : Math.round((count / total) * 100);
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
                {@const isMine = view.myAnswers.includes(answer.id)}
                <div
                    class="rounded border px-2.5 py-1.5 {isWinner
                        ? 'border-discord-accent bg-discord-accent/10'
                        : 'border-discord-divider bg-discord-backgroundTertiary'}"
                >
                    <div class="flex items-center justify-between gap-2">
                        <span
                            class="text-sm text-discord-textPrimary break-words min-w-0"
                        >
                            {answer.text}
                            {#if isMine}
                                <span
                                    class="text-xs text-discord-accent font-semibold whitespace-nowrap"
                                    >✓ your vote</span
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
                                    : 'bg-discord-textMuted'}"
                                style="width: {pct(count, view.totalVotes)}%"
                            ></div>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>

        <p class="mt-2 text-xs text-discord-textMuted">
            {#if view.showResults}
                {view.totalVotes}
                {view.totalVotes === 1 ? "vote" : "votes"}
            {:else}
                Votes are hidden
            {/if}
            {#if !view.ended}
                · voting from this app isn't supported yet
            {/if}
        </p>
    </div>
{:else}
    <p class="text-xs text-discord-textMuted italic">
        [Poll — unsupported format]
    </p>
{/if}

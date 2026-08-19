<script lang="ts">
    import type { Room } from "matrix-js-sdk";
    import {
        getReactions,
        sendReaction,
        removeReaction,
        mxcToHttp,
        getMemberName,
        getMemberAvatar,
    } from "$lib/matrix/client";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import { matrixErrorMessage } from "$lib/utils/knock";
    import { renderEmoji, isEmojiOnly } from "$lib/utils/twemoji";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { orderReactors } from "$lib/utils/reactionReactors";
    import { longPress } from "$lib/actions/longPress";
    import ReactorPopover from "./ReactorPopover.svelte";

    interface Props {
        eventId: string;
        room: Room;
        reactionTick: number; // reactive counter to force re-read
    }

    let { eventId, room, reactionTick }: Props = $props();

    // Optimistic removals: event IDs of reactions the user has removed, pending server confirmation
    let pendingRemovals = $state(new Set<string>());

    // Re-read reactions whenever reactionTick changes
    const reactions = $derived.by(() => {
        reactionTick; // dependency
        return getReactions(room, eventId);
    });

    // Clean up pendingRemovals once the specific reaction event ID is gone from server state
    $effect(() => {
        const serverEventIds = new Set(
            reactions.flatMap((g) => (g.myEventId ? [g.myEventId] : [])),
        );
        for (const id of pendingRemovals) {
            if (!serverEventIds.has(id)) {
                pendingRemovals = new Set(
                    [...pendingRemovals].filter((i) => i !== id),
                );
            }
        }
    });

    // Decrement count by 1 for pending removals; hide group only if count reaches 0
    const visibleReactions = $derived(
        reactions
            .map((g) => {
                if (g.myEventId && pendingRemovals.has(g.myEventId)) {
                    return {
                        ...g,
                        count: g.count - 1,
                        isMine: false,
                        myEventId: null,
                    };
                }
                return g;
            })
            .filter((g) => g.count > 0),
    );

    async function toggleReaction(
        key: string,
        isMine: boolean,
        myEventId: string | null,
    ) {
        if (isMine) {
            if (!myEventId) return; // local echo still pending — ignore click
            pendingRemovals = new Set([...pendingRemovals, myEventId]);
            try {
                await removeReaction(room.roomId, myEventId);
            } catch (err) {
                // Restore on failure
                pendingRemovals = new Set(
                    [...pendingRemovals].filter((id) => id !== myEventId),
                );
                console.error("Failed to remove reaction:", err);
            }
        } else {
            try {
                await sendReaction(room.roomId, eventId, key);
            } catch (err) {
                console.error("Failed to send reaction:", err);
                showErrorToast(
                    matrixErrorMessage(err, "Could not add reaction"),
                );
            }
        }
    }

    function emojiHtml(key: string): string {
        return renderEmoji(key, "reaction-twemoji");
    }

    // Which reaction's reactor list is open, and how (hover vs touch sheet).
    let openKey = $state<string | null>(null);
    let openTouch = $state(false);
    let anchorX = $state(0);
    let anchorY = $state(0);

    function reactorsFor(reactorIds: string[]) {
        void roomsState.roomsTick; // re-resolve names/avatars as members load
        const { shown, overflow } = orderReactors(reactorIds, auth.userId);
        return {
            reactors: shown.map((userId) => ({
                userId,
                name: getMemberName(room, userId),
                avatarUrl: getMemberAvatar(room, userId),
            })),
            overflow,
        };
    }

    const active = $derived.by(() => {
        if (!openKey) return null;
        const g = visibleReactions.find((r) => r.key === openKey);
        if (!g) return null;
        return { key: g.key, ...reactorsFor(g.reactorIds) };
    });

    function openHover(e: MouseEvent, key: string) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        anchorX = rect.left + rect.width / 2;
        anchorY = rect.top;
        openTouch = false;
        openKey = key;
    }
    function closeHover(key: string) {
        if (openKey === key && !openTouch) openKey = null;
    }
    function openSheet(key: string) {
        openTouch = true;
        openKey = key;
    }
    function closePopover() {
        openKey = null;
        openTouch = false;
    }
</script>

{#if visibleReactions.length > 0}
    <div class="flex flex-wrap gap-1 mt-1">
        {#each visibleReactions as group (group.key)}
            {@const imgSrc = group.key.startsWith("mxc://")
                ? mxcToHttp(group.key)
                : null}
            <button
                onclick={() =>
                    toggleReaction(group.key, group.isMine, group.myEventId)}
                onmouseenter={(e) => openHover(e, group.key)}
                onmouseleave={() => closeHover(group.key)}
                use:longPress={{ onTrigger: () => openSheet(group.key) }}
                class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors"
                class:bg-discord-accent={group.isMine}
                class:border-discord-accent={group.isMine}
                class:text-white={group.isMine}
                class:bg-discord-backgroundTertiary={!group.isMine}
                class:border-discord-divider={!group.isMine}
                class:text-discord-textSecondary={!group.isMine}
                class:hover:border-discord-accent={!group.isMine}
                title={group.key}
            >
                {#if imgSrc}
                    <img
                        src={imgSrc}
                        alt={group.key}
                        class="w-4 h-4 object-contain"
                    />
                {:else if group.key.startsWith(":") && group.key.endsWith(":")}
                    <span class="font-mono">{group.key}</span>
                {:else if isEmojiOnly(group.key)}
                    {@html emojiHtml(group.key)}
                {:else}
                    <!-- Arbitrary reaction key: render as escaped text, never raw HTML -->
                    <span>{group.key}</span>
                {/if}
                <span>{group.count}</span>
            </button>
        {/each}
        {#if active}
            <ReactorPopover
                reactors={active.reactors}
                overflow={active.overflow}
                label={active.key}
                touch={openTouch}
                x={anchorX}
                y={anchorY}
                onClose={closePopover}
            />
        {/if}
    </div>
{/if}

<style>
    :global(.reaction-twemoji) {
        width: 16px;
        height: 16px;
        display: inline-block;
        object-fit: contain;
        vertical-align: -0.2em;
    }
</style>

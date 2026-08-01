<script lang="ts">
    import type { Room, MatrixEvent } from "matrix-js-sdk";
    import {
        getPinnedEventIds,
        unpinMessage,
        findEventById,
        fetchEventById,
        getMemberName,
        getMemberAvatar,
        getMyPowerLevel,
        getRoomPowerLevels,
    } from "$lib/matrix/client";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { pinnedDate } from "$lib/utils/timeFormat";
    import { createStaleGuard } from "$lib/utils/staleGuard";

    interface Props {
        room: Room;
        onClose: () => void;
        onJumpTo: (eventId: string) => void;
    }

    let { room, onClose, onJumpTo }: Props = $props();

    // getPinnedEventIds returns the state event's own `content.pinned` array
    // when pins exist — its identity is already stable across syncs, so the
    // derived never changed for those rooms — but a FRESH [] when the room has
    // none. Only pinless rooms were affected: there the derived changed
    // identity on every sync and re-ran the fetch effect below for nothing.
    // (Nothing was visible — that "refetch" is Promise.allSettled([]), which
    // resolves in a microtask, before paint. It was pure wasted work.) Hold the
    // last value while the ids are equal; this is the repo's established "keep
    // the tick dependency, make the write conditional" pattern.
    let lastPinnedKey = "";
    let lastPinnedIds: string[] = [];
    const pinnedIds = $derived.by(() => {
        void roomsState.roomsTick;
        const ids = getPinnedEventIds(room);
        const key = `${room.roomId}\u0000${ids.join(",")}`;
        if (key !== lastPinnedKey) {
            lastPinnedKey = key;
            lastPinnedIds = ids;
        }
        return lastPinnedIds;
    });
    let fetchedEvents = $state<MatrixEvent[]>([]);
    let loading = $state(false);
    // A pin lookup can outlive the room it was asked for — the panel is not
    // keyed by room — and a sync can re-trigger the fetch mid-flight. Only the
    // newest run may write, and it is the only one that clears the spinner.
    const pinFetches = createStaleGuard();

    $effect(() => {
        const ids = pinnedIds;
        const roomId = room.roomId;
        loading = true;
        fetchedEvents = [];
        void (async () => {
            const outcome = await pinFetches.run(async () => {
                // allSettled, not all: one unreachable pin must not blank the
                // pins that did resolve.
                const settled = await Promise.allSettled(
                    ids.map(async (id) => {
                        return (
                            findEventById(room, id) ??
                            (await fetchEventById(roomId, id))
                        );
                    }),
                );
                return settled
                    .filter(
                        (r): r is PromiseFulfilledResult<MatrixEvent | null> =>
                            r.status === "fulfilled",
                    )
                    .map((r) => r.value)
                    .filter((e): e is MatrixEvent => !!e)
                    .sort((a, b) => b.getTs() - a.getTs());
            });
            // Superseded — a newer run owns `loading` and `fetchedEvents`.
            if (outcome.status === "stale") return;
            // Master had no failure path at all here, so a rejection pinned the
            // spinner on forever. Blanking is the right data call — rendering
            // the previous room's pins under this room's members is the bug
            // this guard exists to stop — but the empty list then renders "No
            // pinned messages", which is false for a room that has some. Log so
            // the wrong statement is at least diagnosable.
            if (outcome.status === "error") {
                console.error("Pinned messages fetch failed", outcome.error);
            }
            fetchedEvents = outcome.status === "ok" ? outcome.value : [];
            loading = false;
        })();
        return () => pinFetches.cancel();
    });

    const pinnedEvents = $derived(fetchedEvents);

    const canPin = $derived.by(() => {
        const myPl = getMyPowerLevel(room);
        const pl = getRoomPowerLevels(room);
        const pinPl = pl.events?.["m.room.pinned_events"] ?? pl.state_default;
        return myPl >= pinPl;
    });

    function excerpt(event: MatrixEvent): string {
        const content = event.getContent();
        return content.body ?? content.msgtype ?? "(message)";
    }
</script>

<div
    class="{interfaceState.isMobile
        ? ''
        : 'w-72'} h-full flex flex-col bg-discord-backgroundSecondary border-l border-discord-divider"
>
    <div
        class="h-12 flex items-center gap-2 px-4 py-3 border-b border-discord-divider flex-shrink-0"
    >
        <h3
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide flex-1"
        >
            Pinned Messages
        </h3>
    </div>

    <div class="flex-1 overflow-y-auto">
        {#if loading}
            <div class="flex justify-center mt-8">
                <div
                    class="w-5 h-5 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"
                ></div>
            </div>
        {:else if pinnedEvents.length === 0}
            <p class="text-sm text-discord-textMuted text-center mt-8 px-4">
                No pinned messages.
            </p>
        {:else}
            <div class="p-2 space-y-1">
                {#each pinnedEvents as event (event.getId())}
                    {@const sender = event.getSender() ?? ""}
                    {@const avatarUrl = getMemberAvatar(room, sender)}
                    {@const name = getMemberName(room, sender)}
                    <div
                        class="p-2 rounded-lg hover:bg-discord-messageHover transition-colors group"
                    >
                        <div class="flex items-center gap-2 mb-1">
                            <Avatar
                                src={avatarUrl}
                                {name}
                                id={sender}
                                size={18}
                            />
                            <span
                                class="text-xs font-semibold text-discord-textPrimary truncate"
                                >{name}</span
                            >
                            <span
                                class="text-xs text-discord-textMuted ml-auto flex-shrink-0"
                                >{pinnedDate(event.getTs())}</span
                            >
                        </div>
                        <p
                            class="text-xs text-discord-textMuted line-clamp-3 break-words"
                        >
                            {excerpt(event)}
                        </p>
                        <div
                            class="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <button
                                onclick={() => {
                                    onJumpTo(event.getId()!);
                                    onClose();
                                }}
                                class="text-xs text-discord-accent hover:underline"
                                >Jump</button
                            >
                            {#if canPin}
                                <span class="text-discord-textMuted text-xs"
                                    >·</span
                                >
                                <button
                                    onclick={async () => {
                                        try {
                                            await unpinMessage(
                                                room,
                                                event.getId()!,
                                            );
                                        } catch (e) {
                                            console.error(
                                                "Failed to unpin message",
                                                e,
                                            );
                                            showErrorToast(
                                                "Failed to unpin message",
                                            );
                                        }
                                    }}
                                    class="text-xs text-discord-textMuted hover:text-discord-danger transition-colors"
                                    >Unpin</button
                                >
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

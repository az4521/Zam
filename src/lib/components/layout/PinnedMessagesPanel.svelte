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
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { pinnedDate } from "$lib/utils/timeFormat";

    interface Props {
        room: Room;
        onClose: () => void;
        onJumpTo: (eventId: string) => void;
    }

    let { room, onClose, onJumpTo }: Props = $props();

    const pinnedIds = $derived.by(() => {
        void roomsState.roomsTick;
        return getPinnedEventIds(room);
    });
    let fetchedEvents = $state<MatrixEvent[]>([]);
    let loading = $state(false);

    $effect(() => {
        const ids = pinnedIds;
        loading = true;
        fetchedEvents = [];
        Promise.all(
            ids.map(async (id) => {
                return (
                    findEventById(room, id) ??
                    (await fetchEventById(room.roomId, id))
                );
            }),
        ).then((results) => {
            fetchedEvents = results
                .filter((e): e is MatrixEvent => !!e)
                .sort((a, b) => b.getTs() - a.getTs());
            loading = false;
        });
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
                                    onclick={() =>
                                        unpinMessage(room, event.getId()!)}
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

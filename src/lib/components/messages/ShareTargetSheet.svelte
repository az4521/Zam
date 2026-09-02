<script lang="ts">
    import { Search, X } from "lucide-svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import Portal from "$lib/components/ui/Portal.svelte";
    import BottomSheet from "$lib/components/ui/BottomSheet.svelte";
    import {
        getRooms,
        getRoomAvatar,
        getRoomDisplayName,
    } from "$lib/matrix/client";
    import {
        shareInboxState,
        deliverShareToRoom,
        clearShare,
    } from "$lib/stores/shareInbox.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";

    const payload = $derived(shareInboxState.payload);

    let query = $state("");

    const rooms = $derived.by(() => {
        void roomsState.roomsTick; // Reactivity: refresh when rooms update
        const needle = query.trim().toLocaleLowerCase();
        return getRooms()
            .filter((room) => !room.isSpaceRoom())
            .filter(
                (room) =>
                    !needle ||
                    getRoomDisplayName(room)
                        .toLocaleLowerCase()
                        .includes(needle) ||
                    room.roomId.toLocaleLowerCase().includes(needle),
            )
            .sort((a, b) =>
                getRoomDisplayName(a).localeCompare(getRoomDisplayName(b)),
            );
    });
</script>

{#snippet body()}
    <div
        class="flex items-center justify-between border-b border-discord-divider px-4 py-3"
    >
        <div class="flex-1 min-w-0">
            <h2
                id="share-target-title"
                class="text-base font-semibold text-discord-textPrimary"
            >
                Share to a room
            </h2>
            {#if payload}
                {#if payload.kind === "text"}
                    <p class="text-xs text-discord-textMuted mt-1 line-clamp-2">
                        {payload.text}
                    </p>
                {:else if payload.kind === "files"}
                    <p class="text-xs text-discord-textMuted mt-1 line-clamp-2">
                        {payload.files.length} file(s){#if payload.text}: {payload.text}{/if}
                    </p>
                {/if}
            {/if}
        </div>
        <button
            type="button"
            onclick={clearShare}
            class="p-1.5 rounded text-discord-textMuted hover:bg-discord-messageHover hover:text-discord-textPrimary ml-2"
            aria-label="Close"
            title="Close"><X size={20} /></button
        >
    </div>

    <div class="p-3 pb-2">
        <label class="relative block">
            <Search
                size={16}
                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-discord-textMuted"
            />
            <input
                data-autofocus
                bind:value={query}
                placeholder="Search rooms"
                class="w-full rounded bg-discord-backgroundTertiary py-2 pl-9 pr-3 text-sm text-discord-textPrimary outline-none placeholder:text-discord-textMuted focus:ring-1 focus:ring-discord-accent"
            />
        </label>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {#each rooms as room (room.roomId)}
            <button
                type="button"
                onclick={() => deliverShareToRoom(room.roomId)}
                class="flex w-full items-center gap-3 rounded px-2 py-2 text-left transition-colors hover:bg-discord-messageHover"
            >
                <Avatar
                    src={getRoomAvatar(room)}
                    name={getRoomDisplayName(room)}
                    id={room.roomId}
                    size={36}
                />
                <span
                    class="min-w-0 truncate text-sm font-medium text-discord-textPrimary"
                >
                    {getRoomDisplayName(room)}
                </span>
            </button>
        {:else}
            <p class="px-3 py-8 text-center text-sm text-discord-textMuted">
                No joined rooms found
            </p>
        {/each}
    </div>

    <div class="flex justify-end gap-2 border-t border-discord-divider p-3">
        <button
            type="button"
            onclick={clearShare}
            class="px-3 py-2 text-sm font-semibold text-discord-textMuted hover:text-discord-textPrimary"
            >Cancel</button
        >
    </div>
{/snippet}

{#if payload}
    {#if interfaceState.isTouchscreen}
        <Portal>
            <button
                type="button"
                aria-label="Close"
                class="fixed inset-0 z-[90] bg-black/60"
                onclick={clearShare}
            ></button>
            <BottomSheet onClose={clearShare}>
                {@render body()}
            </BottomSheet>
        </Portal>
    {:else}
        <Portal>
            <ModalDialog
                onClose={clearShare}
                labelledBy="share-target-title"
                layerClass="z-[90] flex items-center justify-center p-3"
                panelClass="relative flex max-h-[min(620px,90dvh)] w-full max-w-md flex-col overflow-hidden rounded-lg border border-discord-divider bg-discord-backgroundSecondary shadow-2xl"
            >
                {@render body()}
            </ModalDialog>
        </Portal>
    {/if}
{/if}

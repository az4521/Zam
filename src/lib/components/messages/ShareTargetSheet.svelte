<script lang="ts">
    import {
        X,
        ArrowLeft,
        Search,
        Image as ImageIcon,
        FileText,
    } from "lucide-svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import Portal from "$lib/components/ui/Portal.svelte";
    import {
        getRooms,
        getRoomAvatar,
        getRoomDisplayName,
        getRoomTags,
    } from "$lib/matrix/client";
    import { sortRoomsByTag } from "$lib/utils/roomOrdering";
    import { shareFileRows } from "$lib/utils/shareFileRows";
    import {
        shareInboxState,
        deliverShareToRoom,
        clearShare,
    } from "$lib/stores/shareInbox.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";

    // Flip to false if one-step auto-send proves racy in live-verify: the Send
    // button then only stages into the composer + opens the room (the redesigned
    // surface is unchanged). See plan Task 4.
    const ONE_STEP_SEND = true;

    const payload = $derived(shareInboxState.payload);

    let query = $state("");
    let caption = $state("");
    let selectedRoomId = $state<string | null>(null);

    // Initialise the caption from the incoming payload text, once per payload.
    let lastPayloadRef: unknown = null;
    $effect(() => {
        const p = payload;
        if (p && p !== lastPayloadRef) {
            lastPayloadRef = p;
            caption = p.text;
        }
    });

    // Preview rows + object-URL thumbnails for image files. Created once per
    // payload; revoked on payload change / unmount so nothing leaks.
    type PreviewRow = {
        name: string;
        sizeLabel: string;
        isImage: boolean;
        url: string | null;
    };
    let previews = $state<PreviewRow[]>([]);
    $effect(() => {
        const p = payload;
        const files =
            p && p.kind === "files" ? (p.files as File[]) : ([] as File[]);
        const rows = shareFileRows(files);
        const built: PreviewRow[] = rows.map((r, i) => ({
            ...r,
            url:
                r.isImage && files[i] instanceof File
                    ? URL.createObjectURL(files[i])
                    : null,
        }));
        previews = built;
        return () => {
            for (const b of built) if (b.url) URL.revokeObjectURL(b.url);
        };
    });

    const rooms = $derived.by(() => {
        void roomsState.roomsTick; // refresh when rooms update
        const needle = query.trim().toLocaleLowerCase();
        const ordered = sortRoomsByTag(
            getRooms().filter((room) => !room.isSpaceRoom()),
            (room) => getRoomTags(room.roomId),
        );
        return ordered.filter(
            (room) =>
                !needle ||
                getRoomDisplayName(room).toLocaleLowerCase().includes(needle) ||
                room.roomId.toLocaleLowerCase().includes(needle),
        );
    });

    function submit() {
        if (!selectedRoomId) return;
        deliverShareToRoom(selectedRoomId, {
            caption: caption.trim() ? caption : "",
            send: ONE_STEP_SEND,
        });
    }
</script>

{#snippet fileList()}
    {#if previews.length > 0}
        <div
            class="flex max-h-40 flex-col gap-2 overflow-y-auto border-b border-discord-divider px-4 py-3"
        >
            {#each previews as row, i (i)}
                <div class="flex items-center gap-3">
                    {#if row.isImage && row.url}
                        <img
                            src={row.url}
                            alt=""
                            class="h-10 w-10 flex-shrink-0 rounded object-cover"
                        />
                    {:else}
                        <div
                            class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-discord-backgroundTertiary text-discord-textMuted"
                        >
                            {#if row.isImage}<ImageIcon
                                    size={18}
                                />{:else}<FileText size={18} />{/if}
                        </div>
                    {/if}
                    <div class="min-w-0 flex-1">
                        <p
                            class="truncate text-sm text-discord-textPrimary"
                            title={row.name}
                        >
                            {row.name}
                        </p>
                        {#if row.sizeLabel}
                            <p class="text-xs text-discord-textMuted">
                                {row.sizeLabel}
                            </p>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
{/snippet}

{#snippet captionField()}
    <div class="border-b border-discord-divider px-4 py-3">
        <textarea
            bind:value={caption}
            rows="2"
            placeholder="Add a message…"
            class="w-full resize-none rounded bg-discord-backgroundTertiary px-3 py-2 text-sm text-discord-textPrimary outline-none placeholder:text-discord-textMuted focus:ring-1 focus:ring-discord-accent"
        ></textarea>
    </div>
{/snippet}

{#snippet roomSearch()}
    <div class="px-3 pb-2 pt-3">
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
{/snippet}

{#snippet roomList()}
    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {#each rooms as room (room.roomId)}
            <button
                type="button"
                onclick={() => (selectedRoomId = room.roomId)}
                aria-pressed={selectedRoomId === room.roomId}
                class="flex w-full items-center gap-3 rounded px-2 py-2 text-left transition-colors hover:bg-discord-messageHover {selectedRoomId ===
                room.roomId
                    ? 'bg-discord-messageHover ring-1 ring-discord-accent'
                    : ''}"
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
{/snippet}

{#snippet footer()}
    <div class="flex justify-end gap-2 border-t border-discord-divider p-3">
        <button
            type="button"
            onclick={clearShare}
            class="px-3 py-2 text-sm font-semibold text-discord-textMuted hover:text-discord-textPrimary"
            >Cancel</button
        >
        <button
            type="button"
            onclick={submit}
            disabled={!selectedRoomId}
            class="rounded bg-discord-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-discord-accentHover disabled:cursor-not-allowed disabled:opacity-50"
            >Send</button
        >
    </div>
{/snippet}

{#if payload}
    {#if interfaceState.isTouchscreen}
        <Portal>
            <div
                class="fixed inset-0 z-[90] flex flex-col bg-discord-background"
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-target-title"
            >
                <div
                    class="flex items-center gap-2 border-b border-discord-divider px-2 py-3"
                >
                    <button
                        type="button"
                        onclick={clearShare}
                        class="rounded p-1.5 text-discord-textMuted hover:bg-discord-messageHover hover:text-discord-textPrimary"
                        aria-label="Close"
                        title="Close"><ArrowLeft size={20} /></button
                    >
                    <h2
                        id="share-target-title"
                        class="text-base font-semibold text-discord-textPrimary"
                    >
                        Share to a room
                    </h2>
                </div>
                {@render fileList()}
                {@render captionField()}
                {@render roomSearch()}
                {@render roomList()}
                {@render footer()}
            </div>
        </Portal>
    {:else}
        <Portal>
            <ModalDialog
                onClose={clearShare}
                labelledBy="share-target-title"
                layerClass="z-[90] flex items-center justify-center p-3"
                panelClass="relative flex max-h-[min(680px,90dvh)] w-full max-w-md flex-col overflow-hidden rounded-lg border border-discord-divider bg-discord-backgroundSecondary shadow-2xl"
            >
                <div
                    class="flex items-center justify-between border-b border-discord-divider px-4 py-3"
                >
                    <h2
                        id="share-target-title"
                        class="text-base font-semibold text-discord-textPrimary"
                    >
                        Share to a room
                    </h2>
                    <button
                        type="button"
                        onclick={clearShare}
                        class="ml-2 rounded p-1.5 text-discord-textMuted hover:bg-discord-messageHover hover:text-discord-textPrimary"
                        aria-label="Close"
                        title="Close"><X size={20} /></button
                    >
                </div>
                {@render fileList()}
                {@render captionField()}
                {@render roomSearch()}
                {@render roomList()}
                {@render footer()}
            </ModalDialog>
        </Portal>
    {/if}
{/if}

<script lang="ts">
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import {
        getPublicRooms,
        joinRoom,
        getRoom,
        mxcToHttp,
    } from "$lib/matrix/client";
    import {
        mergeRoomPages,
        normalizeServerInput,
        type DirectoryRoom,
    } from "$lib/utils/roomDirectory";
    import {
        roomsState,
        setActiveRoom,
        setActiveSpace,
    } from "$lib/stores/rooms.svelte";
    import { closeModal } from "$lib/stores/interface.svelte";

    let searchInput = $state("");
    let serverInput = $state("");
    let rooms = $state<DirectoryRoom[]>([]);
    let nextBatch = $state<string | null>(null);
    let totalEstimate = $state<number | null>(null);
    let loading = $state(false);
    let loadingMore = $state(false);
    let error = $state("");
    let joiningId = $state<string | null>(null);
    let joinError = $state<{ roomId: string; message: string } | null>(null);
    let searched = $state(false);

    function errorMessage(e: unknown): string {
        const err = e as { data?: { error?: string }; message?: string };
        return err?.data?.error ?? err?.message ?? "Something went wrong";
    }

    async function search() {
        loading = true;
        error = "";
        joinError = null;
        try {
            const page = await getPublicRooms({
                server: normalizeServerInput(serverInput),
                search: searchInput.trim() || undefined,
            });
            rooms = page.rooms;
            nextBatch = page.nextBatch;
            totalEstimate = page.totalEstimate;
            searched = true;
        } catch (e) {
            rooms = [];
            nextBatch = null;
            totalEstimate = null;
            error = errorMessage(e);
        } finally {
            loading = false;
        }
    }

    async function loadMore() {
        if (!nextBatch || loadingMore) return;
        loadingMore = true;
        error = "";
        try {
            const page = await getPublicRooms({
                server: normalizeServerInput(serverInput),
                search: searchInput.trim() || undefined,
                since: nextBatch,
            });
            rooms = mergeRoomPages(rooms, page.rooms);
            nextBatch = page.nextBatch;
        } catch (e) {
            error = errorMessage(e);
        } finally {
            loadingMore = false;
        }
    }

    function isJoined(roomId: string): boolean {
        void roomsState.roomsTick;
        return getRoom(roomId)?.getMyMembership() === "join";
    }

    function openJoined(entry: DirectoryRoom) {
        closeModal();
        if (entry.isSpace) setActiveSpace(entry.roomId);
        else setActiveRoom(entry.roomId);
    }

    async function join(entry: DirectoryRoom) {
        joiningId = entry.roomId;
        joinError = null;
        try {
            const via = normalizeServerInput(serverInput);
            await joinRoom(entry.roomId, via ? [via] : undefined);
            openJoined(entry);
        } catch (e) {
            joinError = { roomId: entry.roomId, message: errorMessage(e) };
        } finally {
            joiningId = null;
        }
    }

    // Initial page on open
    search();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    onclick={closeModal}
>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="bg-discord-background rounded-lg shadow-xl w-full max-w-2xl mx-4 p-6 flex flex-col gap-4 max-h-[85vh]"
        onclick={(e) => e.stopPropagation()}
    >
        <div class="flex items-start justify-between">
            <div>
                <h2 class="text-lg font-bold text-discord-textPrimary">
                    Explore rooms
                </h2>
                <p class="text-sm text-discord-textMuted">
                    Public rooms {serverInput.trim()
                        ? `on ${normalizeServerInput(serverInput)}`
                        : "on your homeserver"}
                    {#if totalEstimate !== null}
                        · ~{totalEstimate} rooms
                    {/if}
                </p>
            </div>
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button
                onclick={closeModal}
                class="text-discord-textMuted hover:text-discord-textPrimary transition-colors p-1"
                title="Close"
            >
                <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                    />
                </svg>
            </button>
        </div>

        <div
            class="flex gap-2"
            onkeydown={(e) => {
                if (e.key === "Enter") search();
            }}
        >
            <input
                bind:value={searchInput}
                placeholder="Search rooms…"
                class="flex-1 px-3 py-2 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm"
            />
            <input
                bind:value={serverInput}
                placeholder="Server (optional)"
                class="w-44 px-3 py-2 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm"
            />
            <button
                onclick={search}
                disabled={loading}
                class="px-4 py-2 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50"
                >Search</button
            >
        </div>

        {#if error}
            <p class="text-sm text-discord-error">{error}</p>
        {/if}

        <div class="flex-1 overflow-y-auto flex flex-col gap-1 min-h-32">
            {#if loading}
                <div class="flex items-center justify-center py-10">
                    <div
                        class="w-6 h-6 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"
                    ></div>
                </div>
            {:else if rooms.length === 0 && searched && !error}
                <p class="text-sm text-discord-textMuted text-center py-10">
                    No rooms found.
                </p>
            {:else}
                {#each rooms as entry (entry.roomId)}
                    <div
                        class="flex items-center gap-3 px-3 py-2 rounded hover:bg-discord-messageHover transition-colors"
                    >
                        <Avatar
                            src={mxcToHttp(entry.avatarMxc, 64)}
                            name={entry.name}
                            id={entry.roomId}
                            size={40}
                            rounded="xl"
                        />
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <span
                                    class="text-sm font-semibold text-discord-textPrimary truncate"
                                    >{entry.name}</span
                                >
                                {#if entry.isSpace}
                                    <span
                                        class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-discord-backgroundSecondary text-discord-textMuted flex-shrink-0"
                                        >Space</span
                                    >
                                {/if}
                            </div>
                            <p class="text-xs text-discord-textMuted truncate">
                                {#if entry.alias}{entry.alias} ·
                                {/if}{entry.memberCount}
                                {entry.memberCount === 1 ? "member" : "members"}
                                {#if entry.topic}
                                    · {entry.topic}{/if}
                            </p>
                            {#if joinError?.roomId === entry.roomId}
                                <p class="text-xs text-discord-error truncate">
                                    {joinError.message}
                                </p>
                            {/if}
                        </div>
                        {#if isJoined(entry.roomId)}
                            <button
                                onclick={() => openJoined(entry)}
                                class="px-3 py-1.5 rounded text-sm font-medium bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary transition-colors flex-shrink-0"
                                >Open</button
                            >
                        {:else if entry.joinRule === "knock"}
                            <button
                                disabled
                                title="This room requires a knock — not supported yet"
                                class="px-3 py-1.5 rounded text-sm font-medium bg-discord-backgroundSecondary text-discord-textMuted opacity-60 cursor-not-allowed flex-shrink-0"
                                >Knock only</button
                            >
                        {:else}
                            <button
                                onclick={() => join(entry)}
                                disabled={joiningId !== null}
                                class="px-3 py-1.5 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                            >
                                {#if joiningId === entry.roomId}
                                    <div
                                        class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"
                                    ></div>
                                {/if}
                                Join
                            </button>
                        {/if}
                    </div>
                {/each}
                {#if nextBatch}
                    <button
                        onclick={loadMore}
                        disabled={loadingMore}
                        class="mt-1 py-2 rounded text-sm font-medium text-discord-textSecondary hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {#if loadingMore}
                            <div
                                class="w-4 h-4 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"
                            ></div>
                        {/if}
                        Load more
                    </button>
                {/if}
            {/if}
        </div>
    </div>
</div>

<script lang="ts">
    import { Hash, Menu } from "lucide-svelte";
    import { roomsState, setActiveRoom } from "$lib/stores/rooms.svelte";
    import { joinRoom, type SpaceChildInfo } from "$lib/matrix/client";
    import { showErrorToast } from "$lib/stores/toasts.svelte";

    let {
        isMobile,
        onMenuOpen,
    }: { isMobile: boolean; onMenuOpen: () => void } = $props();

    let joiningIds = $state(new Set<string>());

    // A drilled or left space has no entry in `spaces` (that list is joined
    // spaces only), so the drill name — and finally a neutral phrase — carry
    // the copy rather than leaving it blank.
    const spaceName = $derived(
        roomsState.spaces.find((s) => s.roomId === roomsState.activeSpaceId)
            ?.name ||
            roomsState.spaceDrillName ||
            "this space",
    );

    const joinable = $derived(
        roomsState.spaceHierarchy.filter((r) => !r.isJoined && !r.isSpace),
    );
    const childSpaces = $derived(
        roomsState.spaceHierarchy.filter((r) => r.isSpace),
    );
    // Only claim emptiness once the hierarchy has actually answered.
    const stillLoading = $derived(
        roomsState.hierarchyLoading && roomsState.spaceHierarchy.length === 0,
    );

    async function handleJoin(child: SpaceChildInfo) {
        const roomId = child.roomId;
        joiningIds = new Set(joiningIds).add(roomId);
        try {
            await joinRoom(roomId, child.via);
            roomsState.spaceHierarchy = roomsState.spaceHierarchy.map((r) =>
                r.roomId === roomId ? { ...r, isJoined: true } : r,
            );
            setActiveRoom(roomId);
        } catch (err) {
            console.error("Failed to join room:", err);
            // The sidebar's Browse Channels list owns the knock/request flow —
            // point at it rather than growing a second copy here.
            showErrorToast(
                `Couldn't join ${child.name || "that channel"}. Try it from Browse Channels in the channel list.`,
            );
        } finally {
            const next = new Set(joiningIds);
            next.delete(roomId);
            joiningIds = next;
        }
    }
</script>

<div class="flex-1 flex flex-col min-w-0 overflow-hidden">
    {#if isMobile}
        <div
            class="h-12 flex items-center gap-2 px-3 border-b border-discord-backgroundTertiary shrink-0"
        >
            <button
                onclick={onMenuOpen}
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                aria-label="Open room list"
            >
                <Menu size={20} />
            </button>
            <span class="font-semibold text-discord-textPrimary truncate"
                >{spaceName}</span
            >
        </div>
    {/if}

    <div class="flex-1 overflow-y-auto p-8">
        {#if stillLoading}
            <div
                class="h-full flex items-center justify-center gap-3 text-discord-textMuted"
            >
                <div
                    class="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
                ></div>
                <span>Loading channels…</span>
            </div>
        {:else if joinable.length > 0}
            <div class="max-w-2xl mx-auto">
                <h2 class="text-2xl font-bold text-discord-textPrimary mb-1">
                    Browse channels
                </h2>
                <p class="text-discord-textMuted mb-6">
                    You haven't joined a channel in {spaceName} yet. Pick one to get
                    started.
                </p>
                <ul class="flex flex-col gap-2">
                    {#each joinable as child (child.roomId)}
                        <li
                            class="flex items-center gap-3 p-3 rounded-lg bg-discord-backgroundSecondary"
                        >
                            <Hash
                                size={20}
                                class="text-discord-textMuted shrink-0"
                            />
                            <div class="min-w-0 flex-1">
                                <p
                                    class="font-semibold text-discord-textPrimary truncate"
                                >
                                    {child.name || child.roomId}
                                </p>
                                {#if child.topic}
                                    <p
                                        class="text-sm text-discord-textMuted truncate"
                                    >
                                        {child.topic}
                                    </p>
                                {/if}
                            </div>
                            <span
                                class="text-xs text-discord-textMuted shrink-0 hidden sm:inline"
                                >{child.numMembers}
                                {child.numMembers === 1
                                    ? "member"
                                    : "members"}</span
                            >
                            <button
                                onclick={() => handleJoin(child)}
                                disabled={joiningIds.has(child.roomId)}
                                class="px-4 py-1.5 rounded bg-discord-accent hover:bg-discord-accentHover disabled:opacity-50 text-white text-sm font-semibold transition-colors shrink-0"
                            >
                                {joiningIds.has(child.roomId)
                                    ? "Joining…"
                                    : "Join"}
                            </button>
                        </li>
                    {/each}
                </ul>
            </div>
        {:else if childSpaces.length > 0}
            <div
                class="h-full flex flex-col items-center justify-center text-center"
            >
                <h2 class="text-xl font-bold text-discord-textPrimary mb-2">
                    Nothing joined here yet
                </h2>
                <p class="text-discord-textMuted max-w-sm">
                    {spaceName} only holds other spaces — open one from the channel
                    list to browse its channels.
                </p>
            </div>
        {:else}
            <div
                class="h-full flex flex-col items-center justify-center text-center"
            >
                <p class="text-discord-textMuted max-w-sm">
                    {spaceName} has no channels yet.
                </p>
            </div>
        {/if}
    </div>
</div>

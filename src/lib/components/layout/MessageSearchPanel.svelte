<script lang="ts">
    import type { Room, ISearchResults } from "matrix-js-sdk";
    import {
        searchRoomMessages,
        searchRoomMessagesMore,
        getMemberName,
        getMemberAvatar,
    } from "$lib/matrix/client";
    import {
        buildSnippetSegments,
        isSearchUnsupportedError,
    } from "$lib/utils/messageSearch";
    import { searchState } from "$lib/stores/search.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { format } from "date-fns";

    interface Props {
        room: Room;
        onClose: () => void;
        onJumpTo: (eventId: string) => void;
    }

    let { room, onClose, onJumpTo }: Props = $props();

    let term = $state("");
    let searched = $state<string | null>(null);
    let searching = $state(false);
    let loadingMore = $state(false);
    let error = $state<string | null>(null);
    // The SDK mutates the results object in place on pagination (same
    // reference), so hold it raw and bump a tick for reactivity.
    let results = $state.raw<ISearchResults | null>(null);
    let resultsTick = $state(0);
    let inputEl: HTMLInputElement | undefined = $state();

    // Reset when switching rooms.
    $effect(() => {
        void room.roomId;
        term = "";
        searched = null;
        results = null;
        error = null;
    });

    // Focus the input when the panel opens. preventScroll matters: on mobile
    // the panel mounts offscreen-right inside MessageArea's overflow-hidden
    // root and slides in; a plain focus() during the slide makes the browser
    // scroll that root sideways to reveal the input, shifting the whole chat
    // 280px left (search panel half offscreen, closed member drawer dragged
    // into view).
    $effect(() => {
        inputEl?.focus({ preventScroll: true });
    });

    async function runSearch() {
        const query = term.trim();
        if (!query || searching) return;
        searching = true;
        error = null;
        results = null;
        try {
            results = await searchRoomMessages(room.roomId, query);
            searched = query;
            resultsTick++;
        } catch (e) {
            if (isSearchUnsupportedError(e)) {
                console.warn(
                    "Message search: homeserver does not support /search — hiding the feature",
                );
                searchState.unsupported = true;
                onClose();
            } else {
                console.error("Message search failed", e);
                error = e instanceof Error ? e.message : "Search failed";
            }
        } finally {
            searching = false;
        }
    }

    async function loadMore() {
        if (!results || loadingMore) return;
        loadingMore = true;
        try {
            await searchRoomMessagesMore(results);
            resultsTick++;
        } catch (e) {
            console.error("Message search pagination failed", e);
            error = e instanceof Error ? e.message : "Search failed";
        } finally {
            loadingMore = false;
        }
    }

    const rows = $derived.by(() => {
        void resultsTick;
        if (!results) return [];
        const seen = new Set<string>();
        return results.results
            .map((r) => r.context.getEvent())
            .filter((e) => {
                const id = e.getId();
                if (
                    !id ||
                    seen.has(id) ||
                    typeof e.getContent()?.body !== "string" ||
                    e.isRedacted()
                )
                    return false;
                seen.add(id);
                return true;
            });
    });
    const highlights = $derived(
        (void resultsTick, results ? results.highlights : []),
    );
    const hasMore = $derived(
        (void resultsTick, results?.next_batch !== undefined),
    );
    const resultCount = $derived(
        (void resultsTick, results?.count ?? rows.length),
    );

    function jumpTo(eventId: string) {
        onJumpTo(eventId);
        // The panel overlays the whole chat on mobile — close it so the
        // jumped-to message is visible. Desktop keeps it open for browsing.
        if (interfaceState.isMobile) onClose();
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
            Search Messages
        </h3>
    </div>

    <form
        onsubmit={(e) => {
            e.preventDefault();
            runSearch();
        }}
        class="p-2 border-b border-discord-divider flex-shrink-0"
    >
        <input
            bind:this={inputEl}
            bind:value={term}
            type="text"
            placeholder="Search this room…"
            class="w-full px-2 py-1.5 text-sm rounded bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted outline-none focus:ring-1 focus:ring-discord-accent"
        />
    </form>

    <div class="flex-1 overflow-y-auto">
        {#if searching}
            <div class="flex justify-center mt-8">
                <div
                    class="w-5 h-5 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"
                ></div>
            </div>
        {:else if error}
            <p class="text-sm text-discord-danger text-center mt-8 px-4">
                {error}
            </p>
        {:else if searched === null}
            <p class="text-sm text-discord-textMuted text-center mt-8 px-4">
                Search for messages in this room.
            </p>
        {:else if rows.length === 0}
            <p class="text-sm text-discord-textMuted text-center mt-8 px-4">
                No results for “{searched}”.
            </p>
        {:else}
            <p class="text-xs text-discord-textMuted px-4 mt-2">
                {resultCount} result{resultCount === 1 ? "" : "s"}
            </p>
            <div class="p-2 space-y-1">
                {#each rows as event (event.getId())}
                    {@const sender = event.getSender() ?? ""}
                    {@const avatarUrl = getMemberAvatar(room, sender)}
                    {@const name = getMemberName(room, sender)}
                    <button
                        onclick={() => jumpTo(event.getId()!)}
                        class="w-full text-left p-2 rounded-lg hover:bg-discord-messageHover transition-colors"
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
                                >{format(event.getTs(), "MMM d, HH:mm")}</span
                            >
                        </div>
                        <p
                            class="text-xs text-discord-textMuted line-clamp-3 break-words"
                        >
                            {#each buildSnippetSegments(event.getContent().body, highlights) as segment, i (i)}
                                {#if segment.highlight}<mark
                                        class="bg-discord-accent/40 text-discord-textPrimary rounded-sm px-px"
                                        >{segment.text}</mark
                                    >{:else}{segment.text}{/if}
                            {/each}
                        </p>
                    </button>
                {/each}
                {#if hasMore}
                    <button
                        onclick={loadMore}
                        disabled={loadingMore}
                        class="w-full py-1.5 text-xs text-discord-accent hover:underline disabled:opacity-50"
                    >
                        {loadingMore ? "Loading…" : "Load more"}
                    </button>
                {/if}
            </div>
        {/if}
    </div>
</div>

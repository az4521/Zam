<script lang="ts">
    import type { Room, ISearchResults } from "matrix-js-sdk";
    import {
        searchRoomMessages,
        searchRoomMessagesMore,
        getMemberName,
        getMemberAvatar,
        getRoomMembers,
    } from "$lib/matrix/client";
    import {
        buildSnippetSegments,
        isSearchUnsupportedError,
        parseSearchQuery,
        buildServerSearchFilter,
        matchesParsedQuery,
        parsedQueryNeedsClientRefine,
        type ParsedSearchQuery,
        type SearchEventMeta,
    } from "$lib/utils/messageSearch";
    import {
        activeSearchToken,
        filterMemberSuggestions,
        hasValueSuggestions,
        operatorSuggestions,
        applySuggestion,
        type ActiveSearchToken,
    } from "$lib/utils/searchAutocomplete";
    import { createStaleGuard } from "$lib/utils/staleGuard";
    import { searchState } from "$lib/stores/search.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { compactDateTime } from "$lib/utils/timeFormat";

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
    let searchedQuery = $state.raw<ParsedSearchQuery | null>(null);
    let activeToken = $state<ActiveSearchToken | null>(null);
    let selectedIdx = $state(0);

    // The panel is NOT keyed by room (MessageArea passes `room` as a plain
    // prop), so a room switch leaves the previous room's /search in flight.
    // One guard covers both the search and its pagination: whichever request
    // starts last is the only one allowed to write.
    const requests = createStaleGuard();

    // Reset when switching rooms. Cancelling the guard is what stops the old
    // room's in-flight response from painting itself into the new room; the
    // spinner flags are cleared here because that superseded run will report
    // nothing at all.
    $effect(() => {
        void room.roomId;
        requests.cancel();
        term = "";
        searched = null;
        results = null;
        error = null;
        searching = false;
        loadingMore = false;
        searchedQuery = null;
        activeToken = null;
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
        const parsed = parseSearchQuery(query);
        // Block only if the WHOLE query is empty (no term, no operators), or already searching.
        if (
            parsed.term === "" &&
            parsed.senders.length === 0 &&
            parsed.has.length === 0
        )
            return;
        if (searching) return;
        searching = true;
        error = null;
        results = null;
        // A new search discards the page `loadMore` was extending, and the
        // shared guard makes that pagination stale — so it will report nothing
        // and can no longer clear its own flag. Clear it here, next to the
        // results it belonged to, or the "Load more" button comes back
        // permanently stuck on "Loading…".
        loadingMore = false;
        const outcome = await requests.run(() =>
            searchRoomMessages(
                room.roomId,
                parsed.term,
                buildServerSearchFilter(room.roomId, parsed),
            ),
        );
        // Superseded by a room switch or a newer request — the run that
        // replaced us owns `searching`, `results` and `error` now.
        if (outcome.status === "stale") return;
        searching = false;
        if (outcome.status === "ok") {
            results = outcome.value;
            searched = query;
            searchedQuery = parsed;
            resultsTick++;
            return;
        }
        const e = outcome.error;
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
    }

    async function loadMore() {
        if (!results || loadingMore) return;
        const page = results;
        loadingMore = true;
        const outcome = await requests.run(() => searchRoomMessagesMore(page));
        if (outcome.status === "stale") return;
        loadingMore = false;
        if (outcome.status === "ok") {
            resultsTick++;
            return;
        }
        console.error("Message search pagination failed", outcome.error);
        error =
            outcome.error instanceof Error
                ? outcome.error.message
                : "Search failed";
    }

    function metaOf(e: any): SearchEventMeta {
        const content = e.getContent();
        return {
            sender: e.getSender() ?? "",
            msgtype: content.msgtype ?? "",
            body: content.body ?? "",
            isVoice:
                "org.matrix.msc3245.voice" in content || "m.voice" in content,
        };
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
                // Client-side refinement when the server can't fully honor the query.
                if (
                    searchedQuery &&
                    parsedQueryNeedsClientRefine(searchedQuery)
                ) {
                    if (!matchesParsedQuery(metaOf(e), searchedQuery))
                        return false;
                }
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
        (void resultsTick,
        searchedQuery && parsedQueryNeedsClientRefine(searchedQuery)
            ? rows.length
            : (results?.count ?? rows.length)),
    );

    function jumpTo(eventId: string) {
        onJumpTo(eventId);
        // The panel overlays the whole chat on mobile — close it so the
        // jumped-to message is visible. Desktop keeps it open for browsing.
        if (interfaceState.isMobile) onClose();
    }

    // Autocomplete suggestions for operators and values.
    const suggestions = $derived.by(
        (): {
            label: string;
            completion: string;
            sub?: string;
        }[] => {
            void roomsState.roomsTick;
            if (!activeToken) return [];
            const { kind, query } = activeToken;
            if (kind === "operator") {
                return operatorSuggestions(query).map((op) => ({
                    label: op,
                    completion: op,
                }));
            }
            if (kind === "has") {
                return hasValueSuggestions(query).map((v) => ({
                    label: `has:${v}`,
                    completion: `has:${v}`,
                }));
            }
            // kind === "from"
            return filterMemberSuggestions(
                getRoomMembers(room).map((m) => ({
                    userId: m.userId,
                    displayName: m.rawDisplayName || m.userId,
                })),
                query,
            ).map((m) => ({
                label: m.displayName,
                sub: m.userId,
                completion: `from:${m.userId}`,
            }));
        },
    );

    // Clamp selectedIdx when suggestions shrink (mirror MessageInput's mention clamp).
    $effect(() => {
        if (selectedIdx >= suggestions.length) selectedIdx = 0;
    });

    function commit(s: { completion: string }) {
        if (!activeToken) return;
        const r = applySuggestion(inputEl!.value, activeToken, s.completion);
        term = r.text;
        activeToken = null;
        // Restore focus + caret after the autocomplete cycle.
        queueMicrotask(() => {
            inputEl?.focus();
            inputEl?.setSelectionRange(r.caret, r.caret);
        });
    }

    function updateActiveToken() {
        if (!inputEl) return;
        activeToken = activeSearchToken(
            inputEl.value,
            inputEl.selectionStart ?? inputEl.value.length,
        );
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
            placeholder="Search — try from: or has:image"
            class="w-full px-2 py-1.5 text-sm rounded bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted outline-none focus:ring-1 focus:ring-discord-accent"
            oninput={() => {
                updateActiveToken();
            }}
            onselectionchange={() => {
                updateActiveToken();
            }}
            onkeydown={(e) => {
                if (activeToken && suggestions.length > 0) {
                    if (e.key === "ArrowDown") {
                        e.preventDefault();
                        selectedIdx = (selectedIdx + 1) % suggestions.length;
                    } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        selectedIdx =
                            (selectedIdx - 1 + suggestions.length) %
                            suggestions.length;
                    } else if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        commit(suggestions[selectedIdx]);
                    } else if (e.key === "Escape") {
                        e.preventDefault();
                        activeToken = null;
                    }
                }
            }}
        />
        {#if activeToken && suggestions.length > 0}
            <div
                class="mt-1 max-h-64 overflow-y-auto bg-discord-backgroundSecondary border border-discord-divider rounded-lg"
            >
                {#each suggestions as s, i}
                    <button
                        type="button"
                        class="w-full text-left px-3 py-2 text-sm transition-colors"
                        class:bg-discord-messageHover={i === selectedIdx}
                        onpointerdown={(e) => {
                            e.preventDefault();
                            commit(s);
                        }}
                        onpointerenter={() => {
                            selectedIdx = i;
                        }}
                    >
                        <div class="text-discord-textPrimary">{s.label}</div>
                        {#if s.sub}
                            <div class="text-xs text-discord-textMuted">
                                {s.sub}
                            </div>
                        {/if}
                    </button>
                {/each}
            </div>
        {/if}
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
                                >{compactDateTime(event.getTs())}</span
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

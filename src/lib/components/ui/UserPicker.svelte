<script lang="ts">
    import { searchUserDirectory, getOwnServerName } from "$lib/matrix/client";
    import type { UserSearchResult } from "$lib/matrix/client";
    import { isValidUserId, debounce } from "$lib/utils/userSearch";
    import {
        clampActiveIndex,
        nextActiveIndex,
        optionId,
    } from "$lib/utils/listboxNavigation";
    import { X } from "lucide-svelte";
    import Avatar from "./Avatar.svelte";

    let {
        mode = "single",
        selected = $bindable<string[]>([]),
        excludeUserIds = [],
        autofocus = false,
        placeholder = "Search for people…",
        disabled = false,
        onpick,
    }: {
        mode?: "single" | "multi";
        selected?: string[];
        excludeUserIds?: string[];
        autofocus?: boolean;
        placeholder?: string;
        disabled?: boolean;
        onpick?: (userId: string) => void;
    } = $props();

    let input = $state("");
    let results = $state<UserSearchResult[]>([]);
    let searching = $state(false);
    let searched = $state(false);
    let searchError = $state("");
    let seq = 0;

    // Unique per mounted instance. The picker mounts in both InvitePanel and
    // QuickActions, and duplicate DOM ids would silently point one instance's
    // aria-controls / aria-activedescendant at the other instance's elements.
    const listId = $props.id();

    // Where the arrow keys have moved the virtual cursor. This is what the key
    // handler writes; `activeIndex` below is it clamped to the options that are
    // actually rendered, so a result list that changes under the user can never
    // leave the cursor aimed at an option that is no longer there.
    let activeIndexRaw = $state(-1);

    const excluded = $derived(new Set([...excludeUserIds, ...selected]));
    const visibleResults = $derived(
        results.filter((u) => !excluded.has(u.userId)),
    );

    // The homeserver's user directory doesn't index everyone (private/local
    // accounts often aren't searchable), so let the raw input resolve to a
    // pickable user id: a full typed `@user:server`, or a bare localpart
    // assumed to be on your OWN homeserver — so you don't have to guess the
    // server name from the homeserver URL.
    const ownDomain = getOwnServerName();
    function toCandidate(raw: string): string | null {
        const term = raw.trim();
        if (!term) return null;
        if (isValidUserId(term)) return term;
        if (ownDomain && /^[^\s:@]+$/.test(term))
            return `@${term}:${ownDomain}`;
        return null;
    }
    const candidate = $derived(toCandidate(input));
    // Hide the candidate row when a search result already offers the same id.
    const candidateShown = $derived(
        candidate && !visibleResults.some((u) => u.userId === candidate)
            ? candidate
            : null,
    );
    const candidateExcluded = $derived(
        candidateShown ? excluded.has(candidateShown) : false,
    );

    // The flat option list the listbox exposes: the candidate row is option 0
    // when it is shown, then the search results. Keeping the candidate first
    // preserves Enter's existing preference for it while finally making that
    // row reachable by arrow key instead of mouse-only.
    const resultOffset = $derived(candidateShown ? 1 : 0);
    const optionCount = $derived(resultOffset + visibleResults.length);
    const activeIndex = $derived(clampActiveIndex(activeIndexRaw, optionCount));

    async function run(term: string) {
        const mine = ++seq;
        try {
            const res = await searchUserDirectory(term, 10);
            if (mine !== seq) return;
            results = res.users;
            searchError = "";
            searched = true;
        } catch {
            if (mine !== seq) return;
            results = [];
            searchError =
                "User search failed — you can still enter a full user ID.";
            searched = true;
        } finally {
            if (mine === seq) searching = false;
        }
    }
    const debouncedRun = debounce((t: string) => void run(t), 300);

    $effect(() => {
        const term = input.trim();
        if (term.length < 2) {
            debouncedRun.cancel();
            seq++;
            results = [];
            searching = false;
            searched = false;
            searchError = "";
            return;
        }
        searching = true;
        searched = false;
        debouncedRun(term);
    });

    function pick(userId: string) {
        if (disabled || excluded.has(userId)) return;
        if (mode === "multi") {
            selected = [...selected, userId];
            input = "";
        }
        // single mode: parent acts on the pick; multi mode: optional observer.
        onpick?.(userId);
    }

    function pickAt(index: number) {
        if (index < 0) return;
        if (candidateShown && index === 0) {
            pick(candidateShown);
            return;
        }
        const user = visibleResults[index - resultOffset];
        if (user) pick(user.userId);
    }

    function remove(userId: string) {
        selected = selected.filter((id) => id !== userId);
    }

    // Keep the arrow-selected option scrolled into view. Deliberately no
    // `behavior`, so it inherits the default `auto` and there is no scripted
    // animation for prefers-reduced-motion to have to suppress.
    $effect(() => {
        const index = activeIndex;
        if (index < 0) return;
        document
            .getElementById(optionId(listId, index))
            ?.scrollIntoView({ block: "nearest" });
    });

    function onKeydown(e: KeyboardEvent) {
        // Home/End steer the listbox only once the user is actually navigating
        // it. This is an *editable* combobox, so with no active option those
        // keys belong to the text caret — the ARIA authoring practices assign
        // them to the popup only when focus is inside the listbox, and
        // hijacking them unconditionally would strand the caret mid-user-ID.
        if (
            e.key === "ArrowDown" ||
            e.key === "ArrowUp" ||
            ((e.key === "Home" || e.key === "End") && activeIndex >= 0)
        ) {
            if (!optionCount) return;
            e.preventDefault();
            activeIndexRaw = nextActiveIndex(activeIndex, optionCount, e.key);
            return;
        }
        if (e.key === "Escape" && activeIndex >= 0) {
            // Only swallow Escape when it has something to do here, so an
            // Escape with no active option still reaches a parent that wants
            // to close the panel.
            e.preventDefault();
            activeIndexRaw = -1;
            return;
        }
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (activeIndex >= 0) {
            pickAt(activeIndex);
            return;
        }
        // Unchanged fallback: Enter with nothing arrow-selected keeps today's
        // behaviour so muscle memory and the existing tests still hold.
        if (candidate) pick(candidate);
        else if (visibleResults.length) pick(visibleResults[0].userId);
    }
</script>

<div class="space-y-2">
    {#if mode === "multi" && selected.length}
        <div class="flex flex-wrap gap-1.5">
            {#each selected as userId (userId)}
                <span
                    class="flex items-center gap-1 bg-discord-backgroundTertiary text-discord-textPrimary text-xs rounded px-2 py-1"
                >
                    {userId}
                    <button
                        onclick={() => remove(userId)}
                        class="text-discord-textMuted hover:text-discord-textPrimary flex items-center"
                        aria-label="Remove {userId}"
                    >
                        <X size={14} />
                    </button>
                </span>
            {/each}
        </div>
    {/if}

    <!-- svelte-ignore a11y_autofocus -->
    <input
        bind:value={input}
        onkeydown={onKeydown}
        {autofocus}
        {placeholder}
        role="combobox"
        aria-label={placeholder}
        aria-expanded={optionCount > 0}
        aria-controls={optionCount > 0 ? `${listId}-listbox` : undefined}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0
            ? optionId(listId, activeIndex)
            : undefined}
        class="w-full bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
    />

    <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {#if searching}
            Searching…
        {:else if searched && optionCount === 0}
            No matching users
        {:else if optionCount > 0}
            {optionCount}
            {optionCount === 1 ? "result" : "results"} available
        {/if}
    </div>

    {#if searchError}
        <p role="alert" class="text-xs text-discord-textMuted">{searchError}</p>
    {/if}

    <!-- One listbox owns every option. The candidate row sits outside the
         results' scroll box visually, so the listbox is this wrapper rather
         than the scroll box itself; `space-y-2` reproduces exactly the gap the
         two blocks used to get as siblings of the outer container. -->
    {#if optionCount > 0}
        <div
            id="{listId}-listbox"
            role="listbox"
            aria-label="Search results"
            class="space-y-2"
        >
            {#if candidateShown}
                <button
                    onclick={() => pick(candidateShown)}
                    disabled={disabled || candidateExcluded}
                    id={optionId(listId, 0)}
                    role="option"
                    aria-selected={activeIndex === 0}
                    tabindex="-1"
                    class:opacity-50={disabled || candidateExcluded}
                    class="w-full flex items-center gap-2.5 px-2.5 py-2 text-left rounded bg-discord-backgroundSecondary hover:bg-discord-messageHover transition-colors {activeIndex ===
                    0
                        ? 'ring-1 ring-inset ring-discord-accent'
                        : ''}"
                >
                    <span
                        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-discord-backgroundTertiary text-discord-textMuted text-sm"
                        >@</span
                    >
                    <span class="min-w-0">
                        <span
                            class="block text-sm text-discord-textPrimary truncate"
                            >Invite {candidateShown}</span
                        >
                        <span
                            class="block text-xs text-discord-textMuted truncate"
                        >
                            {#if candidateExcluded}
                                {selected.includes(candidateShown)
                                    ? "Already added"
                                    : "Already in this room"}
                            {:else}
                                Send an invite to this exact user ID
                            {/if}
                        </span>
                    </span>
                </button>
            {/if}

            {#if visibleResults.length}
                <!-- role="presentation" so the scroll box doesn't sit in the
                     accessibility tree between the listbox and its options. -->
                <div
                    role="presentation"
                    class="max-h-56 overflow-y-auto rounded bg-discord-backgroundSecondary divide-y divide-discord-divider"
                >
                    {#each visibleResults as user, i (user.userId)}
                        {@const flatIndex = i + resultOffset}
                        <button
                            onclick={() => pick(user.userId)}
                            {disabled}
                            id={optionId(listId, flatIndex)}
                            role="option"
                            aria-selected={flatIndex === activeIndex}
                            tabindex="-1"
                            class:opacity-50={disabled}
                            class="w-full flex items-center gap-2.5 px-2.5 py-2 text-left hover:bg-discord-messageHover transition-colors {flatIndex ===
                            activeIndex
                                ? 'ring-1 ring-inset ring-discord-accent'
                                : ''}"
                        >
                            <Avatar
                                src={user.avatarUrl}
                                name={user.displayName ?? user.userId}
                                id={user.userId}
                                size={28}
                            />
                            <span class="min-w-0">
                                <span
                                    class="block text-sm text-discord-textPrimary truncate"
                                    >{user.displayName ?? user.userId}</span
                                >
                                {#if user.displayName}
                                    <span
                                        class="block text-xs text-discord-textMuted truncate"
                                        >{user.userId}</span
                                    >
                                {/if}
                            </span>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}

    {#if optionCount === 0 && searched && !searching && input.trim().length >= 2}
        <p class="text-xs text-discord-textMuted">
            No matches. Type a full user ID like <span
                class="text-discord-textSecondary">@user:server</span
            > to invite someone the directory doesn't list.
        </p>
    {/if}
</div>

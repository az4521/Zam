<script lang="ts">
    import { searchUserDirectory, getOwnServerName } from "$lib/matrix/client";
    import type { UserSearchResult } from "$lib/matrix/client";
    import { isValidUserId, debounce } from "$lib/utils/userSearch";
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

    function remove(userId: string) {
        selected = selected.filter((id) => id !== userId);
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key !== "Enter") return;
        e.preventDefault();
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
        class="w-full bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
    />

    {#if searchError}
        <p class="text-xs text-discord-textMuted">{searchError}</p>
    {/if}

    {#if candidateShown}
        <button
            onclick={() => pick(candidateShown)}
            disabled={disabled || candidateExcluded}
            class:opacity-50={disabled || candidateExcluded}
            class="w-full flex items-center gap-2.5 px-2.5 py-2 text-left rounded bg-discord-backgroundSecondary hover:bg-discord-messageHover transition-colors"
        >
            <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-discord-backgroundTertiary text-discord-textMuted text-sm"
                >@</span
            >
            <span class="min-w-0">
                <span class="block text-sm text-discord-textPrimary truncate"
                    >Invite {candidateShown}</span
                >
                <span class="block text-xs text-discord-textMuted truncate">
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
        <div
            class="max-h-56 overflow-y-auto rounded bg-discord-backgroundSecondary divide-y divide-discord-divider"
        >
            {#each visibleResults as user (user.userId)}
                <button
                    onclick={() => pick(user.userId)}
                    {disabled}
                    class:opacity-50={disabled}
                    class="w-full flex items-center gap-2.5 px-2.5 py-2 text-left hover:bg-discord-messageHover transition-colors"
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
    {:else if !candidateShown && searched && !searching && input.trim().length >= 2}
        <p class="text-xs text-discord-textMuted">
            No matches. Type a full user ID like <span
                class="text-discord-textSecondary">@user:server</span
            > to invite someone the directory doesn't list.
        </p>
    {/if}
</div>

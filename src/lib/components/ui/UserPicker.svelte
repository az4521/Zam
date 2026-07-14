<script lang="ts">
    import { searchUserDirectory } from "$lib/matrix/client";
    import type { UserSearchResult } from "$lib/matrix/client";
    import { isValidUserId, debounce } from "$lib/utils/userSearch";
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
        const term = input.trim();
        if (isValidUserId(term)) pick(term);
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
                        class="text-discord-textMuted hover:text-discord-textPrimary"
                        aria-label="Remove {userId}">×</button
                    >
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
    {:else if searched && !searching && input.trim().length >= 2}
        <p class="text-xs text-discord-textMuted">
            No matches. Enter a full user ID like <span
                class="text-discord-textSecondary">@user:server</span
            > and press Enter.
        </p>
    {/if}
</div>

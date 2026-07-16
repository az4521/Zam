<script lang="ts">
    import {
        favouritesState,
        addFavouriteGif,
        removeFavouriteGif,
        isFavouriteGif,
    } from "$lib/stores/favourites.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import { settingsState } from "$lib/stores/settings.svelte";
    import {
        klipyEnabled,
        type GifKind,
        type GifResult,
    } from "$lib/utils/klipy";
    import {
        gifSearchState,
        loadGifs,
        queueSearch,
        loadMore,
    } from "$lib/stores/gifSearch.svelte";
    import { untrack } from "svelte";

    interface Props {
        onSelect: (url: string) => void;
        onClose: () => void;
        onSwitchToEmoji?: () => void;
        onSwitchToSticker?: () => void;
    }

    let { onSelect, onClose, onSwitchToEmoji, onSwitchToSticker }: Props =
        $props();

    type Tab = "gifs" | "memes" | "favourites";

    const enabled = klipyEnabled();

    // Land on the configured tab (only "gifs"/"favourites" are landing options);
    // with no key, favourites is the only tab.
    let tab = $state<Tab>(
        enabled
            ? settingsState.gifDefaultTab === "favourites"
                ? "favourites"
                : "gifs"
            : "favourites",
    );

    let search = $state("");
    let searchEl: HTMLInputElement | undefined = $state();
    let gridEl: HTMLDivElement | undefined = $state();

    $effect(() => {
        if (!interfaceState.isTouchscreen) searchEl?.focus();
    });

    // Tab/kind change → immediate KLIPY load. `search` is read untracked so
    // typing does NOT retrigger this effect; typing is debounced in
    // onSearchInput instead. This avoids a wasted/wrong-kind request on switch.
    $effect(() => {
        const t = tab;
        if (t === "favourites" || !enabled) return;
        const kind: GifKind = t === "memes" ? "memes" : "gifs";
        untrack(() => loadGifs(kind, search));
    });

    function onSearchInput(e: Event & { currentTarget: HTMLInputElement }) {
        search = e.currentTarget.value;
        if (tab !== "favourites" && enabled) {
            const kind: GifKind = tab === "memes" ? "memes" : "gifs";
            queueSearch(kind, search);
        }
    }

    // Favourites tab: today's local text filter.
    const favourites = $derived(favouritesState.gifs);
    const visibleFavourites = $derived(
        search
            ? favourites.filter((g) =>
                  g.url.toLowerCase().includes(search.toLowerCase()),
              )
            : favourites,
    );

    function pickUrl(url: string) {
        onSelect(url);
        onClose();
    }

    function toggleStar(r: GifResult) {
        if (isFavouriteGif(r.url)) removeFavouriteGif(r.url);
        else addFavouriteGif({ url: r.url, previewUrl: r.previewUrl });
    }

    function onGridScroll() {
        if (!gridEl || tab === "favourites") return;
        const nearBottom =
            gridEl.scrollTop + gridEl.clientHeight >= gridEl.scrollHeight - 200;
        if (nearBottom) loadMore();
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") onClose();
    }

    function selectTab(next: Tab) {
        // The $effect above performs the immediate load when `tab` changes.
        tab = next;
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="{interfaceState.isTouchscreen
        ? 'w-full rounded-t-xl'
        : 'w-72 rounded-xl'} bg-discord-backgroundSecondary border border-discord-divider shadow-2xl flex flex-col"
    style={interfaceState.isTouchscreen
        ? "max-height: 50dvh;"
        : "max-height: 380px;"}
    onkeydown={onKeydown}
>
    {#if interfaceState.isTouchscreen}
        <!-- Outer picker tabs (Emoji / Stickers / GIFs) -->
        <div class="flex border-b border-discord-divider flex-shrink-0">
            {#if onSwitchToEmoji}<button
                    onclick={onSwitchToEmoji}
                    class="flex-1 py-2 text-sm font-medium text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                    >Emoji</button
                >{/if}
            {#if onSwitchToSticker}<button
                    onclick={onSwitchToSticker}
                    class="flex-1 py-2 text-sm font-medium text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                    >Stickers</button
                >{/if}
            <button
                class="flex-1 py-2 text-sm font-semibold text-discord-textPrimary border-b-2 border-discord-accent"
                >GIFs</button
            >
        </div>
    {/if}

    {#if enabled}
        <!-- Inner content tabs -->
        <div class="flex gap-1 px-2 pt-2 flex-shrink-0">
            {#each [["gifs", "GIFs"], ["memes", "Memes"], ["favourites", "★ Favourites"]] as [value, label] (value)}
                <button
                    onclick={() => selectTab(value as Tab)}
                    class="flex-1 py-1.5 text-xs font-semibold rounded transition-colors {tab ===
                    value
                        ? 'bg-discord-backgroundTertiary text-discord-textPrimary'
                        : 'text-discord-textMuted hover:text-discord-textPrimary'}"
                    >{label}</button
                >
            {/each}
        </div>
    {/if}

    <!-- Search -->
    <div class="px-3 pt-3 pb-2 flex-shrink-0">
        <input
            bind:this={searchEl}
            type="text"
            value={search}
            oninput={onSearchInput}
            placeholder={tab === "favourites"
                ? "Search favourites…"
                : "Search KLIPY…"}
            class="search-input w-full bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded-lg px-3 py-1.5 outline-none border border-transparent"
        />
    </div>

    <!-- Grid -->
    <div
        bind:this={gridEl}
        onscroll={onGridScroll}
        class="flex-1 overflow-y-auto min-h-0 px-2 pb-2"
    >
        {#if tab === "favourites"}
            {#if visibleFavourites.length === 0}
                <p class="text-center text-discord-textMuted text-sm py-8 px-4">
                    {favourites.length === 0
                        ? "No favourite GIFs yet. Star a GIF to save it here."
                        : "No results"}
                </p>
            {:else}
                <div class="grid grid-cols-4 gap-1 mt-1">
                    {#each visibleFavourites as gif (gif.url)}
                        <div class="relative group/gif">
                            <button
                                onclick={() => pickUrl(gif.url)}
                                title={gif.url}
                                class="w-full aspect-square rounded hover:bg-discord-messageHover transition-colors flex items-center justify-center overflow-hidden"
                            >
                                <img
                                    src={gif.previewUrl}
                                    alt=""
                                    class="w-full h-full object-cover rounded"
                                    loading="lazy"
                                />
                            </button>
                            <button
                                onclick={(e) => {
                                    e.stopPropagation();
                                    removeFavouriteGif(gif.url);
                                }}
                                title="Remove from favourites"
                                class="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-discord-warning opacity-0 group-hover/gif:opacity-100 transition-opacity hover:bg-black/80"
                            >
                                <svg
                                    class="w-3.5 h-3.5"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                    />
                                </svg>
                            </button>
                        </div>
                    {/each}
                </div>
            {/if}
        {:else}
            <!-- KLIPY tabs (gifs / memes) -->
            {#if gifSearchState.error && gifSearchState.items.length === 0}
                <button
                    onclick={() =>
                        loadGifs(tab === "memes" ? "memes" : "gifs", search)}
                    class="w-full text-center text-discord-textMuted text-sm py-8 px-4 hover:text-discord-textPrimary transition-colors"
                >
                    {gifSearchState.error}
                </button>
            {:else if gifSearchState.items.length === 0 && !gifSearchState.loading}
                <p class="text-center text-discord-textMuted text-sm py-8 px-4">
                    No results
                </p>
            {:else}
                <div class="grid grid-cols-4 gap-1 mt-1">
                    {#each gifSearchState.items as r (r.id)}
                        <div class="relative group/gif">
                            <button
                                onclick={() => pickUrl(r.url)}
                                class="w-full aspect-square rounded hover:bg-discord-messageHover transition-colors flex items-center justify-center overflow-hidden"
                            >
                                <img
                                    src={r.previewUrl}
                                    alt=""
                                    class="w-full h-full object-cover rounded"
                                    loading="lazy"
                                />
                            </button>
                            <button
                                onclick={(e) => {
                                    e.stopPropagation();
                                    toggleStar(r);
                                }}
                                title={isFavouriteGif(r.url)
                                    ? "Remove from favourites"
                                    : "Add to favourites"}
                                class="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 transition-opacity hover:bg-black/80 {isFavouriteGif(
                                    r.url,
                                )
                                    ? 'text-discord-warning opacity-100'
                                    : 'text-white opacity-0 group-hover/gif:opacity-100'}"
                            >
                                <svg
                                    class="w-3.5 h-3.5"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                    />
                                </svg>
                            </button>
                        </div>
                    {/each}
                </div>
                {#if gifSearchState.loading}
                    <p class="text-center text-discord-textMuted text-xs py-3">
                        Loading…
                    </p>
                {/if}
                {#if gifSearchState.error}
                    <button
                        onclick={() => loadMore()}
                        class="w-full text-center text-discord-textMuted text-xs py-3 hover:text-discord-textPrimary transition-colors"
                    >
                        {gifSearchState.error}
                    </button>
                {/if}
            {/if}
        {/if}
    </div>

    {#if enabled && tab !== "favourites"}
        <div
            class="px-3 py-1.5 flex-shrink-0 border-t border-discord-divider text-[10px] text-discord-textMuted text-right"
        >
            Powered by KLIPY
        </div>
    {/if}
</div>

<style>
    .search-input:focus {
        outline: none;
        border-color: rgb(var(--discord-accent-rgb) / 0.3);
    }
</style>

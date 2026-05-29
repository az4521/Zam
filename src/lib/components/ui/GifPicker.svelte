<script lang="ts">
    import {
        favouritesState,
        removeFavouriteGif,
        type FavouriteGif,
    } from "$lib/stores/favourites.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";

    interface Props {
        onSelect: (url: string) => void;
        onClose: () => void;
        onSwitchToEmoji?: () => void;
        onSwitchToSticker?: () => void;
    }

    let { onSelect, onClose, onSwitchToEmoji, onSwitchToSticker }: Props =
        $props();

    let search = $state("");
    let searchEl: HTMLInputElement | undefined = $state();
    let selectedIndex = $state(-1);

    const COLS = 4;

    $effect(() => {
        if (!interfaceState.isTouchscreen) searchEl?.focus();
    });

    const gifs = $derived(favouritesState.gifs);

    const visibleGifs = $derived(
        search
            ? gifs.filter((g) =>
                  g.url.toLowerCase().includes(search.toLowerCase()),
              )
            : gifs,
    );

    $effect(() => {
        search;
        selectedIndex = -1;
    });

    function pick(gif: FavouriteGif) {
        onSelect(gif.url);
        onClose();
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            onClose();
            return;
        }
        // Ctrl+E/S/G picker switching is handled globally in +page.svelte.
    }

    function onSearchKeydown(e: KeyboardEvent) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (selectedIndex === -1) {
                if (visibleGifs.length > 0) selectedIndex = 0;
            } else
                selectedIndex = Math.min(
                    selectedIndex + COLS,
                    visibleGifs.length - 1,
                );
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (selectedIndex < COLS) selectedIndex = -1;
            else selectedIndex -= COLS;
        } else if (e.key === "ArrowRight" && selectedIndex >= 0) {
            e.preventDefault();
            if (selectedIndex + 1 < visibleGifs.length) selectedIndex++;
        } else if (e.key === "ArrowLeft" && selectedIndex >= 0) {
            e.preventDefault();
            if (selectedIndex > 0) selectedIndex--;
        } else if (e.key === "Enter" && selectedIndex >= 0) {
            e.preventDefault();
            const gif = visibleGifs[selectedIndex];
            if (gif) pick(gif);
        }
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
    <!-- Search -->
    <div class="px-3 pt-3 pb-2 flex-shrink-0">
        <input
            bind:this={searchEl}
            type="text"
            bind:value={search}
            placeholder="Search favourites…"
            onkeydown={onSearchKeydown}
            class="search-input w-full bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded-lg px-3 py-1.5 outline-none border border-transparent"
        />
    </div>

    <!-- Grid -->
    <div class="flex-1 overflow-y-auto min-h-0 px-2 pb-2">
        {#if visibleGifs.length === 0}
            <p class="text-center text-discord-textMuted text-sm py-8 px-4">
                {gifs.length === 0
                    ? "No favourite GIFs yet. Star a GIF in chat to save it here."
                    : "No results"}
            </p>
        {:else}
            <div class="grid grid-cols-4 gap-1 mt-1">
                {#each visibleGifs as gif, i (gif.url)}
                    <div class="relative group/gif">
                        <button
                            data-item-index={i}
                            onclick={() => pick(gif)}
                            title={gif.url}
                            class="w-full aspect-square rounded hover:bg-discord-messageHover transition-colors flex items-center justify-center overflow-hidden"
                            class:ring-2={selectedIndex === i}
                            class:ring-discord-accent={selectedIndex === i}
                        >
                            <img
                                src={gif.previewUrl}
                                alt=""
                                class="w-full h-full object-cover rounded"
                                loading="lazy"
                            />
                        </button>
                        <!-- Remove button -->
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
    </div>
</div>

<style>
    .search-input:focus {
        outline: none;
        border-color: rgb(var(--discord-accent-rgb) / 0.3);
    }
</style>

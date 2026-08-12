<script lang="ts">
    import {
        favouritesState,
        addFavouriteGif,
        removeFavouriteGif,
        isFavouriteGif,
        setFavouriteGifTags,
        type FavouriteGif,
    } from "$lib/stores/favourites.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import { settingsState } from "$lib/stores/settings.svelte";
    import { type GifKind, type GifResult } from "$lib/utils/klipy";
    import {
        gifSearchState,
        loadGifs,
        queueSearch,
        loadMore,
    } from "$lib/stores/gifSearch.svelte";
    import { untrack } from "svelte";
    import { Star } from "lucide-svelte";
    import { resizeHandle } from "$lib/actions/resizeHandle";
    import { COMPOSER_PICKER_SIZE } from "$lib/utils/pickerSize";
    import { safeAspectRatio } from "$lib/utils/mediaDimensions";
    import { overlayActionClass } from "$lib/utils/touchTargets";
    import { scrollBehavior } from "$lib/utils/motionPreference";
    import {
        nextActiveIndex,
        optionId,
        type NavKey,
    } from "$lib/utils/listboxNavigation";
    import { anchoredActiveIndex } from "$lib/utils/listboxAnchor";

    interface Props {
        onSelect: (url: string) => void;
        onClose: () => void;
        onSwitchToEmoji?: () => void;
        onSwitchToSticker?: () => void;
    }

    let { onSelect, onClose, onSwitchToEmoji, onSwitchToSticker }: Props =
        $props();

    type Tab = "gifs" | "favourites";

    // Land on the configured tab ("gifs" or "favourites").
    let tab = $state<Tab>(
        settingsState.gifDefaultTab === "favourites" ? "favourites" : "gifs",
    );

    let search = $state("");
    let searchEl: HTMLInputElement | undefined = $state();
    let gridEl: HTMLDivElement | undefined = $state();

    $effect(() => {
        if (!interfaceState.isTouchscreen) searchEl?.focus();
    });

    // Tab change → immediate KLIPY load. `search` is read untracked so
    // typing does NOT retrigger this effect; typing is debounced in
    // onSearchInput instead. This avoids a wasted request on switch.
    $effect(() => {
        const t = tab;
        if (t === "favourites") return;
        const kind: GifKind = "gifs";
        untrack(() => loadGifs(kind, search));
    });

    function onSearchInput(e: Event & { currentTarget: HTMLInputElement }) {
        search = e.currentTarget.value;
        // Typing is text editing, not list navigation: drop the cursor so the
        // caret gets Left/Right/Home/End back, and so the KLIPY results that
        // land 350ms later cannot inherit a selection made against the ones
        // they replace.
        moveCursor(-1);
        if (tab !== "favourites") {
            const kind: GifKind = "gifs";
            queueSearch(kind, search);
        }
    }

    // Favourites tab: local text filter over the URL and the user's tags.
    const favourites = $derived(favouritesState.gifs);
    const visibleFavourites = $derived.by(() => {
        const q = search.trim().toLowerCase();
        if (!q) return favourites;
        return favourites.filter(
            (g) =>
                g.url.toLowerCase().includes(q) ||
                (g.tags ?? []).some((t) => t.includes(q)),
        );
    });

    // --- Keyboard navigation over the results ------------------------------
    //
    // Modelled as a ONE-DIMENSIONAL listbox, not a grid. The results are a CSS
    // masonry (`columns-[165px]`), so how many tiles sit in a row -- and which
    // tile is "above" which -- exists only inside the layout engine and cannot
    // be read back off the DOM. A listbox is allowed to be one-dimensional, so
    // all four arrows step by one in DOM order and Home/End jump to the ends.
    // Claiming role="grid" would promise assistive tech a row/column geometry
    // that nothing here can deliver, and AT users would have to navigate around
    // the lie.
    const listId = $props.id();

    // Where the arrow keys have put the virtual cursor, plus the URL of the GIF
    // it was put on. Both, because the index alone is not enough here: this
    // list is replaced wholesale by a debounced KLIPY response or a tab flip,
    // and reordered by removing a favourite -- each of which can leave the
    // index in range but pointing at a different GIF, with the same option id,
    // so aria-activedescendant never moves and nothing is re-announced. Enter
    // would then send a GIF the user never saw.
    let selectedIndex = $state(-1);
    let selectedUrl = $state<string | null>(null);

    // The flat list of options actually on screen -- whichever tab is
    // rendering. The URL is both an option's identity and the thing Enter
    // sends, so the keys are the whole payload and there is nothing else to
    // carry alongside them.
    const activeKeys: string[] = $derived(
        tab === "favourites"
            ? visibleFavourites.map((g) => g.url)
            : gifSearchState.items.map((r) => r.url),
    );

    // Re-clamped (anchoredActiveIndex defers to clampActiveIndex) AND anchored,
    // so a cursor is only ever active while it still sits on the GIF it was put
    // on. Everything downstream -- the ARIA, the ring, Enter -- reads this
    // rather than `selectedIndex`.
    const activeIndex = $derived(
        anchoredActiveIndex(selectedIndex, selectedUrl, activeKeys),
    );

    // True exactly when the box below is really rendering options. The three
    // claims that a popup exists -- the container's `listbox` role and the
    // combobox's aria-expanded / aria-controls -- all read this one value, so
    // they cannot drift apart. With no options the container is a plain div,
    // which is what lets its empty states ("No favourite GIFs yet…", "No
    // results", the KLIPY error retry button) be read as ordinary page content
    // instead of non-`option` children of a listbox that browse mode routinely
    // drops.
    const hasOptions = $derived(activeKeys.length > 0);

    // `undefined`, never `""`: an empty aria-activedescendant is a dangling
    // reference rather than an absent one. Every option is rendered eagerly
    // (this picker has no lazily revealed sections), so an in-range index
    // always names an element that is really in the document.
    const activeOptionId = $derived(
        activeIndex >= 0 ? optionId(listId, activeIndex) : undefined,
    );

    function moveCursor(next: number) {
        selectedIndex = next;
        selectedUrl = next >= 0 ? (activeKeys[next] ?? null) : null;
    }

    // Tag editor: the URL of the favourite currently being edited, plus its
    // draft (comma-separated) tag text.
    let editingUrl = $state<string | null>(null);
    let tagDraft = $state("");
    let tagInputEl: HTMLInputElement | undefined = $state();

    function startEditing(gif: FavouriteGif) {
        editingUrl = gif.url;
        tagDraft = (gif.tags ?? []).join(", ");
        // Focus once the input has been rendered.
        queueMicrotask(() => tagInputEl?.select());
    }

    async function saveTags() {
        const url = editingUrl;
        if (!url) return;
        editingUrl = null;
        await setFavouriteGifTags(url, tagDraft.split(","));
    }

    function onTagKeydown(e: KeyboardEvent) {
        // The picker closes on Escape; while editing, Escape only cancels.
        e.stopPropagation();
        if (e.key === "Enter") saveTags();
        else if (e.key === "Escape") editingUrl = null;
    }

    // These sit on top of the full-bleed "send this GIF" button, so anything
    // missed by a fat finger sends the GIF instead of acting on it. Sized to
    // the WCAG target-size minimums rather than by eye.
    const favBtnClass = $derived(
        overlayActionClass(interfaceState.isTouchscreen),
    );

    function pickUrl(url: string) {
        onSelect(url);
        onClose();
    }

    // KLIPY's width/height are typed as numbers but arrive as third-party JSON,
    // so they are untrusted style input exactly like a remote event's info.w/h.
    // No dimensions → no style at all (the grid falls back to natural size).
    function gifAspectRatioStyle(w: unknown, h: unknown): string | undefined {
        const ratio = safeAspectRatio(w, h, "");
        return ratio ? `aspect-ratio: ${ratio}` : undefined;
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

    // Keep the grid filled. If the results don't overflow the scroll area (few
    // results, or the panel was resized bigger / wider = more columns = shorter
    // content), there's nothing to scroll, so scroll-based pagination never
    // fires and you're stuck on page 1. Load more until it overflows or KLIPY
    // is exhausted. A ResizeObserver bumps `fillTick` so resizing re-triggers.
    let fillTick = $state(0);
    $effect(() => {
        if (!gridEl) return;
        const ro = new ResizeObserver(() => fillTick++);
        ro.observe(gridEl);
        return () => ro.disconnect();
    });
    $effect(() => {
        // re-run when results change or the panel resizes
        void gifSearchState.items.length;
        void gifSearchState.loading;
        void fillTick;
        if (tab === "favourites" || !gridEl) return;
        untrack(() => {
            if (
                !gifSearchState.loading &&
                !gifSearchState.exhausted &&
                gridEl!.scrollHeight <= gridEl!.clientHeight + 8
            ) {
                loadMore();
            }
        });
    });

    // Keep the arrow-selected GIF in view. `block: "nearest"` leaves an option
    // that is already fully visible alone, so arrowing around inside the
    // viewport never touches scrollTop; `behavior` comes from scrollBehavior()
    // because scrollIntoView animates from JS and never consults the
    // reduced-motion media query the stylesheet relies on.
    $effect(() => {
        const index = activeIndex;
        if (index < 0) return;
        document
            .getElementById(optionId(listId, index))
            ?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
    });

    function onSearchKeydown(e: KeyboardEvent) {
        // On a one-dimensional list ArrowLeft/ArrowRight are the same single
        // step as ArrowUp/ArrowDown, so they map onto the two keys the shared
        // navigation helper knows about.
        let key: NavKey | null = null;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") key = "ArrowDown";
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") key = "ArrowUp";
        else if (e.key === "Home" || e.key === "End") key = e.key;

        if (key) {
            // ArrowUp/ArrowDown enter the list from the text field the way any
            // combobox does. The rest only steer it once the user is already
            // navigating: this is an editable field, so with nothing selected
            // Left/Right/Home/End still belong to the text caret and hijacking
            // them would strand it mid-word.
            const entersList = e.key === "ArrowDown" || e.key === "ArrowUp";
            if (!entersList && activeIndex < 0) return;
            if (!activeKeys.length) return;
            e.preventDefault();
            // `loop: false`. The KLIPY tab is an infinitely paginated list, so
            // its end is provisional: stopping there scrolls the last tile to
            // the bottom edge, which is precisely what onGridScroll reads as
            // "load the next page", so walking off the end grows the list
            // instead of ending it. Wrapping -- the ARIA authoring practices
            // default, and this helper's -- would teleport the cursor back to
            // tile 1 and leave those pages unreachable by keyboard. It also
            // keeps all three composer pickers stopping at the same place.
            moveCursor(
                nextActiveIndex(activeIndex, activeKeys.length, key, {
                    loop: false,
                }),
            );
            return;
        }

        // `activeIndex`, never `selectedIndex`: the anchor check is the thing
        // that stops Enter firing on a GIF the list moved out from under the
        // cursor. Escape is deliberately not handled here -- it bubbles to the
        // panel's own onkeydown, which closes the picker.
        if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault();
            pickUrl(activeKeys[activeIndex]);
        }
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") onClose();
    }

    function selectTab(next: Tab) {
        // The two tabs are different lists, so a cursor carried across would
        // land on an unrelated GIF that happens to share its index.
        moveCursor(-1);
        // The $effect above performs the immediate load when `tab` changes.
        tab = next;
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="{interfaceState.isTouchscreen
        ? 'w-full rounded-t-xl'
        : 'rounded-xl'} relative bg-discord-backgroundSecondary border border-discord-divider shadow-2xl flex flex-col"
    style={interfaceState.isTouchscreen ? "height: 50dvh;" : undefined}
    onkeydown={onKeydown}
>
    {#if !interfaceState.isTouchscreen}
        <!-- Resize grip (top-left; panel grows up-and-left from the composer) -->
        <button
            type="button"
            use:resizeHandle={COMPOSER_PICKER_SIZE}
            class="absolute top-0 left-0 z-20 w-4 h-4 cursor-nwse-resize text-discord-textMuted opacity-40 hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-discord-accent"
            title="Drag or use arrow keys to resize"
            aria-label="Resize picker"
        >
            <svg viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
                <path d="M2 2h5v1.5H3.5V7H2V2z" />
            </svg>
        </button>
    {/if}
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

    <!-- Inner content tabs -->
    <div class="flex gap-1 px-2 pt-2 flex-shrink-0">
        {#each [["gifs", "GIFs"], ["favourites", "Favourites"]] as [value, label] (value)}
            <button
                onclick={() => selectTab(value as Tab)}
                class="flex-1 py-1.5 text-xs font-semibold rounded transition-colors {tab ===
                value
                    ? 'bg-discord-backgroundTertiary text-discord-textPrimary'
                    : 'text-discord-textMuted hover:text-discord-textPrimary'}"
            >
                <span class="flex items-center justify-center gap-1">
                    {#if value === "favourites"}<Star size={14} />{/if}
                    {label}
                </span>
            </button>
        {/each}
    </div>

    <!-- Search -->
    <div class="px-3 pt-3 pb-2 flex-shrink-0">
        <input
            bind:this={searchEl}
            type="text"
            value={search}
            oninput={onSearchInput}
            onkeydown={onSearchKeydown}
            placeholder={tab === "favourites"
                ? "Search favourites…"
                : "Search KLIPY…"}
            role="combobox"
            aria-label={tab === "favourites"
                ? "Search favourites"
                : "Search GIFs"}
            aria-expanded={hasOptions}
            aria-controls={hasOptions ? `${listId}-listbox` : undefined}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            class="search-input w-full bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded-lg px-3 py-1.5 outline-none border border-transparent"
        />
    </div>

    <!-- Grid. This scroll box is the element the search field points into. It
         is rendered on both tabs and in every empty state, and it carries
         role="listbox" only while it is really holding options, with the
         combobox's aria-controls gated on the very same value -- so that
         reference either resolves to a real listbox or is absent. It can
         neither dangle nor name a div that has stopped being a listbox.

         Being honest about what is inside it: the masonry is a role="group"
         naming where the results came from, and group is a legal listbox
         child, so the tiles themselves stay one navigable list. But they are
         not the only descendants. The "Loading…" status line and the
         load-more retry button sit next to the group, and each tile wraps its
         role="option" button together with the star / edit-tags /
         remove-favourite buttons and (while editing) a tag <input>. None of
         those are `option` or `group`. They are ordinary focusable controls --
         no tabindex="-1" -- so they stay Tab-reachable, but a screen reader
         browsing the listbox may not announce them at all.

         The structurally correct shape for that is a one-column role="grid":
         each tile a `row`, the GIF and its overlay controls `gridcell`s. It is
         deferred because it means adding wrapper elements inside a CSS
         `columns-[165px]` masonry -- a layout change that has to be seen in a
         real browser, not reasoned about.

         What this link added to that estimate: every element that would need
         a role already exists. The masonry div becomes `rowgroup`, each tile
         wrapper becomes `row`, the option button becomes `gridcell`. Counting
         the rest of the cells, because the first pass under-counted them: a
         favourites tile has THREE more direct children, not one -- the overlay
         div of edit/remove buttons, the tags caption, and (while editing) the
         tag-editor div wrapping the <input> -- so a favourites row is a
         four-cell row, at most three of them present at once, since the
         caption and the editor are mutually exclusive. A KLIPY tile is a
         two-cell row, and its star button is a direct child with no wrapper,
         so the button itself would carry the `gridcell`. Unhoused either way:
         the "Loading…" status line and the load-more retry button flagged
         above. They sit beside the group, not in it, and `grid` owns only
         `row` / `rowgroup`, so the move leaves them exactly as homeless as the
         listbox does -- they would have to become rows of their own or move
         outside the container. So the layout risk is still smaller than
         "adding wrapper elements" suggests -- no new DOM, just more roles than
         first counted -- but `role` changes cannot be verified by a test
         here, and whether a browse-mode reader really does better with a
         one-column grid than with the current listbox needs a real screen
         reader, not a browser. -->
    <div
        bind:this={gridEl}
        onscroll={onGridScroll}
        id="{listId}-listbox"
        role={hasOptions ? "listbox" : undefined}
        aria-label={hasOptions ? "GIF results" : undefined}
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
                <div
                    class="columns-[165px] gap-x-1 mt-1"
                    role="group"
                    aria-label="Favourites"
                >
                    {#each visibleFavourites as gif, idx (gif.url)}
                        <div class="relative group/gif mb-1 break-inside-avoid">
                            <!-- The <img> is alt="", so without a label this
                                 button announces as bare "button". The user's
                                 own tags are the only human-readable thing a
                                 favourite carries; the URL in `title` would be
                                 a terrible name to hear read out. -->
                            <button
                                onclick={() => pickUrl(gif.url)}
                                title={(gif.tags ?? []).length
                                    ? `${gif.url}\n${(gif.tags ?? []).join(", ")}`
                                    : gif.url}
                                id={optionId(listId, idx)}
                                role="option"
                                aria-selected={activeIndex === idx}
                                aria-label={(gif.tags ?? []).length
                                    ? `GIF tagged ${(gif.tags ?? []).join(", ")}`
                                    : `Favourite GIF ${idx + 1}`}
                                tabindex="-1"
                                class:ring-2={activeIndex === idx}
                                class:ring-inset={activeIndex === idx}
                                class:ring-discord-accent={activeIndex === idx}
                                class="block w-full rounded overflow-hidden hover:opacity-80 transition-opacity"
                            >
                                <img
                                    src={gif.previewUrl}
                                    alt=""
                                    class="w-full h-auto block rounded bg-discord-backgroundTertiary"
                                    loading="lazy"
                                    decoding="async"
                                />
                            </button>
                            <!-- Touchscreens have no hover, so the controls stay
                                 visible there instead of revealing on hover.
                                 focus-within matters too: these stay focusable
                                 while transparent, so without it a keyboard
                                 user focuses a control they cannot see.
                                 Arrow navigation moves aria-activedescendant,
                                 NOT DOM focus (options are tabindex="-1"), so
                                 neither variant fires for it -- the selected
                                 tile has to reveal its controls explicitly or a
                                 keyboard user gets a selection ring and nothing
                                 to act on. -->
                            <div
                                class="absolute top-1 right-1 flex gap-1 transition-opacity {interfaceState.isTouchscreen ||
                                activeIndex === idx
                                    ? 'opacity-100'
                                    : 'opacity-0 group-hover/gif:opacity-100 group-focus-within/gif:opacity-100'}"
                            >
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        startEditing(gif);
                                    }}
                                    title="Edit tags"
                                    class="text-white {favBtnClass}"
                                >
                                    <svg
                                        class="w-3.5 h-3.5"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                                        />
                                    </svg>
                                </button>
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        removeFavouriteGif(gif.url);
                                    }}
                                    title="Remove from favourites"
                                    class="text-discord-warning {favBtnClass}"
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
                            {#if (gif.tags ?? []).length && editingUrl !== gif.url}
                                <div
                                    class="absolute bottom-0 inset-x-0 px-1 py-0.5 rounded-b bg-black/60 text-[10px] text-white truncate pointer-events-none"
                                >
                                    {(gif.tags ?? []).join(", ")}
                                </div>
                            {/if}
                            {#if editingUrl === gif.url}
                                <div
                                    class="absolute inset-0 rounded bg-black/80 flex flex-col justify-center gap-1 p-1.5"
                                >
                                    <!-- svelte-ignore a11y_autofocus -->
                                    <input
                                        bind:this={tagInputEl}
                                        bind:value={tagDraft}
                                        onkeydown={onTagKeydown}
                                        onblur={saveTags}
                                        autofocus
                                        placeholder="cat, funny"
                                        class="search-input w-full bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-xs rounded px-1.5 py-1 outline-none border border-transparent"
                                    />
                                    <p
                                        class="text-[10px] text-discord-textMuted"
                                    >
                                        Comma-separated · Enter to save
                                    </p>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        {:else}
            <!-- KLIPY GIFs -->
            {#if gifSearchState.error && gifSearchState.items.length === 0}
                <button
                    onclick={() => loadGifs("gifs", search)}
                    class="w-full text-center text-discord-textMuted text-sm py-8 px-4 hover:text-discord-textPrimary transition-colors"
                >
                    {gifSearchState.error}
                </button>
            {:else if gifSearchState.items.length === 0 && !gifSearchState.loading}
                <p class="text-center text-discord-textMuted text-sm py-8 px-4">
                    No results
                </p>
            {:else}
                <div
                    class="columns-[165px] gap-x-1 mt-1"
                    role="group"
                    aria-label={search.trim() ? "Search results" : "Trending"}
                >
                    {#each gifSearchState.items as r, idx (r.id)}
                        <div class="relative group/gif mb-1 break-inside-avoid">
                            <!-- The <img> is alt="", so without a label this
                                 button announces as bare "button". A normalized
                                 KLIPY result carries no title, slug or tags to
                                 name it with (see utils/klipy.ts), so the
                                 position is the only honest name available --
                                 which still beats nameless. -->
                            <button
                                onclick={() => pickUrl(r.url)}
                                id={optionId(listId, idx)}
                                role="option"
                                aria-selected={activeIndex === idx}
                                aria-label="GIF result {idx + 1}"
                                tabindex="-1"
                                class:ring-2={activeIndex === idx}
                                class:ring-inset={activeIndex === idx}
                                class:ring-discord-accent={activeIndex === idx}
                                class="block w-full rounded overflow-hidden hover:opacity-80 transition-opacity"
                            >
                                <img
                                    src={r.previewUrl}
                                    alt=""
                                    class="w-full h-auto block rounded bg-discord-backgroundTertiary"
                                    loading="lazy"
                                    decoding="async"
                                    style={gifAspectRatioStyle(
                                        r.width,
                                        r.height,
                                    )}
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
                                aria-label="Favourite"
                                aria-pressed={isFavouriteGif(r.url)}
                                class="absolute top-1 right-1 transition-opacity {favBtnClass} {isFavouriteGif(
                                    r.url,
                                )
                                    ? 'text-discord-warning opacity-100'
                                    : activeIndex === idx
                                      ? 'text-white opacity-100'
                                      : 'text-white opacity-0 group-hover/gif:opacity-100 group-focus-within/gif:opacity-100'}"
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

    {#if tab !== "favourites"}
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

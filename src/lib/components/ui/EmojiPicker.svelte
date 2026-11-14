<script lang="ts">
    import { t } from "$lib/i18n";
    import { untrack } from "svelte";
    import type { Room } from "matrix-js-sdk";
    import { EMOJI_CATEGORIES, ALL_EMOJIS } from "$lib/data/emojis";
    import {
        getCustomEmojiPacks,
        getOwnAvatarUrl,
        type CustomEmoji,
    } from "$lib/matrix/client";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import { resizeHandle } from "$lib/actions/resizeHandle";
    import { COMPOSER_PICKER_SIZE } from "$lib/utils/pickerSize";
    import { scrollBehavior } from "$lib/utils/motionPreference";
    import { nextActiveIndex, optionId } from "$lib/utils/listboxNavigation";
    import { anchoredActiveIndex } from "$lib/utils/listboxAnchor";
    import { emojiOptionKeys } from "$lib/utils/pickerOptionKeys";
    import {
        buildGridLayout,
        visibleRowRange,
        rowAt,
        scrollTopToReveal,
        indexRange,
        type GridSection,
    } from "$lib/utils/virtualGrid";
    import { pickerThumbUrl } from "$lib/matrix/media";

    import { renderEmoji } from "$lib/utils/twemoji";
    import { emojiSpriteStyle } from "$lib/utils/emojiSprites";

    interface Props {
        room?: Room | null;
        onSelect: (emoji: string) => void;
        onSelectCustom?: (emoji: CustomEmoji) => void;
        onClose: () => void;
        onSwitchToSticker?: () => void;
        onSwitchToGif?: () => void;
        /** Hide custom emoji packs, for fields that can only hold unicode. */
        unicodeOnly?: boolean;
    }

    let {
        room = null,
        onSelect,
        onSelectCustom,
        onClose,
        onSwitchToSticker,
        onSwitchToGif,
        unicodeOnly = false,
    }: Props = $props();

    let search = $state("");
    let activeTab = $state("");
    let scrollEl: HTMLDivElement | undefined = $state();
    let tabBarEl: HTMLDivElement | undefined = $state();
    let searchEl: HTMLInputElement | undefined = $state();
    let selectedIndex = $state(-1);
    // The identity of the option `selectedIndex` was placed on. See
    // `moveCursor` below and utils/listboxAnchor.ts for why an index alone is
    // not enough.
    let selectedKey = $state<string | null>(null);

    // Unique per mounted instance: the composer can hold a popover picker while
    // the touch drawer holds another, and duplicate DOM ids would silently aim
    // one instance's aria-controls / aria-activedescendant at the other's
    // elements.
    const listId = $props.id();

    // Responsive columns: fit as many ~40px cells as the width allows, so
    // widening the panel shows MORE emojis instead of spreading 6 apart.
    const CELL = 40;
    let cols = $state(6);
    // The grid is virtualized (only rows near the viewport exist in the DOM):
    // the standard set alone is ~1900 emoji, plus every custom pack, and
    // building a button for each made the picker take seconds to open. Every
    // row's position is computed from these measurements instead.
    let gridWidth = $state(0);
    let viewHeight = $state(0);
    let scrollTop = $state(0);
    $effect(() => {
        if (!scrollEl) return;
        const measure = () => {
            const w = scrollEl!.clientWidth - 16; // minus the px-2 padding
            if (w > 0) {
                gridWidth = w;
                cols = Math.max(6, Math.floor(w / CELL));
            }
            viewHeight = scrollEl!.clientHeight;
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(scrollEl);
        return () => ro.disconnect();
    });

    $effect(() => {
        if (!interfaceState.isTouchscreen) searchEl?.focus();
    });

    // Scroll the tab bar so the active tab button is visible
    $effect(() => {
        if (!activeTab || !tabBarEl) return;
        const btn = tabBarEl.querySelector<HTMLElement>(
            `[data-tabid="${activeTab}"]`,
        );
        btn?.scrollIntoView({
            behavior: scrollBehavior(),
            inline: "nearest",
            block: "nearest",
        });
    });

    // Grid emoji come from the Twemoji sprite sheets (utils/emojiSprites.ts):
    // an <img> per SVG builds an SVG document per emoji on the main thread,
    // which stalled scrolling on every new row. Anything not in a sheet (the
    // text symbols, or an emoji newer than the sheets) keeps the old path.
    function emojiHtml(emoji: string): string {
        return renderEmoji(emoji, "picker-twemoji");
    }

    // Pack data lives in room state that mutates in place, so this must depend
    // on the tick, not on roomsState.spaces being reassigned (it no longer is
    // when the space set has not actually changed).
    const customPacks = $derived.by(() => {
        void roomsState.roomsTick;
        if (unicodeOnly) return [];
        return getCustomEmojiPacks(
            roomsState.activeSpaceId,
            roomsState.spaces,
            room,
        );
    });
    const ownAvatarUrl = $derived(getOwnAvatarUrl());

    const tabs = $derived([
        ...customPacks.map((p) => ({
            id: p.id,
            label: p.name,
            avatarUrl: p.avatarUrl,
            isCustom: true as const,
        })),
        ...EMOJI_CATEGORIES.map((c) => ({
            id: c.id,
            label: c.label,
            avatarUrl: undefined,
            isCustom: false as const,
        })),
    ]);

    $effect(() => {
        if (!activeTab && tabs.length > 0) activeTab = tabs[0].id;
    });

    // Search results: custom first, then standard
    const searchCustom = $derived(
        search
            ? customPacks.flatMap((p) =>
                  p.emojis
                      .filter((e) =>
                          e.shortcode
                              .toLowerCase()
                              .includes(search.toLowerCase()),
                      )
                      .map((e) => ({ ...e, packId: p.id })),
              )
            : [],
    );
    const searchStandard = $derived(
        search
            ? ALL_EMOJIS.filter((e) => e.name.includes(search.toLowerCase()))
            : [],
    );

    // Reset selection, and go back to the top, when search changes
    $effect(() => {
        search; // track
        moveCursor(-1);
        untrack(() => {
            if (scrollEl) scrollEl.scrollTop = 0;
            scrollTop = 0;
        });
    });

    // Flat ordered list of all items for keyboard navigation
    type FlatItem =
        | {
              kind: "custom";
              sectionId: string;
              data: CustomEmoji & { packId: string };
          }
        | {
              kind: "standard";
              sectionId: string;
              data: { emoji: string; name: string };
          };

    const flatItems = $derived.by((): FlatItem[] => {
        if (search) {
            return [
                ...searchCustom.map((e): FlatItem => ({
                    kind: "custom",
                    sectionId: "search-custom",
                    data: e,
                })),
                ...searchStandard.map((e): FlatItem => ({
                    kind: "standard",
                    sectionId: "search-standard",
                    data: e,
                })),
            ];
        }
        const items: FlatItem[] = [];
        for (const pack of customPacks) {
            for (const e of pack.emojis) {
                items.push({
                    kind: "custom",
                    sectionId: pack.id,
                    data: { ...e, packId: pack.id },
                });
            }
        }
        for (const cat of EMOJI_CATEGORIES) {
            for (const e of cat.emojis) {
                items.push({ kind: "standard", sectionId: cat.id, data: e });
            }
        }
        return items;
    });

    // Identity of every option, in render order — the anchor's key list.
    const activeKeys = $derived(emojiOptionKeys(flatItems));

    // Start index of each section in the flat list
    const sectionOffsets = $derived.by((): Map<string, number> => {
        const offsets = new Map<string, number>();
        if (search) {
            offsets.set("search-custom", 0);
            offsets.set("search-standard", searchCustom.length);
            return offsets;
        }
        let offset = 0;
        for (const pack of customPacks) {
            offsets.set(pack.id, offset);
            offset += pack.emojis.length;
        }
        for (const cat of EMOJI_CATEGORIES) {
            offsets.set(cat.id, offset);
            offset += cat.emojis.length;
        }
        return offsets;
    });

    // The cursor, but only while the option it was placed on is still sitting
    // at that index.
    //
    // A clamp alone rescues a cursor that has fallen OUT of range, which is all
    // a list needs if it only ever shrinks. It cannot see the same list
    // rewritten *within* range: if a sync INSERTS an emoji at the front of a
    // pack, index 40 is still a real option, so aria-activedescendant goes on
    // naming `…-option-40` -- an unchanged reference, so nothing is
    // re-announced -- while aria-selected has quietly slid to a different
    // emoji and Enter inserts it. Anchoring on the emoji's identity makes that
    // read as "nothing active" instead, which bounces the cursor to the top of
    // the list on the next arrow key and never inserts a stranger.
    //
    // This only holds while EVERY write to `selectedIndex` goes through
    // `moveCursor`, which records the identity next to the index. A missed
    // assignment site leaves a stale key beside a fresh index, which reads as
    // "nothing active": Left, Right, Home, End and Enter all no-op, and the
    // next ArrowDown re-enters at 0, yanking whoever was mid-navigation back
    // to the top of the list. The next `moveCursor` re-keys, so it does heal
    // -- but it heals silently, and no other test in the suite can see it,
    // which is why `pickerCursorFunnel.test.ts` reads this file and fails if
    // a second assignment appears.
    const activeIndex = $derived(
        anchoredActiveIndex(selectedIndex, selectedKey, activeKeys),
    );

    // True exactly when the box below is really rendering options. The three
    // claims that a popup exists -- the container's `listbox` role and the
    // combobox's aria-expanded / aria-controls -- all read this one value, so
    // they cannot drift apart. With no options the container is a plain div,
    // which is what lets its "No results" text be read as ordinary page
    // content instead of a non-`option` child of a listbox that browse mode
    // routinely drops.
    const hasOptions = $derived(flatItems.length > 0);

    // ---- Virtualized layout (utils/virtualGrid.ts) ---------------------------
    // Rows are either a section header or one line of `cols` cells, each at a
    // computed `top`, so the scroll box is sized to the whole list while only
    // the rows in view are rendered.
    const GAP = 4; // gap-1, between cells and between rows
    const HEADER_H = 28; // text-xs line (16) + pt-2 (8) + pb-1 (4)
    const SECTION_GAP = 8; // mb-2 under each section's grid
    const OVERSCAN = 400; // px rendered above and below the viewport
    // Custom emoji are drawn ~32px; 96 covers a 3x screen without fetching
    // the original (often a 512px animation) for every cell.
    const EMOJI_THUMB_PX = 96;

    const cellSize = $derived(
        gridWidth > 0 ? (gridWidth - GAP * (cols - 1)) / cols : 0,
    );

    const sections = $derived.by((): GridSection[] => {
        const at = (id: string) => sectionOffsets.get(id) ?? 0;
        if (search) {
            const out: GridSection[] = [];
            if (searchCustom.length > 0)
                out.push({
                    id: "search-custom",
                    label: t("emojiPicker.custom"),
                    start: at("search-custom"),
                    count: searchCustom.length,
                });
            if (searchStandard.length > 0)
                out.push({
                    id: "search-standard",
                    label:
                        searchCustom.length > 0
                            ? t("emojiPicker.standard")
                            : null,
                    start: at("search-standard"),
                    count: searchStandard.length,
                });
            return out;
        }
        return [
            ...customPacks.map((p) => ({
                id: p.id,
                label: p.id === "user" ? t("emojiPicker.myEmojis2") : p.name,
                start: at(p.id),
                count: p.emojis.length,
            })),
            ...EMOJI_CATEGORIES.map((c) => ({
                id: c.id,
                label: c.name,
                start: at(c.id),
                count: c.emojis.length,
            })),
        ];
    });

    const layout = $derived(
        buildGridLayout(sections, flatItems.length, {
            cols,
            cellSize,
            gap: GAP,
            headerHeight: HEADER_H,
            sectionGap: SECTION_GAP,
        }),
    );
    const visibleRange = $derived(
        visibleRowRange(layout.rows, scrollTop, viewHeight, OVERSCAN),
    );
    const visibleRows = $derived(
        layout.rows.slice(visibleRange.from, visibleRange.to),
    );

    // aria-activedescendant may only name an element that is really in the DOM.
    // A selected emoji outside the rendered window has no option element, so
    // report nothing active until the effect below scrolls it into view -- one
    // scroll event later -- rather than emit a dangling reference.
    const activeOptionId = $derived.by(() => {
        if (activeIndex < 0 || activeIndex >= layout.itemRow.length)
            return undefined;
        const r = layout.itemRow[activeIndex];
        if (r < visibleRange.from || r >= visibleRange.to) return undefined;
        return optionId(listId, activeIndex);
    });

    // Scroll the selected item into view and follow it with the active tab.
    // Only `activeIndex` is tracked: reading `activeTab` or the scroll position
    // here would re-run this on every scroll and yank the view back.
    $effect(() => {
        const idx = activeIndex;
        untrack(() => {
            if (idx < 0 || idx >= flatItems.length) return;
            const item = flatItems[idx];
            if (!search && activeTab !== item.sectionId)
                activeTab = item.sectionId;
            const row = layout.rows[layout.itemRow[idx]];
            if (!scrollEl || !row) return;
            const next = scrollTopToReveal(
                row,
                scrollEl.scrollTop,
                scrollEl.clientHeight,
            );
            if (next !== null) scrollEl.scrollTop = next;
        });
    });

    function scrollToSection(id: string) {
        activeTab = id;
        if (!scrollEl) return;
        const row = layout.rows.find((r) => r.sectionId === id);
        if (row)
            scrollEl.scrollTo({
                top: row.top,
                behavior: scrollBehavior(),
            });
    }

    function onScroll() {
        if (!scrollEl) return;
        scrollTop = scrollEl.scrollTop;
        if (search) return;
        const row = layout.rows[rowAt(layout.rows, scrollTop + 8)];
        if (row && row.sectionId !== activeTab) activeTab = row.sectionId;
    }

    function pick(emoji: string) {
        onSelect(emoji);
        onClose();
    }

    function pickCustom(emoji: CustomEmoji) {
        if (onSelectCustom) {
            onSelectCustom(emoji);
        } else {
            onSelect(`:${emoji.shortcode}:`);
        }
        onClose();
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            onClose();
            return;
        }
        // Ctrl+E/S/G picker switching is handled globally in +page.svelte.
    }

    /** The ONLY place `selectedIndex` may be assigned. See `activeIndex`.
     *
     *  Reads the `activeKeys` `$derived`, so this belongs in event handlers: a
     *  `next >= 0` call from inside a tracked `$effect` would silently give
     *  that effect `activeKeys -> flatItems -> search` as dependencies. (The
     *  search-reset effect gets away with it only because `-1` short-circuits
     *  the read.) Wrap in `untrack` if an effect ever genuinely needs this. */
    function moveCursor(next: number) {
        selectedIndex = next;
        selectedKey = next >= 0 ? (activeKeys[next] ?? null) : null;
    }

    function onSearchKeydown(e: KeyboardEvent) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (activeIndex === -1) {
                if (flatItems.length > 0) moveCursor(0);
            } else {
                moveCursor(Math.min(activeIndex + cols, flatItems.length - 1));
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (activeIndex < cols) {
                moveCursor(-1);
            } else {
                moveCursor(activeIndex - cols);
            }
        } else if (e.key === "ArrowRight" && activeIndex >= 0) {
            // A step of one along the flat list is exactly a listbox's
            // ArrowDown, so the horizontal keys borrow that arithmetic --
            // with `loop: false`, because walking off the last emoji has
            // always stopped there rather than wrapping to the first.
            e.preventDefault();
            moveCursor(
                nextActiveIndex(activeIndex, flatItems.length, "ArrowDown", {
                    loop: false,
                }),
            );
        } else if (e.key === "ArrowLeft" && activeIndex >= 0) {
            e.preventDefault();
            moveCursor(
                nextActiveIndex(activeIndex, flatItems.length, "ArrowUp", {
                    loop: false,
                }),
            );
        } else if ((e.key === "Home" || e.key === "End") && activeIndex >= 0) {
            // Only once the user is actually navigating the grid: this is an
            // editable text field, so with nothing selected Home/End still
            // belong to the caret and hijacking them would strand it mid-word.
            e.preventDefault();
            moveCursor(nextActiveIndex(activeIndex, flatItems.length, e.key));
        } else if (e.key === "Enter" && activeIndex >= 0) {
            // `activeIndex`, like every branch above: a raw `selectedIndex`
            // left past the end by a shrinking pack indexes `undefined` here
            // and throws on `.kind`, aborting the handler mid-keystroke.
            e.preventDefault();
            const item = flatItems[activeIndex];
            if (item.kind === "custom") pickCustom(item.data);
            else pick(item.data.emoji);
        }
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="{interfaceState.isTouchscreen
        ? 'w-full rounded-t-xl'
        : 'rounded-xl'} relative bg-discord-backgroundSecondary border border-discord-divider shadow-2xl flex flex-col"
    style={interfaceState.isTouchscreen
        ? "height: 50vh; height: 50dvh;"
        : undefined}
    onkeydown={onKeydown}
    onwheel={(e) => e.stopPropagation()}
>
    {#if !interfaceState.isTouchscreen}
        <button
            type="button"
            use:resizeHandle={COMPOSER_PICKER_SIZE}
            class="absolute top-0 start-0 z-20 w-4 h-4 cursor-nwse-resize mirror:cursor-nesw-resize text-discord-textMuted opacity-40 hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-discord-accent"
            title={t("common.dragOrUseArrowKeysTo")}
            aria-label={t("common.resizePicker")}
        >
            <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                class="w-4 h-4 mirror:-scale-x-100"
            >
                <path d="M2 2h5v1.5H3.5V7H2V2z" />
            </svg>
        </button>
    {/if}
    {#if interfaceState.isTouchscreen && (onSwitchToSticker || onSwitchToGif)}
        <div class="flex border-b border-discord-divider flex-shrink-0">
            <button
                class="flex-1 py-2 text-sm font-semibold text-discord-textPrimary border-b-2 border-discord-accent"
                >{t("common.emoji")}</button
            >
            {#if onSwitchToSticker}<button
                    onclick={onSwitchToSticker}
                    class="flex-1 py-2 text-sm font-medium text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                    >{t("common.stickers")}</button
                >{/if}
            {#if onSwitchToGif}<button
                    onclick={onSwitchToGif}
                    class="flex-1 py-2 text-sm font-medium text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                    >{t("common.gifs")}</button
                >{/if}
        </div>
    {/if}
    <!-- Search -->
    <div class="px-3 pt-3 pb-2 flex-shrink-0">
        <input
            bind:this={searchEl}
            type="text"
            bind:value={search}
            placeholder={t("emojiPicker.searchEmoji")}
            onkeydown={onSearchKeydown}
            role="combobox"
            aria-label={t("emojiPicker.searchEmoji2")}
            aria-expanded={hasOptions}
            aria-controls={hasOptions ? `${listId}-listbox` : undefined}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            class="search-input w-full bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded-lg px-3 py-1.5 outline-none border border-transparent"
        />
    </div>

    <!-- Category tabs — always shown, scroll to section on click -->
    {#if !search}
        <div
            bind:this={tabBarEl}
            class="flex items-center gap-0.5 px-2 pb-1 flex-shrink-0 overflow-x-auto"
            style="scrollbar-width: none;"
        >
            {#each tabs as tab (tab.id)}
                <button
                    data-tabid={tab.id}
                    onclick={() => scrollToSection(tab.id)}
                    title={tab.isCustom ? tab.label : tab.label}
                    class="flex-shrink-0 p-1.5 rounded transition-colors"
                    class:bg-discord-messageHover={activeTab === tab.id}
                    class:opacity-40={activeTab !== tab.id}
                >
                    {#if tab.isCustom}
                        {#if tab.id === "user" && ownAvatarUrl}
                            <img
                                src={ownAvatarUrl}
                                alt={t("emojiPicker.myEmojis")}
                                class="w-5 h-5 rounded-full object-cover"
                            />
                        {:else if tab.id === "user"}
                            <svg
                                class="w-5 h-5 text-discord-textPrimary"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"
                                />
                            </svg>
                        {:else if tab.avatarUrl}
                            <img
                                src={tab.avatarUrl}
                                alt={tab.label}
                                class="w-5 h-5 rounded-full object-cover"
                            />
                        {:else}
                            <span
                                class="w-5 h-5 rounded-full bg-discord-accent flex items-center justify-center text-white text-xs font-bold"
                            >
                                {tab.label[0]?.toUpperCase() ?? "?"}
                            </span>
                        {/if}
                    {:else}
                        {@html renderEmoji(tab.label, "picker-twemoji-tab")}
                    {/if}
                </button>
            {/each}
        </div>
    {/if}

    <!-- Scrollable area. One listbox owns every section: `role="group"` is a
         legal child of a listbox, so the four grids stay one navigable list
         instead of four listboxes the virtual cursor could not cross.
         The role is dropped when there is nothing to navigate -- a search that
         matches no emoji -- so the "No results" line inside is a paragraph in
         the page rather than a stray non-`option` child of a listbox, and the
         combobox stops advertising an expanded popup it cannot fill. The `id`
         stays unconditional; only aria-controls is dropped alongside. -->
    <div
        bind:this={scrollEl}
        onscroll={onScroll}
        id="{listId}-listbox"
        role={hasOptions ? "listbox" : undefined}
        aria-label={hasOptions ? t("common.emoji") : undefined}
        class="relative flex-1 overflow-y-auto min-h-0 px-2 pb-2"
    >
        {#if search && !hasOptions}
            <p class="text-center text-discord-textMuted text-sm py-8">
                {t("common.noResults")}
            </p>
        {/if}
        <div class="relative" style="height: {layout.total}px">
            {#each visibleRows as row (row.key)}
                {#if row.kind === "header"}
                    <p
                        data-section={row.sectionId}
                        class="absolute inset-x-0 overflow-hidden whitespace-nowrap text-ellipsis text-xs font-semibold text-discord-textMuted uppercase tracking-wide px-1 pt-2 pb-1"
                        style="top: {row.top}px; height: {HEADER_H}px"
                    >
                        {row.label}
                    </p>
                {:else}
                    <div
                        class="absolute inset-x-0 grid gap-1"
                        style="top: {row.top}px; height: {cellSize}px; grid-template-columns: repeat({cols}, minmax(0, 1fr))"
                    >
                        {#each indexRange(row.start, row.end) as idx (idx)}
                            {@const item = flatItems[idx]}
                            {@const label =
                                item.kind === "custom"
                                    ? item.data.shortcode
                                    : item.data.name}
                            <button
                                data-item-index={idx}
                                onclick={() =>
                                    item.kind === "custom"
                                        ? pickCustom(item.data)
                                        : pick(item.data.emoji)}
                                title={label}
                                id={optionId(listId, idx)}
                                role="option"
                                aria-selected={activeIndex === idx}
                                aria-label={label}
                                aria-setsize={flatItems.length}
                                aria-posinset={idx + 1}
                                tabindex="-1"
                                class="p-1 rounded hover:bg-discord-messageHover transition-colors flex items-center justify-center"
                                style="height: {cellSize}px"
                                class:ring-2={activeIndex === idx}
                                class:ring-discord-accent={activeIndex === idx}
                            >
                                {#if item.kind === "custom"}
                                    <img
                                        src={pickerThumbUrl(
                                            item.data.mxcUrl,
                                            EMOJI_THUMB_PX,
                                        ) ?? item.data.url}
                                        alt={item.data.shortcode}
                                        class="w-full h-full object-contain"
                                        decoding="async"
                                    />
                                {:else}
                                    {@const sprite = emojiSpriteStyle(
                                        item.data.emoji,
                                    )}
                                    {#if sprite}
                                        <span
                                            class="picker-sprite"
                                            style={sprite}
                                            aria-hidden="true"
                                        ></span>
                                    {:else}
                                        {@html emojiHtml(item.data.emoji)}
                                    {/if}
                                {/if}
                            </button>
                        {/each}
                    </div>
                {/if}
            {/each}
        </div>
    </div>
</div>

<style>
    /* Both emoji kinds derive their size from the grid cell (the button is
       `aspect-square p-1`), so a Twemoji <img> and a custom emote <img> are
       always identical — and neither depends on the root font-size, which
       Android's font-scaling setting changes. */
    .picker-sprite {
        width: 100%;
        height: 100%;
        display: block;
        background-repeat: no-repeat;
    }
    :global(.picker-twemoji) {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
    }
    .search-input:focus {
        outline: none;
        border-color: rgb(var(--discord-accent-rgb) / 0.3);
    }
    :global(.picker-twemoji-tab) {
        width: 1.25rem; /* = Tailwind w-5, matching the custom pack tabs */
        height: 1.25rem;
        display: block;
        object-fit: contain;
    }
</style>

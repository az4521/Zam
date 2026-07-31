<script lang="ts">
    import { tick } from "svelte";
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
    import {
        clampActiveIndex,
        nextActiveIndex,
        optionId,
    } from "$lib/utils/listboxNavigation";

    import { renderEmoji } from "$lib/utils/twemoji";

    interface Props {
        room?: Room | null;
        onSelect: (emoji: string) => void;
        onSelectCustom?: (emoji: CustomEmoji) => void;
        onClose: () => void;
        onSwitchToSticker?: () => void;
        onSwitchToGif?: () => void;
    }

    let {
        room = null,
        onSelect,
        onSelectCustom,
        onClose,
        onSwitchToSticker,
        onSwitchToGif,
    }: Props = $props();

    let search = $state("");
    let activeTab = $state("");
    let scrollEl: HTMLDivElement | undefined = $state();
    let tabBarEl: HTMLDivElement | undefined = $state();
    let searchEl: HTMLInputElement | undefined = $state();
    let selectedIndex = $state(-1);

    // Unique per mounted instance: the composer can hold a popover picker while
    // the touch drawer holds another, and duplicate DOM ids would silently aim
    // one instance's aria-controls / aria-activedescendant at the other's
    // elements.
    const listId = $props.id();

    // Responsive columns: fit as many ~40px cells as the width allows, so
    // widening the panel shows MORE emojis instead of spreading 6 apart.
    const CELL = 40;
    let cols = $state(6);
    $effect(() => {
        if (!scrollEl) return;
        const measure = () => {
            const w = scrollEl!.clientWidth - 16; // minus the px-2 padding
            if (w > 0) cols = Math.max(6, Math.floor(w / CELL));
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(scrollEl);
        return () => ro.disconnect();
    });

    // Sections whose emoji have been revealed by the IntersectionObserver
    let revealedSections = $state(new Set<string>());

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

    function emojiHtml(emoji: string): string {
        return renderEmoji(emoji, "picker-twemoji");
    }

    const customPacks = $derived(
        getCustomEmojiPacks(roomsState.activeSpaceId, roomsState.spaces, room),
    );
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

    // Reset selection when search changes
    $effect(() => {
        search; // track
        selectedIndex = -1;
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
                ...searchCustom.map(
                    (e): FlatItem => ({
                        kind: "custom",
                        sectionId: "search-custom",
                        data: e,
                    }),
                ),
                ...searchStandard.map(
                    (e): FlatItem => ({
                        kind: "standard",
                        sectionId: "search-standard",
                        data: e,
                    }),
                ),
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

    // `selectedIndex` forced back into range, and nothing more than that. A
    // custom pack that SHRINKS under an open picker (a sync can rewrite the
    // room's emote state) leaves the index pointing past the end of the list,
    // and an out-of-range cursor must read as "nothing active" rather than
    // steer the keys or the ARIA.
    //
    // What a clamp cannot see is the same list rewritten *within* range: if
    // that sync instead INSERTS an emoji at the front of a pack, index 40 is
    // still a real option, so aria-activedescendant goes on naming
    // `…-option-40` -- an unchanged reference, so nothing is re-announced --
    // while aria-selected has quietly slid to a different emoji. The cure is
    // the key anchor in `anchoredActiveIndex` (utils/listboxAnchor.ts), which
    // GifPicker already uses. It is not applied here yet because it needs
    // every write to the cursor in this file funnelled through a single setter
    // that records the emoji's identity next to its index, and one missed
    // assignment site would leave the cursor permanently and silently dead --
    // worse, and far more likely, than the residual bug it removes ("Enter
    // inserts the neighbouring emoji after a rare mid-session pack rewrite",
    // which is visible on screen and deletable). There is no component-test
    // harness for this picker to catch a missed site.
    const activeIndex = $derived(
        clampActiveIndex(selectedIndex, flatItems.length),
    );

    // True exactly when the box below is really rendering options. The three
    // claims that a popup exists -- the container's `listbox` role and the
    // combobox's aria-expanded / aria-controls -- all read this one value, so
    // they cannot drift apart. With no options the container is a plain div,
    // which is what lets its "No results" text be read as ordinary page
    // content instead of a non-`option` child of a listbox that browse mode
    // routinely drops.
    const hasOptions = $derived(flatItems.length > 0);

    // aria-activedescendant may only name an element that is really in the DOM.
    // A selected emoji whose section the lazy reveal has not rendered yet has
    // no option element, so report nothing active until the effect below
    // reveals it -- one flush later -- rather than emit a dangling reference.
    // Search results are never lazy, so in search mode the id always resolves.
    const activeOptionId = $derived.by(() => {
        if (activeIndex < 0) return undefined;
        if (!search && !revealedSections.has(flatItems[activeIndex].sectionId))
            return undefined;
        return optionId(listId, activeIndex);
    });

    // Auto-reveal lazy section and scroll selected item into view
    $effect(() => {
        const idx = selectedIndex;
        if (idx < 0 || idx >= flatItems.length) return;
        const item = flatItems[idx];

        // Reveal lazy section if needed
        if (
            !revealedSections.has(item.sectionId) &&
            item.sectionId !== "search-custom" &&
            item.sectionId !== "search-standard"
        ) {
            revealedSections = new Set([...revealedSections, item.sectionId]);
        }

        // Update active tab when navigating
        if (!search && activeTab !== item.sectionId) activeTab = item.sectionId;

        tick().then(() => {
            const btn = scrollEl?.querySelector<HTMLElement>(
                `[data-item-index="${idx}"]`,
            );
            btn?.scrollIntoView({ block: "nearest" });
        });
    });

    function scrollToSection(id: string) {
        activeTab = id;
        if (!scrollEl) return;
        const el = scrollEl.querySelector<HTMLElement>(
            `[data-section="${id}"]`,
        );
        if (el)
            scrollEl.scrollTo({
                top: el.offsetTop - 4,
                behavior: scrollBehavior(),
            });
    }

    function onScroll() {
        if (!scrollEl || search) return;
        const top = scrollEl.scrollTop;
        let current = "";
        for (const header of scrollEl.querySelectorAll<HTMLElement>(
            "[data-section]",
        )) {
            if (header.offsetTop <= top + 8) current = header.dataset.section!;
            else break;
        }
        if (current && current !== activeTab) activeTab = current;
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

    function onSearchKeydown(e: KeyboardEvent) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (selectedIndex === -1) {
                if (flatItems.length > 0) selectedIndex = 0;
            } else {
                selectedIndex = Math.min(
                    selectedIndex + cols,
                    flatItems.length - 1,
                );
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (selectedIndex < cols) {
                selectedIndex = -1;
            } else {
                selectedIndex -= cols;
            }
        } else if (e.key === "ArrowRight" && activeIndex >= 0) {
            // A step of one along the flat list is exactly a listbox's
            // ArrowDown, so the horizontal keys borrow that arithmetic --
            // with `loop: false`, because walking off the last emoji has
            // always stopped there rather than wrapping to the first.
            e.preventDefault();
            selectedIndex = nextActiveIndex(
                activeIndex,
                flatItems.length,
                "ArrowDown",
                { loop: false },
            );
        } else if (e.key === "ArrowLeft" && activeIndex >= 0) {
            e.preventDefault();
            selectedIndex = nextActiveIndex(
                activeIndex,
                flatItems.length,
                "ArrowUp",
                { loop: false },
            );
        } else if ((e.key === "Home" || e.key === "End") && activeIndex >= 0) {
            // Only once the user is actually navigating the grid: this is an
            // editable text field, so with nothing selected Home/End still
            // belong to the caret and hijacking them would strand it mid-word.
            e.preventDefault();
            selectedIndex = nextActiveIndex(
                activeIndex,
                flatItems.length,
                e.key,
            );
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

    // Svelte action: observe a section container and reveal it when near the viewport.
    // Elements clipped by overflow:hidden are not considered intersecting, so this
    // correctly defers rendering of sections scrolled out of the picker's scroll area.
    function lazySection(node: HTMLElement) {
        const id = node.dataset.lazyId!;
        if (revealedSections.has(id)) return {};
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    revealedSections = new Set([...revealedSections, id]);
                    observer.disconnect();
                }
            },
            { rootMargin: "300px 0px" },
        );
        observer.observe(node);
        return {
            destroy() {
                observer.disconnect();
            },
        };
    }

    // Estimated placeholder heights to keep scroll length stable before reveal.
    // Standard grid: 8 cols, ~30px/row + 2px gap. Custom grid: 6 cols, ~40px/row + 4px gap.
    function stdPlaceholderHeight(count: number) {
        return Math.ceil(count / cols) * 44;
    }
    function customPlaceholderHeight(count: number) {
        return Math.ceil(count / cols) * 44;
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="{interfaceState.isTouchscreen
        ? 'w-full rounded-t-xl'
        : 'rounded-xl'} relative bg-discord-backgroundSecondary border border-discord-divider shadow-2xl flex flex-col"
    style={interfaceState.isTouchscreen ? "height: 50dvh;" : undefined}
    onkeydown={onKeydown}
    onwheel={(e) => e.stopPropagation()}
>
    {#if !interfaceState.isTouchscreen}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            use:resizeHandle={COMPOSER_PICKER_SIZE}
            class="absolute top-0 left-0 z-20 w-4 h-4 cursor-nwse-resize text-discord-textMuted opacity-40 hover:opacity-100 transition-opacity"
            title="Drag to resize"
        >
            <svg viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
                <path d="M2 2h5v1.5H3.5V7H2V2z" />
            </svg>
        </div>
    {/if}
    {#if interfaceState.isTouchscreen && (onSwitchToSticker || onSwitchToGif)}
        <div class="flex border-b border-discord-divider flex-shrink-0">
            <button
                class="flex-1 py-2 text-sm font-semibold text-discord-textPrimary border-b-2 border-discord-accent"
                >Emoji</button
            >
            {#if onSwitchToSticker}<button
                    onclick={onSwitchToSticker}
                    class="flex-1 py-2 text-sm font-medium text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                    >Stickers</button
                >{/if}
            {#if onSwitchToGif}<button
                    onclick={onSwitchToGif}
                    class="flex-1 py-2 text-sm font-medium text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                    >GIFs</button
                >{/if}
        </div>
    {/if}
    <!-- Search -->
    <div class="px-3 pt-3 pb-2 flex-shrink-0">
        <input
            bind:this={searchEl}
            type="text"
            bind:value={search}
            placeholder="Search emoji…"
            onkeydown={onSearchKeydown}
            role="combobox"
            aria-label="Search emoji"
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
                                alt="My emojis"
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
        aria-label={hasOptions ? "Emoji" : undefined}
        class="relative flex-1 overflow-y-auto min-h-0 px-2 pb-2"
    >
        {#if search}
            {#if searchCustom.length === 0 && searchStandard.length === 0}
                <p class="text-center text-discord-textMuted text-sm py-8">
                    No results
                </p>
            {/if}
            {#if searchCustom.length > 0}
                <p
                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide px-1 py-1"
                >
                    Custom
                </p>
                <div
                    class="grid gap-1 mb-2"
                    role="group"
                    aria-label="Custom"
                    style="grid-template-columns: repeat({cols}, minmax(0, 1fr))"
                >
                    {#each searchCustom as e, li (e.packId + ":" + e.shortcode)}
                        {@const globalIdx =
                            (sectionOffsets.get("search-custom") ?? 0) + li}
                        <button
                            data-item-index={globalIdx}
                            onclick={() => pickCustom(e)}
                            title={e.shortcode}
                            id={optionId(listId, globalIdx)}
                            role="option"
                            aria-selected={selectedIndex === globalIdx}
                            aria-label={e.shortcode}
                            tabindex="-1"
                            class="p-1 rounded hover:bg-discord-messageHover transition-colors aspect-square flex items-center justify-center"
                            class:ring-2={selectedIndex === globalIdx}
                            class:ring-discord-accent={selectedIndex ===
                                globalIdx}
                        >
                            <img
                                src={e.url}
                                alt={e.shortcode}
                                class="w-full h-full object-contain"
                                loading="lazy"
                            />
                        </button>
                    {/each}
                </div>
            {/if}
            {#if searchStandard.length > 0}
                {#if searchCustom.length > 0}
                    <p
                        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide px-1 py-1"
                    >
                        Standard
                    </p>
                {/if}
                <div
                    class="grid gap-1"
                    role="group"
                    aria-label="Standard"
                    style="grid-template-columns: repeat({cols}, minmax(0, 1fr))"
                >
                    {#each searchStandard as e, li (e.name)}
                        {@const globalIdx =
                            (sectionOffsets.get("search-standard") ?? 0) + li}
                        <button
                            data-item-index={globalIdx}
                            onclick={() => pick(e.emoji)}
                            title={e.name}
                            id={optionId(listId, globalIdx)}
                            role="option"
                            aria-selected={selectedIndex === globalIdx}
                            aria-label={e.name}
                            tabindex="-1"
                            class="p-1 rounded hover:bg-discord-messageHover transition-colors aspect-square flex items-center justify-center"
                            class:ring-2={selectedIndex === globalIdx}
                            class:ring-discord-accent={selectedIndex ===
                                globalIdx}
                        >
                            {@html emojiHtml(e.emoji)}
                        </button>
                    {/each}
                </div>
            {/if}
        {:else}
            <!-- All custom packs -->
            {#each customPacks as pack (pack.id)}
                <div data-lazy-id={pack.id} use:lazySection>
                    <p
                        data-section={pack.id}
                        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide px-1 pt-2 pb-1"
                    >
                        {pack.id === "user" ? "My Emojis" : pack.name}
                    </p>
                    {#if revealedSections.has(pack.id)}
                        <div
                            class="grid gap-1 mb-2"
                            role="group"
                            aria-label={pack.id === "user"
                                ? "My Emojis"
                                : pack.name}
                            style="grid-template-columns: repeat({cols}, minmax(0, 1fr))"
                        >
                            {#each pack.emojis as e, li (pack.id + ":" + e.shortcode)}
                                {@const globalIdx =
                                    (sectionOffsets.get(pack.id) ?? 0) + li}
                                <button
                                    data-item-index={globalIdx}
                                    onclick={() => pickCustom(e)}
                                    title={e.shortcode}
                                    id={optionId(listId, globalIdx)}
                                    role="option"
                                    aria-selected={selectedIndex === globalIdx}
                                    aria-label={e.shortcode}
                                    tabindex="-1"
                                    class="p-1 rounded hover:bg-discord-messageHover transition-colors aspect-square flex items-center justify-center"
                                    class:ring-2={selectedIndex === globalIdx}
                                    class:ring-discord-accent={selectedIndex ===
                                        globalIdx}
                                >
                                    <img
                                        src={e.url}
                                        alt={e.shortcode}
                                        class="w-full h-full object-contain"
                                        loading="lazy"
                                    />
                                </button>
                            {/each}
                        </div>
                    {:else}
                        <div
                            class="mb-2"
                            style="height: {customPlaceholderHeight(
                                pack.emojis.length,
                            )}px"
                        ></div>
                    {/if}
                </div>
            {/each}

            <!-- All standard categories -->
            {#each EMOJI_CATEGORIES as cat (cat.id)}
                <div data-lazy-id={cat.id} use:lazySection>
                    <p
                        data-section={cat.id}
                        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide px-1 pt-2 pb-1"
                    >
                        {cat.name}
                    </p>
                    {#if revealedSections.has(cat.id)}
                        <div
                            class="grid gap-1 mb-2"
                            role="group"
                            aria-label={cat.name}
                            style="grid-template-columns: repeat({cols}, minmax(0, 1fr))"
                        >
                            {#each cat.emojis as e, li (e.name)}
                                {@const globalIdx =
                                    (sectionOffsets.get(cat.id) ?? 0) + li}
                                <button
                                    data-item-index={globalIdx}
                                    onclick={() => pick(e.emoji)}
                                    title={e.name}
                                    id={optionId(listId, globalIdx)}
                                    role="option"
                                    aria-selected={selectedIndex === globalIdx}
                                    aria-label={e.name}
                                    tabindex="-1"
                                    class="p-1 rounded hover:bg-discord-messageHover transition-colors aspect-square flex items-center justify-center"
                                    class:ring-2={selectedIndex === globalIdx}
                                    class:ring-discord-accent={selectedIndex ===
                                        globalIdx}
                                >
                                    {@html emojiHtml(e.emoji)}
                                </button>
                            {/each}
                        </div>
                    {:else}
                        <div
                            class="mb-2"
                            style="height: {stdPlaceholderHeight(
                                cat.emojis.length,
                            )}px"
                        ></div>
                    {/if}
                </div>
            {/each}
        {/if}
    </div>
</div>

<style>
    /* Both emoji kinds derive their size from the grid cell (the button is
       `aspect-square p-1`), so a Twemoji <img> and a custom emote <img> are
       always identical — and neither depends on the root font-size, which
       Android's font-scaling setting changes. */
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

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
            behavior: "smooth",
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
            scrollEl.scrollTo({ top: el.offsetTop - 4, behavior: "smooth" });
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
        } else if (e.key === "ArrowRight" && selectedIndex >= 0) {
            e.preventDefault();
            if (selectedIndex + 1 < flatItems.length) selectedIndex++;
        } else if (e.key === "ArrowLeft" && selectedIndex >= 0) {
            e.preventDefault();
            if (selectedIndex > 0) selectedIndex--;
        } else if (e.key === "Enter" && selectedIndex >= 0) {
            e.preventDefault();
            const item = flatItems[selectedIndex];
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

    <!-- Scrollable area -->
    <div
        bind:this={scrollEl}
        onscroll={onScroll}
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
                    style="grid-template-columns: repeat({cols}, minmax(0, 1fr))"
                >
                    {#each searchCustom as e, li (e.packId + ":" + e.shortcode)}
                        {@const globalIdx =
                            (sectionOffsets.get("search-custom") ?? 0) + li}
                        <button
                            data-item-index={globalIdx}
                            onclick={() => pickCustom(e)}
                            title={e.shortcode}
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
                    style="grid-template-columns: repeat({cols}, minmax(0, 1fr))"
                >
                    {#each searchStandard as e, li (e.name)}
                        {@const globalIdx =
                            (sectionOffsets.get("search-standard") ?? 0) + li}
                        <button
                            data-item-index={globalIdx}
                            onclick={() => pick(e.emoji)}
                            title={e.name}
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
                            style="grid-template-columns: repeat({cols}, minmax(0, 1fr))"
                        >
                            {#each pack.emojis as e, li (pack.id + ":" + e.shortcode)}
                                {@const globalIdx =
                                    (sectionOffsets.get(pack.id) ?? 0) + li}
                                <button
                                    data-item-index={globalIdx}
                                    onclick={() => pickCustom(e)}
                                    title={e.shortcode}
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
                            style="grid-template-columns: repeat({cols}, minmax(0, 1fr))"
                        >
                            {#each cat.emojis as e, li (e.name)}
                                {@const globalIdx =
                                    (sectionOffsets.get(cat.id) ?? 0) + li}
                                <button
                                    data-item-index={globalIdx}
                                    onclick={() => pick(e.emoji)}
                                    title={e.name}
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

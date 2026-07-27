<script lang="ts">
    import { tick } from "svelte";
    import type { Room } from "matrix-js-sdk";
    import {
        getCustomStickerPacks,
        getOwnAvatarUrl,
        type CustomSticker,
    } from "$lib/matrix/client";
    import { roomsState } from "$lib/stores/rooms.svelte";

    import { interfaceState } from "$lib/stores/interface.svelte";
    import { resizeHandle } from "$lib/actions/resizeHandle";
    import { COMPOSER_PICKER_SIZE } from "$lib/utils/pickerSize";

    interface Props {
        room?: Room | null;
        onSelect: (sticker: CustomSticker) => void;
        onClose: () => void;
        onSwitchToEmoji?: () => void;
        onSwitchToGif?: () => void;
    }

    let {
        room = null,
        onSelect,
        onClose,
        onSwitchToEmoji,
        onSwitchToGif,
    }: Props = $props();

    let search = $state("");
    let activeTab = $state("");
    let scrollEl: HTMLDivElement | undefined = $state();
    let tabBarEl: HTMLDivElement | undefined = $state();
    let searchEl: HTMLInputElement | undefined = $state();
    let selectedIndex = $state(-1);
    let revealedSections = $state(new Set<string>());

    // Responsive columns: fit as many ~68px cells as the width allows, so
    // widening the panel shows MORE stickers instead of spreading 4 apart.
    const CELL = 68;
    let cols = $state(4);
    $effect(() => {
        if (!scrollEl) return;
        const measure = () => {
            const w = scrollEl!.clientWidth - 16; // minus the px-2 padding
            if (w > 0) cols = Math.max(4, Math.floor(w / CELL));
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(scrollEl);
        return () => ro.disconnect();
    });

    $effect(() => {
        if (!interfaceState.isTouchscreen) searchEl?.focus();
    });

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

    const stickerPacks = $derived(
        getCustomStickerPacks(roomsState.activeSpaceId, room),
    );
    const ownAvatarUrl = $derived(getOwnAvatarUrl());

    $effect(() => {
        if (!activeTab && stickerPacks.length > 0)
            activeTab = stickerPacks[0].id;
    });

    const searchResults = $derived(
        search
            ? stickerPacks.flatMap((p) =>
                  p.stickers.filter((s) =>
                      s.shortcode.toLowerCase().includes(search.toLowerCase()),
                  ),
              )
            : [],
    );

    // Reset selection and revealed sections when search changes
    $effect(() => {
        search; // track
        selectedIndex = -1;
        revealedSections = new Set<string>();
    });

    // Flat ordered list for keyboard navigation
    const flatItems = $derived.by((): CustomSticker[] => {
        if (search) return searchResults;
        return stickerPacks.flatMap((p) => p.stickers);
    });

    // Start index of each section in the flat list (non-search mode only)
    const sectionOffsets = $derived.by((): Map<string, number> => {
        const offsets = new Map<string, number>();
        if (search) {
            offsets.set("search", 0);
            return offsets;
        }
        let offset = 0;
        for (const pack of stickerPacks) {
            offsets.set(pack.id, offset);
            offset += pack.stickers.length;
        }
        return offsets;
    });

    // Auto-reveal section, update active tab, scroll selected item into view
    $effect(() => {
        const idx = selectedIndex;
        if (idx < 0 || idx >= flatItems.length) return;

        if (!search) {
            for (const pack of stickerPacks) {
                const start = sectionOffsets.get(pack.id) ?? 0;
                if (idx >= start && idx < start + pack.stickers.length) {
                    if (activeTab !== pack.id) activeTab = pack.id;
                    if (!revealedSections.has(pack.id)) {
                        revealedSections = new Set([
                            ...revealedSections,
                            pack.id,
                        ]);
                    }
                    break;
                }
            }
        }

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

    function pick(sticker: CustomSticker) {
        onSelect(sticker);
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
            const sticker = flatItems[selectedIndex];
            if (sticker) pick(sticker);
        }
    }

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

    function placeholderHeight(count: number) {
        return Math.ceil(count / cols) * 68;
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="{interfaceState.isTouchscreen
        ? 'w-full rounded-t-xl'
        : 'rounded-xl'} relative bg-discord-backgroundSecondary border border-discord-divider shadow-2xl flex flex-col"
    style={interfaceState.isTouchscreen ? "max-height: 50dvh;" : undefined}
    onkeydown={onKeydown}
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
    {#if interfaceState.isTouchscreen}
        <div class="flex border-b border-discord-divider flex-shrink-0">
            {#if onSwitchToEmoji}<button
                    onclick={onSwitchToEmoji}
                    class="flex-1 py-2 text-sm font-medium text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                    >Emoji</button
                >{/if}
            <button
                class="flex-1 py-2 text-sm font-semibold text-discord-textPrimary border-b-2 border-discord-accent"
                >Stickers</button
            >
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
            placeholder="Search stickers…"
            onkeydown={onSearchKeydown}
            class="search-input w-full bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded-lg px-3 py-1.5 outline-none border border-transparent"
        />
    </div>

    {#if stickerPacks.length === 0}
        <p class="text-center text-discord-textMuted text-sm py-8 px-4">
            No sticker packs available
        </p>
    {:else}
        <!-- Tab bar -->
        {#if !search}
            <div
                bind:this={tabBarEl}
                class="flex items-center gap-0.5 px-2 pb-1 flex-shrink-0 overflow-x-auto"
                style="scrollbar-width: none;"
            >
                {#each stickerPacks as pack (pack.id)}
                    <button
                        data-tabid={pack.id}
                        onclick={() => scrollToSection(pack.id)}
                        title={pack.name}
                        class="flex-shrink-0 p-1.5 rounded transition-colors"
                        class:bg-discord-messageHover={activeTab === pack.id}
                        class:opacity-40={activeTab !== pack.id}
                    >
                        {#if pack.id === "user" && ownAvatarUrl}
                            <img
                                src={ownAvatarUrl}
                                alt="My stickers"
                                class="w-5 h-5 rounded-full object-contain"
                            />
                        {:else if pack.id === "user"}
                            <svg
                                class="w-5 h-5 text-discord-textPrimary"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"
                                />
                            </svg>
                        {:else if pack.avatarUrl}
                            <img
                                src={pack.avatarUrl}
                                alt={pack.name}
                                class="w-5 h-5 rounded-full object-contain"
                            />
                        {:else}
                            <span
                                class="w-5 h-5 rounded-full bg-discord-accent flex items-center justify-center text-white text-xs font-bold"
                            >
                                {pack.name[0]?.toUpperCase() ?? "?"}
                            </span>
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
                {#if searchResults.length === 0}
                    <p class="text-center text-discord-textMuted text-sm py-8">
                        No results
                    </p>
                {:else}
                    <div
                        class="grid gap-1 mt-1"
                        style="grid-template-columns: repeat({cols}, minmax(0, 1fr))"
                    >
                        {#each searchResults as s, li (s.shortcode)}
                            {@const globalIdx = li}
                            <button
                                data-item-index={globalIdx}
                                onclick={() => pick(s)}
                                title={s.shortcode}
                                class="p-1 rounded hover:bg-discord-messageHover transition-colors aspect-square flex items-center justify-center"
                                class:ring-2={selectedIndex === globalIdx}
                                class:ring-discord-accent={selectedIndex ===
                                    globalIdx}
                            >
                                <img
                                    src={s.url}
                                    alt={s.shortcode}
                                    class="w-14 h-14 object-contain"
                                    loading="lazy"
                                />
                            </button>
                        {/each}
                    </div>
                {/if}
            {:else}
                {#each stickerPacks as pack (pack.id)}
                    <div data-lazy-id={pack.id} use:lazySection>
                        <p
                            data-section={pack.id}
                            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide px-1 pt-2 pb-1"
                        >
                            {pack.id === "user" ? "My Stickers" : pack.name}
                        </p>
                        {#if revealedSections.has(pack.id)}
                            <div
                                class="grid gap-1 mb-2"
                                style="grid-template-columns: repeat({cols}, minmax(0, 1fr))"
                            >
                                {#each pack.stickers as s, li (s.shortcode)}
                                    {@const globalIdx =
                                        (sectionOffsets.get(pack.id) ?? 0) + li}
                                    <button
                                        data-item-index={globalIdx}
                                        onclick={() => pick(s)}
                                        title={s.shortcode}
                                        class="p-1 rounded hover:bg-discord-messageHover transition-colors aspect-square flex items-center justify-center"
                                        class:ring-2={selectedIndex ===
                                            globalIdx}
                                        class:ring-discord-accent={selectedIndex ===
                                            globalIdx}
                                    >
                                        <img
                                            src={s.url}
                                            alt={s.shortcode}
                                            class="w-14 h-14 object-contain"
                                            loading="lazy"
                                        />
                                    </button>
                                {/each}
                            </div>
                        {:else}
                            <div
                                class="mb-2"
                                style="height: {placeholderHeight(
                                    pack.stickers.length,
                                )}px"
                            ></div>
                        {/if}
                    </div>
                {/each}
            {/if}
        </div>
    {/if}
</div>

<style>
    .search-input:focus {
        outline: none;
        border-color: rgb(var(--discord-accent-rgb) / 0.3);
    }
</style>

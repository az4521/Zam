<script lang="ts">
    import EmojiPicker from "$lib/components/ui/EmojiPicker.svelte";
    import OptionSelector from "$lib/components/ui/OptionSelector.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        getRoomDisplayName,
        mxcToHttp,
        getRoom,
        getRooms,
        getSpaces,
        getRoomTags,
        getSpaceChildren,
        getRoomsInSpace,
        canAddRoomToSpace,
        reorderRoomTag,
        reorderSpaceChild,
        setRoomTagOrderRaw,
        setSpaceChildOrder,
    } from "$lib/matrix/client";
    import {
        groupRoomsByTag,
        TAG_FAVOURITE,
        TAG_LOWPRIORITY,
    } from "$lib/utils/roomOrdering";
    import { moveNeighbours, type MoveDirection } from "$lib/utils/reorderMove";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import {
        getDoubleTapReaction,
        setDoubleTapReaction,
        setKeepSidebarOpen,
        setOtherDoubleTapAction,
        setOwnDoubleTapAction,
        setSpaceDoubleTapReaction,
        setTheme,
        setTimeClock,
        setDateStyle,
        setCustomDatePattern,
        setAlwaysAbsolute,
        setGifDefaultTab,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import type { DoubleTapAction } from "$lib/utils/doubleTap";
    import { type GifTab } from "$lib/utils/klipy";
    import {
        previewDatePattern,
        type TimeClock,
        type DateStyle,
    } from "$lib/utils/timeFormat";

    const timeOptions: Array<{ value: TimeClock; label: string }> = [
        { value: "12h", label: "12-hour" },
        { value: "24h", label: "24-hour" },
    ];
    const dateOptions: Array<{ value: DateStyle; label: string }> = [
        { value: "default", label: "Default" },
        { value: "iso", label: "ISO" },
        { value: "dmy", label: "D/M/Y" },
        { value: "mdy", label: "M/D/Y" },
        { value: "custom", label: "Custom" },
    ];
    const gifTabOptions: Array<{ value: GifTab; label: string }> = [
        { value: "gifs", label: "GIFs" },
        { value: "favourites", label: "Favourites" },
    ];

    let customDraft = $state(settingsState.customDatePattern);
    const customPreview = $derived(previewDatePattern(customDraft));
    function onCustomInput(
        e: Event & { currentTarget: HTMLInputElement },
    ): void {
        customDraft = e.currentTarget.value;
        // Only persist patterns date-fns accepts, so a mid-typing invalid
        // pattern never blanks every timestamp in the app.
        if (previewDatePattern(customDraft) !== null)
            setCustomDatePattern(customDraft);
    }

    const ownActions: Array<{ value: DoubleTapAction; label: string }> = [
        { value: "none", label: "Nothing" },
        { value: "reaction", label: "Reaction" },
        { value: "reply", label: "Reply" },
        { value: "edit", label: "Edit" },
    ];
    const otherActions = ownActions.filter((option) => option.value !== "edit");
    let pickerTarget = $state<"default" | string | null>(null);
    const pickerRoom = $derived(
        pickerTarget && pickerTarget !== "default"
            ? (roomsState.spaces.find(
                  (space) => space.roomId === pickerTarget,
              ) ?? null)
            : null,
    );

    function chooseReaction(value: string) {
        if (!pickerTarget) return;
        if (pickerTarget === "default") setDoubleTapReaction(value);
        else setSpaceDoubleTapReaction(pickerTarget, value);
        pickerTarget = null;
    }

    type Room = ReturnType<typeof getRooms>[number];
    type OrderSection = "favourite" | "lowPriority" | "channels";
    interface OrderGroup {
        key: string; // stable #each key
        label: string;
        section: OrderSection;
        spaceId: string | null; // set only for channels
        rooms: Room[];
    }

    const orderGroups = $derived.by<OrderGroup[]>(() => {
        void roomsState.roomsTick;
        const groups: OrderGroup[] = [];
        const tagged = groupRoomsByTag(getRooms(), (r) =>
            getRoomTags(r.roomId),
        );
        if (tagged.favourites.length)
            groups.push({
                key: "favourite",
                label: "Favourites",
                section: "favourite",
                spaceId: null,
                rooms: tagged.favourites,
            });
        if (tagged.lowPriority.length)
            groups.push({
                key: "lowPriority",
                label: "Low Priority",
                section: "lowPriority",
                spaceId: null,
                rooms: tagged.lowPriority,
            });
        for (const space of getSpaces()) {
            if (!canAddRoomToSpace(space.roomId)) continue;
            // Only the "normal" (untagged) children belong under Channels —
            // favourited / low-priority children are shown in their own
            // Favourites / Low Priority group above, exactly as the sidebar
            // sections them. This keeps each room in a single group and makes a
            // Channels reorder mirror what the sidebar actually shows.
            const rooms = groupRoomsByTag(getRoomsInSpace(space.roomId), (r) =>
                getRoomTags(r.roomId),
            ).normal;
            if (!rooms.length) continue;
            groups.push({
                key: `space:${space.roomId}`,
                label: getRoomDisplayName(space),
                section: "channels",
                spaceId: space.roomId,
                rooms,
            });
        }
        return groups;
    });

    function rawOrderOf(group: OrderGroup, room: Room): string {
        if (group.section === "channels" && group.spaceId) {
            const space = getRoom(group.spaceId);
            if (!space) return "";
            const child = getSpaceChildren(space).find(
                (c) => c.roomId === room.roomId,
            );
            return child?.order ?? "";
        }
        const t = getRoomTags(room.roomId);
        const raw =
            t[group.section === "favourite" ? TAG_FAVOURITE : TAG_LOWPRIORITY]
                ?.order;
        return raw == null ? "" : String(raw);
    }

    async function moveRoom(
        group: OrderGroup,
        index: number,
        direction: MoveDirection,
    ): Promise<void> {
        const ids = group.rooms.map((r) => r.roomId);
        const neighbours = moveNeighbours(ids, index, direction);
        if (!neighbours) return;
        try {
            if (group.section === "channels" && group.spaceId) {
                await reorderSpaceChild(
                    group.spaceId,
                    ids[index],
                    neighbours.beforeId,
                    neighbours.afterId,
                );
            } else {
                await reorderRoomTag(
                    group.section === "favourite" ? "favourite" : "lowPriority",
                    ids[index],
                    neighbours.beforeId,
                    neighbours.afterId,
                );
            }
            roomsState.roomsTick++;
        } catch (err) {
            console.error("Failed to reorder room:", err);
        }
    }

    async function commitRawOrder(
        group: OrderGroup,
        room: Room,
        raw: string,
    ): Promise<void> {
        try {
            if (group.section === "channels" && group.spaceId) {
                const space = getRoom(group.spaceId);
                const via =
                    (space &&
                        getSpaceChildren(space).find(
                            (c) => c.roomId === room.roomId,
                        )?.via) ||
                    [];
                await setSpaceChildOrder(group.spaceId, room.roomId, raw, via);
            } else {
                await setRoomTagOrderRaw(
                    room.roomId,
                    group.section === "favourite"
                        ? TAG_FAVOURITE
                        : TAG_LOWPRIORITY,
                    raw,
                );
            }
            roomsState.roomsTick++;
        } catch (err) {
            console.error("Failed to set order value:", err);
        }
    }
</script>

<div class="space-y-6">
    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Theme
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <p class="flex-1 text-sm text-discord-textPrimary">Light theme</p>
            <ToggleSwitch
                checked={settingsState.theme === "light"}
                onChange={(light) => setTheme(light ? "light" : "dark")}
                label="Light theme"
                title={settingsState.theme === "light"
                    ? "Use dark theme"
                    : "Use light theme"}
            />
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Timestamps
        </p>

        <div
            class="flex flex-col gap-2 py-2 border-b border-discord-divider sm:flex-row sm:items-center sm:justify-between"
        >
            <span class="text-sm text-discord-textPrimary">Time format</span>
            <OptionSelector
                value={settingsState.timeClock}
                options={timeOptions}
                onChange={setTimeClock}
                ariaLabel="Time format"
            />
        </div>

        <div
            class="flex flex-col gap-2 py-2 border-b border-discord-divider sm:flex-row sm:items-center sm:justify-between"
        >
            <span class="text-sm text-discord-textPrimary">Date format</span>
            <OptionSelector
                value={settingsState.dateStyle}
                options={dateOptions}
                onChange={setDateStyle}
                ariaLabel="Date format"
            />
        </div>

        {#if settingsState.dateStyle === "custom"}
            <div class="py-3 border-b border-discord-divider">
                <label
                    class="text-sm text-discord-textPrimary"
                    for="custom-date-pattern">Custom date pattern</label
                >
                <input
                    id="custom-date-pattern"
                    type="text"
                    value={customDraft}
                    oninput={onCustomInput}
                    spellcheck="false"
                    autocomplete="off"
                    autocapitalize="off"
                    placeholder="yyyy-MM-dd"
                    class="mt-2 w-full px-2.5 py-1.5 rounded bg-discord-backgroundTertiary text-sm text-discord-textPrimary border {customPreview ===
                    null
                        ? 'border-discord-danger'
                        : 'border-discord-divider focus:border-discord-accent'} outline-none"
                />
                {#if customPreview !== null}
                    <p class="mt-1.5 text-xs text-discord-textMuted">
                        Preview: <span class="text-discord-textPrimary"
                            >{customPreview}</span
                        > · date-fns tokens, e.g. yyyy-MM-dd
                    </p>
                {:else}
                    <p class="mt-1.5 text-xs text-discord-danger">
                        Invalid format — use lowercase date-fns tokens like
                        yyyy-MM-dd.
                    </p>
                {/if}
            </div>
        {/if}

        <div class="flex items-center gap-3 py-2">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Always show absolute dates
                </p>
                <p class="text-xs text-discord-textMuted">
                    Replace “Today” and “Yesterday” with the full date
                    everywhere.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.alwaysAbsolute}
                onChange={setAlwaysAbsolute}
                label="Always show absolute dates"
            />
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            GIFs
        </p>
        <div
            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="flex-1 min-w-0">
                <span class="text-sm text-discord-textPrimary">Default tab</span
                >
                <p class="text-xs text-discord-textMuted">
                    Which tab the GIF picker opens on.
                </p>
            </div>
            <OptionSelector
                value={settingsState.gifDefaultTab}
                options={gifTabOptions}
                onChange={setGifDefaultTab}
                ariaLabel="Default GIF tab"
            />
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Behavior
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Keep room list open
                </p>
                <p class="text-xs text-discord-textMuted">
                    Don't auto-close the room list when switching between spaces
                    or Home. Opening a room or DM always closes it.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.keepSidebarOpen}
                onChange={setKeepSidebarOpen}
                label="Keep room list open"
            />
        </div>

        <div class="py-4 border-b border-discord-divider">
            <p class="text-sm font-medium text-discord-textPrimary mb-3">
                Double-tap messages
            </p>
            <div class="space-y-3">
                <div
                    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                    <span class="text-sm text-discord-textSecondary"
                        >Your messages</span
                    >
                    <OptionSelector
                        value={settingsState.ownDoubleTapAction}
                        options={ownActions}
                        onChange={setOwnDoubleTapAction}
                        ariaLabel="Double-tap your messages"
                    />
                </div>
                <div
                    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                    <span class="text-sm text-discord-textSecondary"
                        >Other messages</span
                    >
                    <OptionSelector
                        value={settingsState.otherDoubleTapAction}
                        options={otherActions}
                        onChange={setOtherDoubleTapAction}
                        ariaLabel="Double-tap other messages"
                    />
                </div>
            </div>
        </div>

        <div class="py-4">
            <p class="text-sm font-medium text-discord-textPrimary mb-3">
                Reaction emoji
            </p>
            <div
                class="flex items-center justify-between gap-3 pb-3 border-b border-discord-divider"
            >
                <span class="text-sm text-discord-textSecondary">Default</span>
                <button
                    type="button"
                    onclick={() => (pickerTarget = "default")}
                    class="w-10 h-10 flex items-center justify-center rounded border border-discord-divider bg-discord-backgroundTertiary hover:border-discord-accent transition-colors"
                    title="Choose default reaction"
                >
                    {#if settingsState.doubleTapReaction.startsWith("mxc://")}
                        <img
                            src={mxcToHttp(settingsState.doubleTapReaction)}
                            alt="Default reaction"
                            class="w-6 h-6 object-contain"
                        />
                    {:else}
                        <span class="text-xl"
                            >{settingsState.doubleTapReaction}</span
                        >
                    {/if}
                </button>
            </div>

            {#if roomsState.spaces.length > 0}
                <p
                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mt-4 mb-2"
                >
                    Space overrides
                </p>
                <div class="space-y-1">
                    {#each roomsState.spaces as space (space.roomId)}
                        {@const override =
                            settingsState.doubleTapReactionBySpace[
                                space.roomId
                            ]}
                        {@const reaction = getDoubleTapReaction(space.roomId)}
                        <div
                            class="flex items-center gap-2 py-2 border-b border-discord-divider last:border-b-0"
                        >
                            <span
                                class="min-w-0 flex-1 truncate text-sm text-discord-textPrimary"
                                >{getRoomDisplayName(space)}</span
                            >
                            {#if override}
                                <button
                                    type="button"
                                    onclick={() =>
                                        setSpaceDoubleTapReaction(
                                            space.roomId,
                                            null,
                                        )}
                                    class="px-2 py-1 text-xs text-discord-textMuted hover:text-discord-textPrimary"
                                >
                                    Use default
                                </button>
                            {/if}
                            <button
                                type="button"
                                onclick={() => (pickerTarget = space.roomId)}
                                class="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded border border-discord-divider bg-discord-backgroundTertiary hover:border-discord-accent transition-colors"
                                title="Choose reaction for {getRoomDisplayName(
                                    space,
                                )}"
                            >
                                {#if reaction.startsWith("mxc://")}
                                    <img
                                        src={mxcToHttp(reaction)}
                                        alt="Space reaction"
                                        class="w-6 h-6 object-contain"
                                    />
                                {:else}
                                    <span class="text-xl">{reaction}</span>
                                {/if}
                            </button>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Room order
        </p>
        <p class="text-xs text-discord-textMuted mb-3">
            Reorder rooms within a list. Foreign or custom order values are
            shown and editable verbatim.
        </p>

        {#if orderGroups.length === 0}
            <p class="text-sm text-discord-textMuted py-2">
                No reorderable rooms. Favourite or low-priority a room, or join
                a space you can manage, to arrange its order here.
            </p>
        {:else}
            <div class="space-y-4">
                {#each orderGroups as group (group.key)}
                    <div>
                        <p
                            class="text-xs font-semibold text-discord-textSecondary mb-1 truncate"
                        >
                            {group.label}
                        </p>
                        <div class="divide-y divide-discord-divider">
                            {#each group.rooms as room, i (room.roomId)}
                                {@const rawOrder =
                                    (void roomsState.roomsTick,
                                    rawOrderOf(group, room))}
                                <div class="flex items-center gap-2 py-1.5">
                                    <span
                                        class="min-w-0 flex-1 truncate text-sm text-discord-textPrimary"
                                        >{getRoomDisplayName(room)}</span
                                    >
                                    <input
                                        type="text"
                                        class="w-20 px-1.5 py-1 rounded bg-discord-backgroundTertiary text-xs text-discord-textPrimary border border-discord-divider focus:border-discord-accent outline-none"
                                        value={rawOrder}
                                        spellcheck="false"
                                        autocomplete="off"
                                        aria-label="Order value for {getRoomDisplayName(
                                            room,
                                        )}"
                                        onkeydown={(e) => {
                                            if (e.key === "Enter")
                                                e.currentTarget.blur();
                                        }}
                                        onblur={(e) => {
                                            const v = e.currentTarget.value;
                                            if (v !== rawOrderOf(group, room))
                                                commitRawOrder(group, room, v);
                                        }}
                                    />
                                    <button
                                        type="button"
                                        class="p-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                        title="Move up"
                                        aria-label="Move {getRoomDisplayName(
                                            room,
                                        )} up"
                                        disabled={i === 0}
                                        onclick={() => moveRoom(group, i, "up")}
                                    >
                                        <svg
                                            class="w-4 h-4"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        >
                                            <path d="M18 15l-6-6-6 6" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        class="p-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                        title="Move down"
                                        aria-label="Move {getRoomDisplayName(
                                            room,
                                        )} down"
                                        disabled={i === group.rooms.length - 1}
                                        onclick={() =>
                                            moveRoom(group, i, "down")}
                                    >
                                        <svg
                                            class="w-4 h-4"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        >
                                            <path d="M6 9l6 6 6-6" />
                                        </svg>
                                    </button>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </section>
</div>

{#if pickerTarget}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3"
        onclick={(event) => {
            if (event.target === event.currentTarget) pickerTarget = null;
        }}
    >
        <div class="w-full max-w-72">
            <EmojiPicker
                room={pickerRoom}
                onSelect={chooseReaction}
                onSelectCustom={(emoji) => chooseReaction(emoji.mxcUrl)}
                onClose={() => (pickerTarget = null)}
            />
        </div>
    </div>
{/if}

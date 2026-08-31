<script lang="ts">
    import OptionSelector from "$lib/components/ui/OptionSelector.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        getRoomDisplayName,
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
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import {
        setKeepSidebarOpen,
        setTimeClock,
        setDateStyle,
        setCustomDatePattern,
        setAlwaysAbsolute,
        setGifDefaultTab,
        setLinkPreviewMedia,
        setLinkPreviewsEnabled,
        setShowReadReceiptAvatars,
        setPauseVideoOnScrollOff,
        setShowMatrixIds,
        setReduceMotion,
        setHoldToOpenMessageMenu,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import { type GifTab } from "$lib/utils/klipy";
    import type { LinkPreviewMedia } from "$lib/utils/linkPreviewPolicy";
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
    const linkPreviewOptions: Array<{
        value: LinkPreviewMedia;
        label: string;
        title: string;
    }> = [
        {
            value: "all",
            label: "All",
            title: "Load preview media from wherever it is hosted",
        },
        {
            value: "proxied",
            label: "Homeserver only",
            title: "Only load preview media your own homeserver serves",
        },
        {
            value: "none",
            label: "Off",
            title: "Never load preview media automatically",
        },
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
                const result = await setRoomTagOrderRaw(
                    room.roomId,
                    group.section === "favourite"
                        ? TAG_FAVOURITE
                        : TAG_LOWPRIORITY,
                    raw,
                );
                if (result.kind === "set" && result.clamped) {
                    showErrorToast(
                        `Order must be between 0 and 1 - used ${result.value} instead.`,
                    );
                }
            }
            roomsState.roomsTick++;
        } catch (err) {
            console.error("Failed to set order value:", err);
            showErrorToast(
                err instanceof Error ? err.message : "Failed to set order",
            );
        }
    }
</script>

<div class="space-y-6">
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
                        Invalid format - use lowercase date-fns tokens like
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
            Messages
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">Show Matrix IDs</p>
                <p class="text-xs text-discord-textMuted">
                    Show full Matrix ids like @user:server instead of display
                    names throughout the app.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.showMatrixIds}
                onChange={setShowMatrixIds}
                label="Show Matrix IDs"
            />
        </div>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Read receipt avatars
                </p>
                <p class="text-xs text-discord-textMuted">
                    Show who has read each message as small avatars underneath
                    it. This only changes what you see on this device - to stop
                    others seeing how far you've read, use Private read receipts
                    in Notifications.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.showReadReceiptAvatars}
                onChange={setShowReadReceiptAvatars}
                label="Read receipt avatars"
            />
        </div>
        <div
            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="flex-1 min-w-0">
                <span class="text-sm text-discord-textPrimary"
                    >Link previews</span
                >
                <p class="text-xs text-discord-textMuted">
                    When off, no link preview is loaded and your homeserver
                    never fetches the linked page on your behalf.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.linkPreviewsEnabled}
                onChange={setLinkPreviewsEnabled}
                label="Link previews"
            />
        </div>
        <div
            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="flex-1 min-w-0">
                <span class="text-sm text-discord-textPrimary"
                    >Link preview media</span
                >
                <p class="text-xs text-discord-textMuted">
                    Preview images and videos usually come straight from the
                    site that hosts them, so that site learns your IP address
                    and when you read the message. "Homeserver only" loads just
                    the copies your own server serves; "Off" loads none of it.
                    Both also hide embedded YouTube players and X/Twitter cards,
                    which always load straight from those sites. Either way,
                    each affected preview keeps a button to load its media.
                </p>
            </div>
            <OptionSelector
                value={settingsState.linkPreviewMedia}
                options={linkPreviewOptions}
                onChange={setLinkPreviewMedia}
                ariaLabel="Link preview media"
            />
        </div>
        <div class="flex items-center gap-3 py-2">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Pause videos off-screen
                </p>
                <p class="text-xs text-discord-textMuted">
                    Pause a playing video when it scrolls out of view to save
                    battery. You restart it yourself when you scroll back.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.pauseVideoOnScrollOff}
                onChange={setPauseVideoOnScrollOff}
                label="Pause videos off-screen"
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

        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">Reduce motion</p>
                <p class="text-xs text-discord-textMuted">
                    Minimize animations and transitions. Your device's system
                    "reduce motion" setting is always respected as well.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.reduceMotion}
                onChange={setReduceMotion}
                label="Reduce motion"
            />
        </div>

        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Hold to open message menu
                </p>
                <p class="text-xs text-discord-textMuted">
                    On touch devices, open a message's actions by holding it
                    instead of tapping. When off, a tap opens the menu.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.holdToOpenMessageMenu}
                onChange={setHoldToOpenMessageMenu}
                label="Hold to open message menu"
            />
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

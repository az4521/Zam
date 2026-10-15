<script lang="ts">
    import { t } from "$lib/i18n";
    // Ctrl+K: jump to any room, DM or space by name, as in Discord. With
    // nothing typed it lists the rooms visited this session, then unread ones.
    import { onMount } from "svelte";
    import type { Room } from "matrix-js-sdk";
    import {
        getRooms,
        getRoom,
        getRoomDisplayName,
        getRoomAvatar,
        getRoomUnreadInfo,
        findSpaceForRoom,
    } from "$lib/matrix/client";
    import {
        roomsState,
        navigateToRoom,
        setActiveSpace,
    } from "$lib/stores/rooms.svelte";
    import { recentRooms } from "$lib/keybinds/runner";
    import { matchScore } from "$lib/keybinds/quickSwitcherMatch";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";

    interface Props {
        onClose: () => void;
    }
    let { onClose }: Props = $props();

    interface Entry {
        room: Room;
        name: string;
        space: boolean;
        /** Where it lives: the space's name, or null for Home. */
        where: string | null;
        unread: boolean;
        mention: boolean;
    }

    const MAX_RESULTS = 30;

    let query = $state("");
    let selected = $state(0);
    let inputEl = $state<HTMLInputElement | null>(null);
    let listEl = $state<HTMLElement | null>(null);

    // Built once per open: the dialog is short-lived.
    const entries: Entry[] = (() => {
        void roomsState.unreadTick;
        return getRooms().map((room) => {
            const space = room.isSpaceRoom();
            const spaceId = space ? null : findSpaceForRoom(room.roomId);
            const spaceRoom = spaceId ? getRoom(spaceId) : null;
            const info = space
                ? { unread: false, highlight: 0 }
                : getRoomUnreadInfo(room);
            return {
                room,
                name: getRoomDisplayName(room),
                space,
                where: spaceRoom ? getRoomDisplayName(spaceRoom) : null,
                unread: info.unread,
                mention: info.highlight > 0,
            };
        });
    })();

    const results = $derived.by((): Entry[] => {
        const q = query.trim();
        if (!q) {
            const byId = new Map(entries.map((e) => [e.room.roomId, e]));
            const recent = recentRooms()
                .filter((id) => id !== roomsState.activeRoomId)
                .map((id) => byId.get(id))
                .filter((e): e is Entry => !!e);
            const seen = new Set(recent.map((e) => e.room.roomId));
            const unread = entries
                .filter((e) => e.unread && !seen.has(e.room.roomId))
                .sort((a, b) => Number(b.mention) - Number(a.mention));
            return [...recent, ...unread].slice(0, MAX_RESULTS);
        }
        return entries
            .map((e) => ({ e, score: matchScore(e.name, q) }))
            .filter((x): x is { e: Entry; score: number } => x.score !== null)
            .sort(
                (a, b) =>
                    b.score - a.score ||
                    Number(b.e.unread) - Number(a.e.unread) ||
                    a.e.name.localeCompare(b.e.name),
            )
            .slice(0, MAX_RESULTS)
            .map((x) => x.e);
    });

    $effect(() => {
        void query;
        selected = 0;
    });

    onMount(() => inputEl?.focus());

    function choose(e: Entry | undefined) {
        if (!e) return;
        onClose();
        if (e.space) setActiveSpace(e.room.roomId);
        else navigateToRoom(e.room.roomId);
    }

    function move(step: number) {
        if (results.length === 0) return;
        selected = (selected + step + results.length) % results.length;
        listEl
            ?.querySelector(`[data-index="${selected}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
            e.preventDefault();
            move(1);
        } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
            e.preventDefault();
            move(-1);
        } else if (e.key === "Enter") {
            e.preventDefault();
            choose(results[selected]);
        }
    }
</script>

<ModalDialog
    {onClose}
    labelledBy="quick-switcher-title"
    layerClass="z-50 flex items-start justify-center pt-[15vh] px-4"
    panelClass="relative w-full max-w-xl bg-discord-backgroundSecondary rounded-lg shadow-xl overflow-hidden"
    {onKeydown}
>
    <div class="p-4 flex flex-col gap-3">
        <h2
            id="quick-switcher-title"
            class="text-sm font-semibold text-discord-textPrimary"
        >
            {t("quickSwitcher.title")}
        </h2>
        <input
            bind:this={inputEl}
            bind:value={query}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="quick-switcher-list"
            aria-activedescendant={results.length
                ? `quick-switcher-${selected}`
                : undefined}
            aria-label={t("quickSwitcher.placeholder")}
            placeholder={t("quickSwitcher.placeholder")}
            class="w-full px-3 py-2.5 rounded bg-discord-backgroundTertiary text-discord-textPrimary text-base placeholder-discord-textMuted outline-none focus:ring-2 focus:ring-discord-accent"
        />
        {#if !query.trim() && results.length > 0}
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
            >
                {t("quickSwitcher.recentAndUnread")}
            </p>
        {/if}
        <ul
            id="quick-switcher-list"
            role="listbox"
            bind:this={listEl}
            class="max-h-80 overflow-y-auto -mx-1"
        >
            {#each results as e, i (e.room.roomId)}
                <li
                    id="quick-switcher-{i}"
                    role="option"
                    aria-selected={i === selected}
                    data-index={i}
                    class="flex items-center gap-3 px-2 py-1.5 mx-1 rounded cursor-pointer {i ===
                    selected
                        ? 'bg-discord-messageHover'
                        : ''}"
                    onclick={() => choose(e)}
                    onkeydown={() => {}}
                    onpointermove={() => (selected = i)}
                >
                    <Avatar
                        src={getRoomAvatar(e.room)}
                        name={e.name}
                        id={e.room.roomId}
                        size={24}
                        rounded={e.space ? "lg" : "full"}
                    />
                    <span
                        class="flex-1 min-w-0 truncate text-sm {e.unread
                            ? 'text-discord-textPrimary font-semibold'
                            : 'text-discord-textSecondary'}">{e.name}</span
                    >
                    {#if e.mention}
                        <span
                            class="w-2 h-2 rounded-full bg-discord-danger flex-shrink-0"
                            aria-label={t("quickSwitcher.mentioned")}
                        ></span>
                    {/if}
                    <span
                        class="text-xs text-discord-textMuted truncate max-w-[40%]"
                        >{e.space
                            ? t("quickSwitcher.space")
                            : (e.where ?? t("quickSwitcher.home"))}</span
                    >
                </li>
            {:else}
                <li class="px-2 py-3 text-sm text-discord-textMuted">
                    {t("quickSwitcher.noResults")}
                </li>
            {/each}
        </ul>
        <p class="text-xs text-discord-textMuted">
            {t("quickSwitcher.hint")}
        </p>
    </div>
</ModalDialog>

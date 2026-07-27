<script lang="ts">
    import Portal from "$lib/components/ui/Portal.svelte";
    import BottomSheet from "$lib/components/ui/BottomSheet.svelte";
    import {
        roomHeaderMenuRows,
        type RoomHeaderMenuKey,
    } from "$lib/utils/roomHeaderMenu";

    interface Props {
        /** `interfaceState.sidebar` — which panel is currently open. */
        activeSidebar: string | null;
        threadMentions: number;
        threadAnyUnread: boolean;
        pinnedCount: number;
        onChoose: (key: RoomHeaderMenuKey) => void;
        onClose: () => void;
    }
    let {
        activeSidebar,
        threadMentions,
        threadAnyUnread,
        pinnedCount,
        onChoose,
        onClose,
    }: Props = $props();

    const rows = $derived(
        roomHeaderMenuRows({
            activeSidebar,
            threadMentions,
            threadAnyUnread,
            pinnedCount,
        }),
    );

    // The same glyphs the desktop header buttons use, so the two layouts read
    // as the same controls. Icon *sourcing* is chore/icon-normalization's job.
    const ICONS: Record<RoomHeaderMenuKey, string> = {
        threads:
            "M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2zm2 5h12V7H6v2zm0 4h9v-2H6v2z",
        pinned: "M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z",
        notifications:
            "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z",
        members:
            "M14 6.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM1 14.25C1 12.455 2.455 11 4.25 11h7.5C13.545 11 15 12.455 15 14.25v.25a.75.75 0 0 1-.75.75H1.75A.75.75 0 0 1 1 14.5v-.25Zm17.25-5.75a.75.75 0 0 1 .75.75v2h2a.75.75 0 0 1 0 1.5h-2v2a.75.75 0 0 1-1.5 0v-2h-2a.75.75 0 0 1 0-1.5h2v-2a.75.75 0 0 1 .75-.75Z",
    };

    function choose(key: RoomHeaderMenuKey) {
        // Close this sheet FIRST, mirroring ComposerActionsMenu: it holds the
        // single modal slot, and closing after `onChoose` would tear down
        // anything the chosen action opened in that slot.
        onClose();
        onChoose(key);
    }
</script>

<Portal>
    <button
        type="button"
        aria-label="Close menu"
        class="fixed inset-0 z-40 bg-black/40"
        onclick={onClose}
    ></button>
    <BottomSheet {onClose}>
        <div role="menu" aria-label="More room options" class="pb-1">
            {#each rows as row (row.key)}
                <button
                    role="menuitem"
                    onclick={() => choose(row.key)}
                    class="w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-discord-messageHover {row.active
                        ? 'text-discord-accent'
                        : 'text-discord-textPrimary'}"
                >
                    <svg
                        class="w-5 h-5 flex-shrink-0 {row.active
                            ? 'text-discord-accent'
                            : 'text-discord-textMuted'}"
                        fill="currentColor"
                        viewBox="0 0 24 24"><path d={ICONS[row.key]} /></svg
                    >
                    <span class="flex-1 truncate">{row.label}</span>
                    {#if row.badge}
                        <span
                            class="flex-shrink-0 bg-discord-danger text-white text-[10px] leading-none font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center"
                            >{row.badge}</span
                        >
                    {:else if row.dot}
                        <span
                            class="flex-shrink-0 w-2 h-2 rounded-full bg-discord-accent"
                            aria-label="Unread"
                        ></span>
                    {/if}
                </button>
            {/each}
        </div>
    </BottomSheet>
</Portal>

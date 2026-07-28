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
        // Mirrors lucide's `Image` (the desktop media button) as a solid glyph,
        // so this sheet stays one visual family rather than mixing artwork.
        media: "M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
        members:
            "M14 6.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM1 14.25C1 12.455 2.455 11 4.25 11h7.5C13.545 11 15 12.455 15 14.25v.25a.75.75 0 0 1-.75.75H1.75A.75.75 0 0 1 1 14.5v-.25Zm17.25-5.75a.75.75 0 0 1 .75.75v2h2a.75.75 0 0 1 0 1.5h-2v2a.75.75 0 0 1-1.5 0v-2h-2a.75.75 0 0 1 0-1.5h2v-2a.75.75 0 0 1 .75-.75Z",
    };

    // What each row's badge is counting, for screen readers. The visible pill
    // is a bare number, which on its own announces as "Threads, 3".
    const BADGE_NOUNS: Record<
        RoomHeaderMenuKey,
        { one: string; other: string }
    > = {
        threads: { one: "unread mention", other: "unread mentions" },
        pinned: { one: "pinned message", other: "pinned messages" },
        notifications: {
            one: "unread notification",
            other: "unread notifications",
        },
        media: { one: "item", other: "items" },
        members: { one: "member", other: "members" },
    };

    // `badge` is pill *text*, not a count: the model caps it at "99+", so the
    // only value that is ever singular is the literal "1". Comparing the string
    // keeps "99+" out of Number() (which would yield NaN) without needing to
    // parse anything.
    function badgeAnnouncement(key: RoomHeaderMenuKey, badge: string): string {
        const noun = BADGE_NOUNS[key];
        return `${badge} ${badge === "1" ? noun.one : noun.other}`;
    }

    // The threads pill keeps `bg-discord-danger` because it counts unread
    // *mentions* — the same thing the desktop threads badge paints red. Every
    // other row's badge is a neutral total (pinned messages are not urgent), so
    // it gets a plain chip: `divider` reads as a raised surface against the
    // sheet's `backgroundTertiary` in both themes, and `textPrimary` on it
    // clears WCAG AA in both without depending on how bright `textMuted` is.
    const BADGE_CLASSES: Record<RoomHeaderMenuKey, string> = {
        threads: "bg-discord-danger text-white",
        pinned: "bg-discord-divider text-discord-textPrimary",
        notifications: "bg-discord-divider text-discord-textPrimary",
        media: "bg-discord-divider text-discord-textPrimary",
        members: "bg-discord-divider text-discord-textPrimary",
    };

    function choose(key: RoomHeaderMenuKey) {
        // Close this sheet FIRST, mirroring ComposerActionsMenu. Today every
        // key opens a *sidebar*, which `closeModal` never touches, so the
        // order is not load-bearing — it is kept as a defensive invariant for
        // any future row that opens something in the single modal slot, which
        // closing afterwards would immediately tear back down.
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
                <!--
                  menuitemcheckbox, not menuitem: each row toggles a panel, and
                  `aria-checked` is what carries "this one is open" to anything
                  that cannot see the accent colour (WCAG 1.4.1).
                -->
                <button
                    role="menuitemcheckbox"
                    aria-checked={row.active}
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
                    <!--
                      The pill and the dot are both hidden from assistive tech
                      and re-announced by an adjacent sr-only span: `aria-label`
                      is not valid on a generic-role span (it only ever worked
                      here by accident), and an unlabelled "3" says nothing
                      about what was counted.
                    -->
                    {#if row.badge}
                        <span
                            aria-hidden="true"
                            class="flex-shrink-0 {BADGE_CLASSES[
                                row.key
                            ]} text-[10px] leading-none font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center"
                            >{row.badge}</span
                        >
                        <span class="sr-only"
                            >{badgeAnnouncement(row.key, row.badge)}</span
                        >
                    {:else if row.dot}
                        <span
                            aria-hidden="true"
                            class="flex-shrink-0 w-2 h-2 rounded-full bg-discord-accent"
                        ></span>
                        <span class="sr-only">unread</span>
                    {/if}
                </button>
            {/each}
        </div>
    </BottomSheet>
</Portal>

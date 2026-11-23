<script lang="ts">
    import { t, type MessageKey } from "$lib/i18n";
    import Portal from "$lib/components/ui/Portal.svelte";
    import BottomSheet from "$lib/components/ui/BottomSheet.svelte";
    import {
        roomHeaderMenuRows,
        type RoomHeaderMenuKey,
        type PluginHeaderMenuRow,
    } from "$lib/utils/roomHeaderMenu";
    import {
        MessageSquareText,
        Pin,
        Bell,
        Image,
        Users,
        AppWindow,
    } from "lucide-svelte";

    interface Props {
        /** `interfaceState.sidebar` — which panel is currently open. */
        activeSidebar: string | null;
        threadMentions: number;
        threadAnyUnread: boolean;
        pinnedCount: number;
        pluginRows?: PluginHeaderMenuRow[];
        onChoose: (key: RoomHeaderMenuKey) => void;
        onChoosePlugin?: (key: string) => void;
        onClose: () => void;
    }
    let {
        activeSidebar,
        threadMentions,
        threadAnyUnread,
        pinnedCount,
        pluginRows = [],
        onChoose,
        onChoosePlugin,
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

    // The same lucide outline icons the desktop header buttons use, so the two
    // layouts read as the same controls.
    const ICONS: Record<RoomHeaderMenuKey, typeof Pin> = {
        threads: MessageSquareText,
        pinned: Pin,
        notifications: Bell,
        media: Image,
        members: Users,
    };

    // What each row's badge is counting, for screen readers. The visible pill
    // is a bare number, which on its own announces as "Threads, 3".
    const BADGE_NOUNS: Record<RoomHeaderMenuKey, MessageKey> = {
        threads: "roomHeaderOverflowMenu.badgeThreads",
        pinned: "roomHeaderOverflowMenu.badgePinned",
        notifications: "roomHeaderOverflowMenu.badgeNotifications",
        media: "roomHeaderOverflowMenu.badgeMedia",
        members: "roomHeaderOverflowMenu.badgeMembers",
    };

    // `badge` is pill *text*, not a count: the model caps it at "99+", so the
    // only value that is ever singular is the literal "1". Comparing the string
    // keeps "99+" out of Number() (which would yield NaN) without needing to
    // parse anything.
    function badgeAnnouncement(key: RoomHeaderMenuKey, badge: string): string {
        // The plural form is picked from the count; `badge` is shown as-is so
        // the "99+" cap survives into the announcement.
        return t(BADGE_NOUNS[key], {
            count: badge === "1" ? 1 : 2,
            badge,
        });
    }

    // The threads pill keeps `bg-zam-danger` because it counts unread
    // *mentions* — the same thing the desktop threads badge paints red. Every
    // other row's badge is a neutral total (pinned messages are not urgent), so
    // it gets a plain chip: `divider` reads as a raised surface against the
    // sheet's `backgroundTertiary` in both themes, and `textPrimary` on it
    // clears WCAG AA in both without depending on how bright `textMuted` is.
    const BADGE_CLASSES: Record<RoomHeaderMenuKey, string> = {
        threads: "bg-zam-danger text-white",
        pinned: "bg-zam-divider text-zam-textPrimary",
        notifications: "bg-zam-divider text-zam-textPrimary",
        media: "bg-zam-divider text-zam-textPrimary",
        members: "bg-zam-divider text-zam-textPrimary",
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

    function choosePlugin(key: string) {
        onClose();
        onChoosePlugin?.(key);
    }
</script>

<Portal>
    <BottomSheet {onClose}>
        <div
            role="menu"
            aria-label={t("roomHeaderOverflowMenu.moreRoomOptions")}
            class="pb-1"
        >
            {#each rows as row (row.key)}
                {@const Icon = ICONS[row.key]}
                <!--
                  menuitemcheckbox, not menuitem: each row toggles a panel, and
                  `aria-checked` is what carries "this one is open" to anything
                  that cannot see the accent colour (WCAG 1.4.1).
                -->
                <button
                    role="menuitemcheckbox"
                    aria-checked={row.active}
                    onclick={() => choose(row.key)}
                    class="w-full flex items-center gap-3 px-4 py-3 text-start text-sm transition-colors hover:bg-zam-messageHover {row.active
                        ? 'text-zam-accent'
                        : 'text-zam-textPrimary'}"
                >
                    <Icon
                        size={20}
                        class="flex-shrink-0 {row.active
                            ? 'text-zam-accent'
                            : 'text-zam-textMuted'}"
                    />
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
                            class="flex-shrink-0 w-2 h-2 rounded-full bg-zam-accent"
                        ></span>
                        <span class="sr-only"
                            >{t("roomHeaderOverflowMenu.unread")}</span
                        >
                    {/if}
                </button>
            {/each}
            {#each pluginRows as row (row.key)}
                <button
                    role="menuitemcheckbox"
                    aria-checked={row.active}
                    onclick={() => choosePlugin(row.key)}
                    class="w-full flex items-center gap-3 px-4 py-3 text-start text-sm transition-colors hover:bg-zam-messageHover {row.active
                        ? 'text-zam-accent'
                        : 'text-zam-textPrimary'}"
                >
                    <AppWindow
                        size={20}
                        class="flex-shrink-0 {row.active
                            ? 'text-zam-accent'
                            : 'text-zam-textMuted'}"
                    />
                    <span class="flex-1 truncate">{row.label}</span>
                </button>
            {/each}
        </div>
    </BottomSheet>
</Portal>

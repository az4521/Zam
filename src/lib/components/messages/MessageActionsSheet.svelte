<script lang="ts">
    import type { Snippet } from "svelte";
    import { t } from "$lib/i18n";
    import Portal from "$lib/components/ui/Portal.svelte";
    import BottomSheet from "$lib/components/ui/BottomSheet.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import type {
        MessageActionKey,
        MessageActionRow,
    } from "$lib/utils/messageActionsMenu";
    import type { PluginMessageActionView } from "$lib/utils/pluginMessageActions";

    interface Props {
        /** Ordered rows from `messageActionsMenu`. */
        rows: MessageActionRow[];
        /**
         * Plain text of the message, shown large and selectable above the rows
         * so part of it can be picked out and copied. Empty hides the preview.
         */
        preview?: string;
        /**
         * The message body as the chat log renders it (formatting, emoji,
         * links, spoilers). Shown in place of the plain `preview` text.
         */
        previewBody?: Snippet;
        /**
         * Who sent the message and when. With it, the preview box is laid out
         * like a chat-log message: avatar, name and time, then the body.
         */
        sender?: {
            id: string;
            name: string;
            avatarSrc?: string | null;
            colour?: string;
            /** Already formatted for display, as in the chat log header. */
            time: string;
            /** Full date and time, for the time's tooltip. */
            fullTime?: string;
        };
        /** Plugin-contributed action rows (appended after core rows). */
        pluginRows?: PluginMessageActionView[];
        /** Run the chosen core action. The sheet closes itself first. */
        onChoose: (key: MessageActionKey) => void;
        /** Run the chosen plugin action. The sheet closes itself first. */
        onChoosePlugin?: (key: string) => void;
        /** Dismiss the sheet (backdrop tap / Escape / after a choice). */
        onClose: () => void;
    }
    let {
        rows,
        preview = "",
        previewBody,
        sender,
        pluginRows = [],
        onChoose,
        onChoosePlugin,
        onClose,
    }: Props = $props();

    // A row flagged `confirm` swaps the menu for an inline "are you sure?" step
    // instead of running straight away — today only Delete, which has no
    // follow-up dialog of its own.
    let pending = $state<MessageActionRow | null>(null);

    // Solid glyphs matching the desktop toolbar buttons, so the sheet reads as
    // the same controls in a different layout.
    const ICONS: Record<MessageActionKey, string> = {
        react: "M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM8.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM15.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM6.89 13.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5s-4.31-1.46-5.11-3.5z",
        reply: "M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z",
        forward: "M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z",
        "copy-text":
            "M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z",
        thread: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 14H6v-2h2v2zm0-3H6V9h2v2zm0-3H6V6h2v2zm7 6h-5v-2h5v2zm3-3h-8V9h8v2zm0-3h-8V6h8v2z",
        edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
        pin: "M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z",
        "copy-link":
            "M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8v2zm9-6h-4v1.9h4a3.1 3.1 0 0 1 0 6.2h-4V17h4a5 5 0 0 0 0-10z",
        "mark-unread":
            "M20 6.54V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10.1A5 5 0 0 0 20 6.54zM19 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
        "view-source":
            "M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z",
        report: "M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z",
        redact: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
        delete: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
    };

    function pick(row: MessageActionRow) {
        if (row.confirm) {
            pending = row;
            return;
        }
        run(row.key);
    }

    function run(key: MessageActionKey) {
        // Close FIRST, mirroring RoomHeaderOverflowMenu: an action that opens
        // its own dialog (report/redact) claims the single modal slot, so the
        // sheet must release it before the action runs.
        onClose();
        onChoose(key);
    }

    function runPlugin(key: string) {
        // Close FIRST (release the single modal slot), mirroring core rows:
        // a plugin action may open its own popover/modal.
        onClose();
        onChoosePlugin?.(key);
    }
</script>

<Portal>
    <BottomSheet {onClose}>
        {#if pending}
            <div class="px-4 py-3">
                <p class="text-sm text-discord-textPrimary mb-3">
                    {t("messageActionsSheet.thisMessage", {
                        label: pending.label,
                    })}
                </p>
                <div class="flex justify-end gap-2">
                    <button
                        onclick={() => (pending = null)}
                        class="px-4 min-h-11 rounded text-sm font-semibold text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                        >{t("common.cancel")}</button
                    >
                    <button
                        onclick={() => run(pending!.key)}
                        class="px-4 min-h-11 rounded text-sm font-semibold text-white bg-discord-danger hover:bg-discord-dangerHover transition-colors"
                        >{pending.label}</button
                    >
                </div>
            </div>
        {:else}
            {#if sender || preview}
                <!--
                    The message as the chat log shows it: avatar, name and time,
                    then the body. Long-press on the message lands here, so this
                    is also where text gets selected: selectable, and opted out
                    of the sheet's swipe-down so dragging a selection can't
                    dismiss it.
                -->
                <div class="px-4 pb-3" data-sheet-no-drag>
                    <div
                        class="max-h-[28vh] overflow-y-auto rounded-lg bg-discord-backgroundSecondary px-3 py-3 flex gap-3 min-w-0"
                    >
                        {#if sender}
                            <div class="w-10 flex-shrink-0 mt-0.5">
                                <Avatar
                                    src={sender.avatarSrc}
                                    name={sender.name}
                                    id={sender.id}
                                    size={40}
                                />
                            </div>
                        {/if}
                        <div class="flex-1 min-w-0">
                            {#if sender}
                                <div
                                    class="flex items-baseline gap-2 mb-0.5 min-w-0"
                                >
                                    <span
                                        class="min-w-0 truncate font-semibold text-sm text-discord-textPrimary"
                                        style:color={sender.colour}
                                        >{sender.name}</span
                                    >
                                    <span
                                        class="text-xs text-discord-textMuted whitespace-nowrap flex-shrink-0"
                                        title={sender.fullTime}
                                        >{sender.time}</span
                                    >
                                </div>
                            {/if}
                            {#if previewBody && preview}
                                <div class="select-text">
                                    {@render previewBody()}
                                </div>
                            {:else if preview}
                                <p
                                    class="text-sm leading-relaxed text-discord-textPrimary whitespace-pre-wrap break-words select-text"
                                >
                                    {preview}
                                </p>
                            {/if}
                        </div>
                    </div>
                    {#if preview}
                        <p class="mt-1.5 text-xs text-discord-textMuted">
                            {t("messageActionsMenu.selectHint")}
                        </p>
                    {/if}
                </div>
            {/if}
            <div
                role="menu"
                aria-label={t("messageActionsSheet.messageActions")}
                class="pb-1"
            >
                {#each rows as row (row.key)}
                    <button
                        role="menuitem"
                        onclick={() => pick(row)}
                        class="w-full flex items-center gap-3 px-4 py-3 text-start text-sm transition-colors hover:bg-discord-messageHover {row.danger
                            ? 'text-discord-danger'
                            : 'text-discord-textPrimary'}"
                    >
                        <svg
                            class="w-5 h-5 flex-shrink-0 {row.danger
                                ? 'text-discord-danger'
                                : 'text-discord-textMuted'}"
                            fill="currentColor"
                            viewBox="0 0 24 24"><path d={ICONS[row.key]} /></svg
                        >
                        <span class="flex-1 truncate">{row.label}</span>
                    </button>
                {/each}
                {#each pluginRows as row (row.entryId)}
                    <button
                        role="menuitem"
                        onclick={() => runPlugin(row.key)}
                        class="w-full flex items-center gap-3 px-4 py-3 text-start text-sm transition-colors hover:bg-discord-messageHover text-discord-textPrimary"
                    >
                        {#if row.icon}
                            <svg
                                class="w-5 h-5 flex-shrink-0 text-discord-textMuted"
                                fill="currentColor"
                                viewBox="0 0 24 24"><path d={row.icon} /></svg
                            >
                        {:else}
                            <span
                                class="w-5 h-5 flex-shrink-0 grid place-items-center text-xs font-semibold text-discord-textMuted"
                                >{row.label.slice(0, 1)}</span
                            >
                        {/if}
                        <span class="flex-1 truncate">{row.label}</span>
                    </button>
                {/each}
            </div>
        {/if}
    </BottomSheet>
</Portal>

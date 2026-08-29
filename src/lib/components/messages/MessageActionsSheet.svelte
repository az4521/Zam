<script lang="ts">
    import Portal from "$lib/components/ui/Portal.svelte";
    import BottomSheet from "$lib/components/ui/BottomSheet.svelte";
    import type {
        MessageActionKey,
        MessageActionRow,
    } from "$lib/utils/messageActionsMenu";
    import type { PluginMessageActionView } from "$lib/utils/pluginMessageActions";

    interface Props {
        /** Ordered overflow rows from `messageActionsMenu`. */
        rows: MessageActionRow[];
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
        edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
        pin: "M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z",
        "copy-link":
            "M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8v2zm9-6h-4v1.9h4a3.1 3.1 0 0 1 0 6.2h-4V17h4a5 5 0 0 0 0-10z",
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
    <button
        type="button"
        aria-label="Close menu"
        class="fixed inset-0 z-40 bg-black/40"
        onclick={onClose}
    ></button>
    <BottomSheet {onClose}>
        {#if pending}
            <div class="px-4 py-3">
                <p class="text-sm text-discord-textPrimary mb-3">
                    {pending.label} this message?
                </p>
                <div class="flex justify-end gap-2">
                    <button
                        onclick={() => (pending = null)}
                        class="px-3 py-1.5 rounded text-sm font-semibold text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                        >Cancel</button
                    >
                    <button
                        onclick={() => run(pending!.key)}
                        class="px-3 py-1.5 rounded text-sm font-semibold text-white bg-discord-danger hover:bg-discord-dangerHover transition-colors"
                        >{pending.label}</button
                    >
                </div>
            </div>
        {:else}
            <div role="menu" aria-label="Message actions" class="pb-1">
                {#each rows as row (row.key)}
                    <button
                        role="menuitem"
                        onclick={() => pick(row)}
                        class="w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-discord-messageHover {row.danger
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
                        class="w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-discord-messageHover text-discord-textPrimary"
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

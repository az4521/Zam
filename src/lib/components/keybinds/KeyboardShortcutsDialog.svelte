<script lang="ts">
    import { t } from "$lib/i18n";
    // Ctrl+/: every keyboard shortcut as currently bound, as in Discord.
    import { KEYBIND_CATEGORIES, KEYBIND_DEFS } from "$lib/keybinds/keybinds";
    import { keybindCategoryLabel, keybindLabel } from "$lib/keybinds/labels";
    import { bindingFor, keybindsState } from "$lib/stores/keybinds.svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import KeyCaps from "./KeyCaps.svelte";

    interface Props {
        onClose: () => void;
        /** Opens Settings > Keybinds. */
        onCustomize: () => void;
    }
    let { onClose, onCustomize }: Props = $props();

    const groups = $derived.by(() => {
        void keybindsState.overrides;
        return KEYBIND_CATEGORIES.map((c) => ({
            category: c,
            rows: KEYBIND_DEFS.filter((d) => d.category === c)
                .map((d) => ({ id: d.id, binding: bindingFor(d.id) }))
                .filter((r) => r.binding !== null),
        })).filter((g) => g.rows.length > 0);
    });
</script>

<ModalDialog
    {onClose}
    labelledBy="keyboard-shortcuts-title"
    layerClass="z-50 flex items-center justify-center p-4"
    panelClass="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-discord-backgroundSecondary rounded-lg shadow-xl"
>
    <div
        class="flex items-center gap-3 px-6 pt-5 pb-3 border-b border-discord-divider"
    >
        <h2
            id="keyboard-shortcuts-title"
            class="flex-1 text-lg font-bold text-discord-textPrimary"
        >
            {t("keybinds.helpTitle")}
        </h2>
        <button
            type="button"
            onclick={onCustomize}
            class="px-3 py-1.5 rounded text-sm font-medium bg-discord-accent hover:bg-discord-accentHover text-white"
            >{t("keybinds.customize")}</button
        >
        <button
            type="button"
            onclick={onClose}
            aria-label={t("common.closeDialog")}
            class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover"
        >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"
                ><path
                    d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"
                /></svg
            >
        </button>
    </div>
    <div class="overflow-y-auto px-6 py-4 grid gap-6 md:grid-cols-2">
        {#each groups as g (g.category)}
            <section>
                <h3
                    class="mb-2 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                >
                    {keybindCategoryLabel(g.category)}
                </h3>
                {#each g.rows as row (row.id)}
                    <div
                        class="flex items-center gap-3 py-1.5 border-b border-discord-divider"
                    >
                        <span class="flex-1 text-sm text-discord-textPrimary"
                            >{keybindLabel(row.id)}</span
                        >
                        <KeyCaps binding={row.binding!} />
                    </div>
                {/each}
            </section>
        {/each}
    </div>
</ModalDialog>

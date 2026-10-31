<script lang="ts">
    import { t } from "$lib/i18n";
    // Edit a queued attachment before it is sent (Discord-style: tap the
    // attachment in the composer drawer). The caller owns the modal slot.
    import { focusTrap } from "$lib/actions/focusTrap";
    import { onMount, untrack } from "svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";

    interface Props {
        name: string;
        previewUrl: string | null;
        video: boolean;
        direct: boolean;
        onSave: (name: string) => void;
        /** Omitted where a file can't be sent directly, hiding the toggle. */
        onDirectChange?: (direct: boolean) => void;
        onClose: () => void;
    }

    let {
        name,
        previewUrl,
        video,
        direct,
        onSave,
        onDirectChange,
        onClose,
    }: Props = $props();

    // Seeded once from the file the dialog opened with: the dialog is modal,
    // so no other attachment can be picked while it is open.
    let value = $state(untrack(() => name));
    let sendDirectly = $state(untrack(() => direct));
    let inputEl = $state<HTMLInputElement | null>(null);
    // No path separators or control characters in a filename.
    const cleaned = $derived(value.replace(/[\\/\p{Cc}]/gu, "_").trim());

    onMount(() => {
        if (!inputEl) return;
        inputEl.focus();
        // Select the stem so typing replaces it but keeps the extension.
        const dot = name.lastIndexOf(".");
        inputEl.setSelectionRange(0, dot > 0 ? dot : name.length);
    });

    function save() {
        if (!cleaned) return;
        if (cleaned !== name) onSave(cleaned);
        if (sendDirectly !== direct) onDirectChange?.(sendDirectly);
        onClose();
    }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <button
        type="button"
        aria-label={t("common.closeDialog")}
        class="absolute inset-0 bg-black/60"
        onclick={onClose}
    ></button>
    <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-attachment-title"
        class="relative z-10 bg-discord-backgroundSecondary rounded-lg shadow-xl w-full max-w-xl max-h-full overflow-y-auto"
        use:focusTrap={{ onEscape: onClose }}
    >
        <form
            class="flex flex-col gap-4 p-6"
            onsubmit={(e) => {
                e.preventDefault();
                save();
            }}
        >
            {#if previewUrl && video}
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                    src={previewUrl}
                    controls
                    playsinline
                    preload="metadata"
                    class="max-h-[50vh] w-full rounded bg-black"
                ></video>
            {:else if previewUrl}
                <img
                    src={previewUrl}
                    alt=""
                    class="max-h-[50vh] w-full object-contain rounded bg-discord-backgroundTertiary"
                />
            {/if}
            <h2
                id="rename-attachment-title"
                class="text-lg font-bold text-discord-textPrimary"
            >
                {t("renameAttachmentDialog.editAttachment")}
            </h2>
            <label class="flex flex-col gap-1.5">
                <span
                    class="text-xs font-bold uppercase text-discord-textSecondary"
                    >{t("renameAttachmentDialog.filename")}</span
                >
                <input
                    bind:this={inputEl}
                    bind:value
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    class="rounded bg-discord-backgroundTertiary px-3 py-2 text-sm text-discord-textPrimary outline-none focus:ring-2 focus:ring-discord-accent"
                />
            </label>
            {#if onDirectChange}
                <div class="flex items-center justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-discord-textPrimary">
                            {t("messageInput.sendDirectly")}
                        </p>
                        <p class="text-xs text-discord-textMuted">
                            {t("messageInput.directFileHint")}
                        </p>
                    </div>
                    <ToggleSwitch
                        checked={sendDirectly}
                        onChange={(v) => (sendDirectly = v)}
                        label={t("messageInput.sendDirectly")}
                    />
                </div>
            {/if}
            <div class="flex justify-end gap-2">
                <button
                    type="button"
                    onclick={onClose}
                    class="rounded px-4 py-2 text-sm font-medium text-discord-textPrimary hover:underline"
                >
                    {t("common.cancel")}
                </button>
                <button
                    type="submit"
                    disabled={!cleaned}
                    class="rounded bg-discord-accent px-4 py-2 text-sm font-medium text-white hover:bg-discord-accentHover disabled:opacity-50"
                >
                    {t("common.save")}
                </button>
            </div>
        </form>
    </div>
</div>

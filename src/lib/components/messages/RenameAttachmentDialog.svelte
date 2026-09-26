<script lang="ts">
    // Rename a queued attachment before it is sent (Discord-style: tap the
    // attachment in the composer drawer). The caller owns the modal slot.
    import { focusTrap } from "$lib/actions/focusTrap";
    import { onMount, untrack } from "svelte";

    interface Props {
        name: string;
        previewUrl: string | null;
        onSave: (name: string) => void;
        onClose: () => void;
    }

    let { name, previewUrl, onSave, onClose }: Props = $props();

    // Seeded once from the name the dialog opened with: the dialog is modal,
    // so no other attachment can be picked while it is open.
    let value = $state(untrack(() => name));
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
        onClose();
    }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <button
        type="button"
        aria-label="Close dialog"
        class="absolute inset-0 bg-black/60"
        onclick={onClose}
    ></button>
    <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-attachment-title"
        class="relative z-10 bg-discord-backgroundSecondary rounded-lg shadow-xl w-full max-w-md"
        use:focusTrap={{ onEscape: onClose }}
    >
        <form
            class="flex flex-col gap-4 p-6"
            onsubmit={(e) => {
                e.preventDefault();
                save();
            }}
        >
            {#if previewUrl}
                <img
                    src={previewUrl}
                    alt=""
                    class="max-h-48 w-full object-contain rounded bg-discord-backgroundTertiary"
                />
            {/if}
            <h2
                id="rename-attachment-title"
                class="text-lg font-bold text-discord-textPrimary"
            >
                Edit attachment
            </h2>
            <label class="flex flex-col gap-1.5">
                <span
                    class="text-xs font-bold uppercase text-discord-textSecondary"
                    >Filename</span
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
            <div class="flex justify-end gap-2">
                <button
                    type="button"
                    onclick={onClose}
                    class="rounded px-4 py-2 text-sm font-medium text-discord-textPrimary hover:underline"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={!cleaned}
                    class="rounded bg-discord-accent px-4 py-2 text-sm font-medium text-white hover:bg-discord-accentHover disabled:opacity-50"
                >
                    Save
                </button>
            </div>
        </form>
    </div>
</div>

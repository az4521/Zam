<script lang="ts">
    import { t } from "$lib/i18n";
    // Name or rename a thread (ThreadPanel header). The caller owns the modal
    // slot; saving writes room state, so the dialog stays open until the
    // server accepts it and shows the error if it doesn't.
    import { focusTrap } from "$lib/actions/focusTrap";
    import { onMount, untrack } from "svelte";
    import {
        MAX_THREAD_NAME_LENGTH,
        normalizeThreadName,
    } from "$lib/utils/threadName";
    import { matrixErrorMessage } from "$lib/utils/knock";

    interface Props {
        /** The current name, or null for an unnamed thread. */
        name: string | null;
        onSave: (name: string) => Promise<void>;
        onClose: () => void;
    }

    let { name, onSave, onClose }: Props = $props();

    // Seeded once: the dialog is modal, so the thread can't change under it.
    let value = $state(untrack(() => name ?? ""));
    let inputEl = $state<HTMLInputElement | null>(null);
    let saving = $state(false);
    let error = $state("");
    const cleaned = $derived(normalizeThreadName(value));

    onMount(() => {
        inputEl?.focus();
        inputEl?.select();
    });

    async function save(next: string) {
        if (saving) return;
        if (next === (name ?? "")) {
            onClose();
            return;
        }
        saving = true;
        error = "";
        try {
            await onSave(next);
            onClose();
        } catch (err) {
            error = matrixErrorMessage(
                err,
                t("renameThreadDialog.couldNotSaveTheName"),
            );
        } finally {
            saving = false;
        }
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
        aria-labelledby="rename-thread-title"
        class="relative z-10 bg-discord-backgroundSecondary rounded-lg shadow-xl w-full max-w-md"
        use:focusTrap={{ onEscape: onClose }}
    >
        <form
            class="flex flex-col gap-4 p-6"
            onsubmit={(e) => {
                e.preventDefault();
                save(cleaned);
            }}
        >
            <h2
                id="rename-thread-title"
                class="text-lg font-bold text-discord-textPrimary"
            >
                {name
                    ? t("renameThreadDialog.renameThread")
                    : t("renameThreadDialog.nameThread")}
            </h2>
            <label class="flex flex-col gap-1.5">
                <span
                    class="text-xs font-bold uppercase text-discord-textSecondary"
                    >{t("renameThreadDialog.threadName")}</span
                >
                <input
                    bind:this={inputEl}
                    bind:value
                    type="text"
                    maxlength={MAX_THREAD_NAME_LENGTH}
                    autocomplete="off"
                    class="rounded bg-discord-backgroundTertiary px-3 py-2 text-sm text-discord-textPrimary outline-none focus:ring-2 focus:ring-discord-accent"
                />
            </label>
            <p class="text-xs text-discord-textMuted">
                {t("renameThreadDialog.everyoneInTheRoomSeesIt")}
            </p>
            {#if error}
                <p class="text-sm text-discord-danger" role="alert">
                    {error}
                </p>
            {/if}
            <div class="flex items-center gap-2">
                {#if name}
                    <button
                        type="button"
                        disabled={saving}
                        onclick={() => save("")}
                        class="rounded px-3 py-2 text-sm font-medium text-discord-danger hover:underline disabled:opacity-50"
                    >
                        {t("renameThreadDialog.removeName")}
                    </button>
                {/if}
                <div class="flex-1"></div>
                <button
                    type="button"
                    onclick={onClose}
                    class="rounded px-4 py-2 text-sm font-medium text-discord-textPrimary hover:underline"
                >
                    {t("common.cancel")}
                </button>
                <button
                    type="submit"
                    disabled={!cleaned || saving}
                    class="rounded bg-discord-accent px-4 py-2 text-sm font-medium text-white hover:bg-discord-accentHover disabled:opacity-50"
                >
                    {saving ? t("common.saving") : t("common.save")}
                </button>
            </div>
        </form>
    </div>
</div>

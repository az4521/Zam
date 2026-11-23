<script lang="ts">
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import { addRoomWidget } from "$lib/matrix/widgetHost";
    import { parseWidgetAddress } from "$lib/utils/widgetAdd";
    import { matrixErrorMessage } from "$lib/utils/knock";
    import { closeModal } from "$lib/stores/interface.svelte";
    import { showErrorToast, showToast } from "$lib/stores/toasts.svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import Portal from "$lib/components/ui/Portal.svelte";

    // Add a widget to the room by URL. The caller claims the "add-widget" modal
    // slot; success and dismissal both go through closeModal.
    interface Props {
        roomId: string;
    }

    let { roomId }: Props = $props();

    let url = $state("");
    let name = $state("");
    let saving = $state(false);
    let error = $state("");
    let urlEl = $state<HTMLInputElement | null>(null);

    onMount(() => {
        urlEl?.focus();
    });

    async function submit() {
        if (saving) return;
        const href = parseWidgetAddress(url);
        if (!href) {
            error = t("widgets.addDialog.urlInvalid");
            return;
        }
        saving = true;
        error = "";
        try {
            await addRoomWidget(roomId, {
                url: href,
                name: name.trim() || new URL(href).host,
            });
            showToast(t("widgets.addDialog.added"), { tone: "accent" });
            closeModal();
        } catch (err) {
            showErrorToast(
                matrixErrorMessage(err, t("widgets.addDialog.failed")),
            );
        } finally {
            saving = false;
        }
    }
</script>

<Portal>
    <ModalDialog
        onClose={closeModal}
        labelledBy="add-widget-title"
        panelClass="relative bg-zam-backgroundSecondary rounded-lg shadow-xl w-full max-w-md"
    >
        <form
            class="flex flex-col gap-4 p-6"
            onsubmit={(e) => {
                e.preventDefault();
                submit();
            }}
        >
            <h2
                id="add-widget-title"
                class="text-lg font-bold text-zam-textPrimary"
            >
                {t("widgets.addDialog.title")}
            </h2>
            <label class="flex flex-col gap-1.5">
                <span class="text-xs font-bold uppercase text-zam-textSecondary"
                    >{t("widgets.addDialog.url")}</span
                >
                <input
                    bind:this={urlEl}
                    bind:value={url}
                    type="text"
                    inputmode="url"
                    autocomplete="off"
                    placeholder="https://"
                    class="rounded bg-zam-backgroundTertiary px-3 py-2 text-sm text-zam-textPrimary outline-none focus:ring-2 focus:ring-zam-accent"
                />
            </label>
            <label class="flex flex-col gap-1.5">
                <span class="text-xs font-bold uppercase text-zam-textSecondary"
                    >{t("widgets.addDialog.name")}</span
                >
                <input
                    bind:value={name}
                    type="text"
                    autocomplete="off"
                    class="rounded bg-zam-backgroundTertiary px-3 py-2 text-sm text-zam-textPrimary outline-none focus:ring-2 focus:ring-zam-accent"
                />
            </label>
            {#if error}
                <p class="text-sm text-zam-danger" role="alert">{error}</p>
            {/if}
            <div class="flex items-center gap-2">
                <div class="flex-1"></div>
                <button
                    type="button"
                    onclick={closeModal}
                    class="rounded px-4 py-2 text-sm font-medium text-zam-textPrimary hover:underline"
                >
                    {t("common.cancel")}
                </button>
                <button
                    type="submit"
                    disabled={saving}
                    class="rounded bg-zam-accent px-4 py-2 text-sm font-medium text-white hover:bg-zam-accentHover disabled:opacity-50"
                >
                    {saving ? t("common.saving") : t("widgets.addDialog.add")}
                </button>
            </div>
        </form>
    </ModalDialog>
</Portal>

<script lang="ts">
    import { t } from "$lib/i18n";
    import type { MatrixEvent } from "matrix-js-sdk";
    import { Check, Copy, X } from "lucide-svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import Portal from "$lib/components/ui/Portal.svelte";
    import { closeModal } from "$lib/stores/interface.svelte";

    interface Props {
        event: MatrixEvent;
    }

    let { event }: Props = $props();

    // The clear view (decrypted for an encrypted event, the plain event
    // otherwise) and the wire event as the server delivered it. Both are shown
    // as text, never as HTML, so event content cannot inject markup here.
    const decryptedJson = $derived(
        JSON.stringify(event.getEffectiveEvent(), null, 2),
    );
    const encrypted = $derived(event.isEncrypted());
    const encryptedJson = $derived(
        encrypted ? JSON.stringify(event.event, null, 2) : "",
    );

    let copied = $state<"decrypted" | "encrypted" | null>(null);
    let copiedTimer: ReturnType<typeof setTimeout> | undefined;
    $effect(() => () => clearTimeout(copiedTimer));

    async function copy(which: "decrypted" | "encrypted", text: string) {
        try {
            await navigator.clipboard.writeText(text);
            copied = which;
            clearTimeout(copiedTimer);
            copiedTimer = setTimeout(() => (copied = null), 1500);
        } catch {
            /* clipboard denied (permissions / insecure context): stay silent */
        }
    }
</script>

<Portal>
    <ModalDialog
        onClose={closeModal}
        labelledBy="view-source-title"
        layerClass="z-[90] flex items-center justify-center p-3"
        panelClass="relative flex max-h-[min(720px,90dvh)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-discord-divider bg-discord-backgroundSecondary shadow-2xl"
    >
        <div
            class="flex items-center justify-between border-b border-discord-divider px-4 py-3"
        >
            <h2
                id="view-source-title"
                class="text-base font-semibold text-discord-textPrimary"
            >
                {t("viewSource.title")}
            </h2>
            <button
                type="button"
                onclick={closeModal}
                class="p-1.5 rounded text-discord-textMuted hover:bg-discord-messageHover hover:text-discord-textPrimary"
                aria-label={t("common.close")}
                title={t("common.close")}><X size={20} /></button
            >
        </div>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <section>
                <div class="mb-1.5 flex items-center justify-between gap-2">
                    <h3
                        class="text-xs font-bold uppercase text-discord-textSecondary"
                    >
                        {t("viewSource.decrypted")}
                    </h3>
                    <button
                        type="button"
                        onclick={() => copy("decrypted", decryptedJson)}
                        class="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-discord-textMuted hover:bg-discord-messageHover hover:text-discord-textPrimary"
                    >
                        {#if copied === "decrypted"}
                            <Check size={14} />
                            {t("viewSource.copied")}
                        {:else}
                            <Copy size={14} />
                            {t("common.copy")}
                        {/if}
                    </button>
                </div>
                <pre
                    class="max-h-[40vh] overflow-auto rounded bg-discord-backgroundTertiary p-3 font-mono text-xs leading-relaxed text-discord-textPrimary whitespace-pre">{decryptedJson}</pre>
            </section>

            {#if encrypted}
                <section>
                    <div class="mb-1.5 flex items-center justify-between gap-2">
                        <h3
                            class="text-xs font-bold uppercase text-discord-textSecondary"
                        >
                            {t("viewSource.encrypted")}
                        </h3>
                        <button
                            type="button"
                            onclick={() => copy("encrypted", encryptedJson)}
                            class="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-discord-textMuted hover:bg-discord-messageHover hover:text-discord-textPrimary"
                        >
                            {#if copied === "encrypted"}
                                <Check size={14} />
                                {t("viewSource.copied")}
                            {:else}
                                <Copy size={14} />
                                {t("common.copy")}
                            {/if}
                        </button>
                    </div>
                    <pre
                        class="max-h-[40vh] overflow-auto rounded bg-discord-backgroundTertiary p-3 font-mono text-xs leading-relaxed text-discord-textPrimary whitespace-pre">{encryptedJson}</pre>
                </section>
            {/if}
        </div>
    </ModalDialog>
</Portal>

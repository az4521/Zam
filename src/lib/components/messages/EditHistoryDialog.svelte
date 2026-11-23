<script lang="ts">
    import { t } from "$lib/i18n";
    import { fetchEditHistory } from "$lib/matrix/client";
    import { mxcToHttp } from "$lib/matrix/media";
    import type { EditVersion } from "$lib/utils/editHistory";
    import { fullTimestamp } from "$lib/utils/timeFormat";
    import { sanitizeMatrixHtml } from "$lib/utils/sanitizeHtml";
    import { closeModal } from "$lib/stores/interface.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import { X } from "lucide-svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import Portal from "$lib/components/ui/Portal.svelte";

    interface Props {
        roomId: string;
        eventId: string;
    }

    let { roomId, eventId }: Props = $props();

    type LoadState =
        | { status: "loading" }
        | { status: "ready"; versions: EditVersion[] }
        | { status: "error" };

    let load = $state<LoadState>({ status: "loading" });

    // Fetch once per (room, event). A cancelled run (the dialog closed or the
    // ids changed) must not write its result into the state of a newer run.
    $effect(() => {
        const rid = roomId;
        const eid = eventId;
        let cancelled = false;
        load = { status: "loading" };
        fetchEditHistory(rid, eid).then(
            (versions) => {
                if (!cancelled) load = { status: "ready", versions };
            },
            () => {
                if (cancelled) return;
                load = { status: "error" };
                showErrorToast(t("editHistory.loadFailed"));
            },
        );
        return () => {
            cancelled = true;
        };
    });

    // Newest first for display. The fetch returns oldest first, so the
    // original is the last entry here.
    const newestFirst = $derived(
        load.status === "ready" ? [...load.versions].reverse() : [],
    );
</script>

<Portal>
    <ModalDialog
        onClose={closeModal}
        labelledBy="edit-history-title"
        layerClass="z-[90] flex items-center justify-center p-3"
        panelClass="relative flex max-h-[min(720px,90dvh)] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-zam-divider bg-zam-backgroundSecondary shadow-2xl"
    >
        <div
            class="flex items-center justify-between border-b border-zam-divider px-4 py-3"
        >
            <h2
                id="edit-history-title"
                class="text-base font-semibold text-zam-textPrimary"
            >
                {t("editHistory.title")}
            </h2>
            <button
                type="button"
                onclick={closeModal}
                class="p-1.5 rounded text-zam-textMuted hover:bg-zam-messageHover hover:text-zam-textPrimary"
                aria-label={t("common.close")}
                title={t("common.close")}><X size={20} /></button
            >
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-4">
            {#if load.status === "loading"}
                <p role="status" class="text-sm text-zam-textMuted">
                    {t("editHistory.loading")}
                </p>
            {:else if load.status === "error"}
                <p role="alert" class="text-sm text-zam-textMuted">
                    {t("editHistory.loadFailed")}
                </p>
            {:else if newestFirst.length === 0}
                <p class="text-sm text-zam-textMuted">
                    {t("editHistory.empty")}
                </p>
            {:else}
                <ol class="space-y-3">
                    {#each newestFirst as version, i (version.eventId)}
                        <li
                            class="rounded-md border border-zam-divider bg-zam-backgroundTertiary p-3"
                        >
                            <div class="mb-2 flex flex-wrap items-center gap-2">
                                <time
                                    datetime={new Date(
                                        version.ts,
                                    ).toISOString()}
                                    class="text-xs text-zam-textSecondary"
                                    >{fullTimestamp(version.ts)}</time
                                >
                                {#if i === 0}
                                    <span
                                        class="rounded border border-zam-divider px-1.5 py-0.5 text-xs font-semibold text-zam-textPrimary"
                                        >{t("editHistory.current")}</span
                                    >
                                {/if}
                                {#if i === newestFirst.length - 1}
                                    <span
                                        class="rounded border border-zam-divider px-1.5 py-0.5 text-xs font-semibold text-zam-textSecondary"
                                        >{t("editHistory.original")}</span
                                    >
                                {/if}
                            </div>
                            {#if version.undecryptable}
                                <p class="text-sm italic text-zam-textMuted">
                                    {t("editHistory.undecryptable")}
                                </p>
                            {:else if version.content?.formatted_body}
                                <div
                                    class="text-sm leading-relaxed break-words text-zam-textPrimary"
                                >
                                    {@html sanitizeMatrixHtml(
                                        version.content.formatted_body,
                                        { resolveMxc: mxcToHttp },
                                    )}
                                </div>
                            {:else if version.content?.body}
                                <p
                                    class="whitespace-pre-wrap break-words text-sm leading-relaxed text-zam-textPrimary"
                                >
                                    {version.content.body}
                                </p>
                            {:else}
                                <p class="text-sm italic text-zam-textMuted">
                                    {t("editHistory.noText")}
                                </p>
                            {/if}
                        </li>
                    {/each}
                </ol>
            {/if}
        </div>
    </ModalDialog>
</Portal>

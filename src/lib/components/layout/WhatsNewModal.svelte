<script lang="ts">
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import {
        APP_VERSION,
        fetchReleaseNotes,
        openReleasePage,
    } from "$lib/update";
    import { GITHUB_OWNER, GITHUB_REPO } from "$lib/utils/androidUpdate";
    import ReleaseNotesBody from "$lib/components/settings/ReleaseNotesBody.svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import { openModal, clearModalIfOwner } from "$lib/stores/interface.svelte";

    let { onClose }: { onClose: () => void } = $props();

    let body = $state<string | null>(null);
    let loading = $state(true);
    let failed = $state(false);

    onMount(() => {
        const token = openModal("whats-new", onClose);

        void (async () => {
            try {
                body = await fetchReleaseNotes(APP_VERSION);
            } catch {
                failed = true;
            } finally {
                loading = false;
            }
        })();

        return () => {
            clearModalIfOwner(token);
        };
    });
</script>

<ModalDialog
    {onClose}
    label={t("whatsNewModal.whatSNew")}
    layerClass="z-[60] flex items-center justify-center p-4"
    backdropClass="bg-black/50"
    panelClass="relative w-full max-w-md rounded-lg bg-discord-backgroundSecondary shadow-xl flex flex-col max-h-[80vh]"
>
    <header
        class="flex items-center justify-between border-b border-discord-divider px-4 py-3 flex-shrink-0"
    >
        <h2 class="text-base font-semibold text-discord-textPrimary">
            {t("whatsNewModal.whatSNewInV", { APP_VERSION })}
        </h2>
        <button
            type="button"
            onclick={onClose}
            aria-label={t("common.close")}
            class="text-discord-textMuted hover:text-discord-textPrimary text-lg leading-none px-1"
        >
            ✕
        </button>
    </header>
    <div class="overflow-y-auto px-4 py-3 flex-1 min-h-0">
        {#if loading}
            <p class="text-sm text-discord-textMuted">{t("common.loading")}</p>
        {:else if failed}
            <p class="text-sm text-discord-textMuted">
                {t("whatsNewModal.releaseNotesUnavailable")}
                <button
                    type="button"
                    class="underline"
                    onclick={() =>
                        openReleasePage(
                            `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
                        )}
                >
                    {t("whatsNewModal.viewOnGithub")}
                </button>
            </p>
        {:else}
            <ReleaseNotesBody body={body ?? ""} />
        {/if}
    </div>
    <footer
        class="flex justify-end border-t border-discord-divider px-4 py-3 flex-shrink-0"
    >
        <button
            type="button"
            onclick={onClose}
            class="px-4 py-2 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors"
        >
            {t("whatsNewModal.gotIt")}
        </button>
    </footer>
</ModalDialog>

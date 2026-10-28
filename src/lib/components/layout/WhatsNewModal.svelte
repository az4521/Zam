<script lang="ts">
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import {
        APP_VERSION,
        fetchReleaseList,
        fetchReleaseNotes,
        openReleasePage,
    } from "$lib/update";
    import { releasesBetween, normalizeVersion } from "$lib/utils/changelog";
    import { GITHUB_OWNER, GITHUB_REPO } from "$lib/utils/androidUpdate";
    import ReleaseNotesBody from "$lib/components/settings/ReleaseNotesBody.svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import { openModal, clearModalIfOwner } from "$lib/stores/interface.svelte";

    let {
        onClose,
        lastSeen = null,
    }: { onClose: () => void; lastSeen?: string | null } = $props();

    // Every release since the one last seen, newest first; empty when only
    // the current version's notes could be had.
    let sections = $state<{ version: string; body: string }[]>([]);
    let body = $state<string | null>(null);
    let loading = $state(true);
    let failed = $state(false);

    onMount(() => {
        const token = openModal("whats-new", onClose);

        void (async () => {
            try {
                try {
                    sections = releasesBetween(
                        await fetchReleaseList(30),
                        lastSeen,
                        APP_VERSION,
                    ).map((r) => ({
                        version: normalizeVersion(r.tag_name),
                        body: r.body,
                    }));
                } catch {
                    // Fall back to just this version's notes below.
                }
                if (sections.length === 0) {
                    body = await fetchReleaseNotes(APP_VERSION);
                }
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
    panelClass="relative w-full max-w-lg rounded-lg bg-discord-backgroundSecondary shadow-xl flex flex-col max-h-[80vh]"
>
    <header
        class="flex items-center justify-between border-b border-discord-divider px-4 py-3 flex-shrink-0"
    >
        <h2 class="text-base font-semibold text-discord-textPrimary">
            {sections.length > 1 && lastSeen
                ? t("whatsNewModal.whatSNewSince", {
                      from: normalizeVersion(lastSeen),
                      APP_VERSION,
                  })
                : t("whatsNewModal.whatSNewInV", { APP_VERSION })}
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
        {:else if sections.length > 0}
            {#each sections as section (section.version)}
                {#if sections.length > 1}
                    <h3
                        class="text-sm font-semibold text-discord-textPrimary mt-3 first:mt-0 mb-1"
                    >
                        v{section.version}
                    </h3>
                {/if}
                <ReleaseNotesBody body={section.body} />
            {/each}
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

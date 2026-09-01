<script lang="ts">
    import { onMount } from "svelte";
    import {
        APP_VERSION,
        fetchReleaseNotes,
        openReleasePage,
    } from "$lib/update";
    import { GITHUB_OWNER, GITHUB_REPO } from "$lib/utils/androidUpdate";
    import ReleaseNotesBody from "$lib/components/settings/ReleaseNotesBody.svelte";

    let { onClose }: { onClose: () => void } = $props();

    let body = $state<string | null>(null);
    let loading = $state(true);
    let failed = $state(false);

    onMount(async () => {
        try {
            body = await fetchReleaseNotes(APP_VERSION);
        } catch {
            failed = true;
        } finally {
            loading = false;
        }
    });

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") onClose();
    }
</script>

<svelte:window onkeydown={onKeydown} />

<div
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
    onclick={onClose}
    role="presentation"
>
    <div
        class="w-full max-w-md rounded-lg bg-discord-backgroundSecondary shadow-xl flex flex-col max-h-[80vh]"
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="What's New"
    >
        <header
            class="flex items-center justify-between border-b border-discord-divider px-4 py-3 flex-shrink-0"
        >
            <h2 class="text-base font-semibold text-discord-textPrimary">
                What's New in v{APP_VERSION}
            </h2>
            <button
                type="button"
                onclick={onClose}
                aria-label="Close"
                class="text-discord-textMuted hover:text-discord-textPrimary text-lg leading-none px-1"
            >
                ✕
            </button>
        </header>
        <div class="overflow-y-auto px-4 py-3 flex-1 min-h-0">
            {#if loading}
                <p class="text-sm text-discord-textMuted">Loading…</p>
            {:else if failed}
                <p class="text-sm text-discord-textMuted">
                    Release notes unavailable.
                    <button
                        type="button"
                        class="underline"
                        onclick={() =>
                            openReleasePage(
                                `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
                            )}
                    >
                        View on GitHub
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
                Got it
            </button>
        </footer>
    </div>
</div>

<script lang="ts">
    // Electron-only. The main process arbitrates getDisplayMedia() and pushes
    // the screen/window list here; this dialog collects the choice and sends it
    // back. It deliberately does NOT join the shared modal slot: it exists only
    // on desktop (no mobile back button to route), it is driven by a main-process
    // request rather than by app navigation, and it must be dismissable even if
    // another layer holds the slot.
    import Portal from "$lib/components/ui/Portal.svelte";
    import { focusTrap } from "$lib/actions/focusTrap";
    import {
        onScreenShareRequest,
        onScreenShareCancel,
        respondToScreenShare,
    } from "$lib/desktopScreenShare";
    import {
        shapeDisplaySources,
        groupDisplaySources,
        type DisplaySource,
    } from "$lib/utils/displaySources";

    let requestId = $state<number | null>(null);
    let sources = $state<DisplaySource[]>([]);

    const groups = $derived(groupDisplaySources(sources));

    // Subscribe once on mount; no reactive reads, so this effect never re-runs.
    $effect(() => {
        const unsubRequest = onScreenShareRequest((req) => {
            requestId = req.requestId;
            sources = shapeDisplaySources(req.sources);
        });
        const unsubCancel = onScreenShareCancel((id) => {
            if (requestId === id) close();
        });
        return () => {
            unsubRequest();
            unsubCancel();
        };
    });

    function close() {
        requestId = null;
        sources = [];
    }

    function pick(source: DisplaySource) {
        if (requestId === null) return;
        respondToScreenShare(requestId, source.id, source.name);
        close();
    }

    function cancel() {
        if (requestId === null) return;
        respondToScreenShare(requestId, null);
        close();
    }
</script>

{#if requestId !== null}
    <Portal>
        <div
            class="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4"
            role="presentation"
            onclick={(e) => {
                if (e.target === e.currentTarget) cancel();
            }}
        >
            <div
                class="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-discord-backgroundSecondary shadow-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="screenshare-picker-title"
                use:focusTrap={{ onEscape: cancel }}
            >
                <div class="border-b border-discord-divider px-4 py-3">
                    <h2
                        id="screenshare-picker-title"
                        class="text-base font-semibold text-discord-textPrimary"
                    >
                        Choose what to share
                    </h2>
                </div>

                <div class="flex-1 overflow-y-auto px-4 py-3">
                    {#each [{ label: "Screens", items: groups.screens }, { label: "Windows", items: groups.windows }] as group (group.label)}
                        {#if group.items.length}
                            <h3
                                class="mb-2 mt-1 text-xs font-semibold uppercase tracking-wide text-discord-textMuted"
                            >
                                {group.label}
                            </h3>
                            <div
                                class="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3"
                            >
                                {#each group.items as source (source.id)}
                                    <button
                                        type="button"
                                        class="group flex flex-col overflow-hidden rounded border border-transparent bg-discord-background text-left hover:border-discord-accent focus-visible:border-discord-accent"
                                        onclick={() => pick(source)}
                                    >
                                        <div
                                            class="flex aspect-video w-full items-center justify-center bg-black/40"
                                        >
                                            {#if source.thumbnailDataUrl}
                                                <img
                                                    src={source.thumbnailDataUrl}
                                                    alt=""
                                                    class="max-h-full max-w-full object-contain"
                                                />
                                            {:else}
                                                <span
                                                    class="text-xs text-discord-textMuted"
                                                    >No preview</span
                                                >
                                            {/if}
                                        </div>
                                        <span
                                            class="truncate px-2 py-1.5 text-xs text-discord-textSecondary group-hover:text-discord-textPrimary"
                                            title={source.name}
                                        >
                                            {source.name}
                                        </span>
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    {/each}
                </div>

                <div
                    class="flex justify-end gap-2 border-t border-discord-divider px-4 py-3"
                >
                    <button
                        type="button"
                        class="rounded px-4 py-2 text-sm text-discord-textSecondary hover:text-discord-textPrimary"
                        onclick={cancel}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    </Portal>
{/if}

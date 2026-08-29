<script lang="ts">
    import { pluginRegistry } from "$lib/stores/plugins.svelte";
    import { mergeComposerActions } from "$lib/utils/pluginComposer";

    interface Props {
        roomId: string;
        onClose: () => void;
        onUpload: () => void;
        onCreatePoll: () => void;
        onRecordVoice?: () => void;
        onShareLocation?: () => void;
        onCreateThread?: () => void;
    }
    let {
        roomId,
        onClose,
        onUpload,
        onCreatePoll,
        onRecordVoice,
        onShareLocation,
        onCreateThread,
    }: Props = $props();

    const FALLBACK_ICON =
        "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm1 10h-2v-6h2v6z";
    const items = $derived.by(() => {
        void pluginRegistry.tick;
        const core = [
            {
                key: "upload",
                label: "Upload a file",
                run: () => onUpload(),
                icon: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
            },
            {
                key: "poll",
                label: "Create poll",
                run: () => onCreatePoll(),
                icon: "M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z",
            },
            ...(onRecordVoice
                ? [
                      {
                          key: "voice",
                          label: "Record voice message",
                          run: () => onRecordVoice?.(),
                          icon: "M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z",
                      },
                  ]
                : []),
            ...(onShareLocation
                ? [
                      {
                          key: "location",
                          label: "Share location",
                          run: () => onShareLocation?.(),
                          icon: "M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z",
                      },
                  ]
                : []),
            ...(onCreateThread
                ? [
                      {
                          key: "thread",
                          label: "Create thread",
                          run: () => onCreateThread?.(),
                          icon: "M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z",
                      },
                  ]
                : []),
        ];
        return mergeComposerActions(
            core,
            pluginRegistry.composerActions,
            roomId,
        ).map((item) => ({ ...item, icon: item.icon || FALLBACK_ICON }));
    });
    function choose(run: () => void | Promise<void>) {
        // Close this menu FIRST — it shares the single modal slot, so if `run`
        // opens another modal (e.g. the create-poll dialog), closing afterwards
        // would tear that freshly-opened modal right back down.
        onClose();
        try {
            const r = run();
            if (r && typeof (r as Promise<void>).then === "function")
                (r as Promise<void>).catch((err) =>
                    console.error("[zam] composer action threw", err),
                );
        } catch (err) {
            console.error("[zam] composer action threw", err);
        }
    }
</script>

<div
    class="w-52 bg-discord-backgroundSecondary border border-discord-divider rounded-lg overflow-hidden shadow-lg py-1"
    role="menu"
>
    {#each items as item ((item as any).entryId ?? item.key)}
        <button
            role="menuitem"
            onclick={() => choose(item.run)}
            class="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
        >
            <svg
                class="w-5 h-5 text-discord-textMuted flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"><path d={item.icon} /></svg
            >
            {item.label}
        </button>
    {/each}
</div>

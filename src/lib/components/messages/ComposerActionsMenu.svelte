<script lang="ts">
    import { t } from "$lib/i18n";
    import { pluginRegistry } from "$lib/stores/plugins.svelte";
    import { mergeComposerActions } from "$lib/utils/pluginComposer";
    import { invitableGames } from "$lib/stores/richPresence.svelte";

    interface Props {
        roomId: string;
        onClose: () => void;
        onUpload: () => void;
        onPickPhotos?: () => void;
        onTakePhoto?: () => void;
        onSendDirectly?: () => void;
        onCreatePoll: () => void;
        onRecordVoice?: () => void;
        onShareLocation?: () => void;
        onCreateThread?: () => void;
        onInviteToGame?: () => void;
    }
    let {
        roomId,
        onClose,
        onUpload,
        onPickPhotos,
        onTakePhoto,
        onSendDirectly,
        onCreatePoll,
        onRecordVoice,
        onShareLocation,
        onCreateThread,
        onInviteToGame,
    }: Props = $props();

    const FALLBACK_ICON =
        "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm1 10h-2v-6h2v6z";
    const items = $derived.by(() => {
        void pluginRegistry.tick;
        const core = [
            ...(onTakePhoto
                ? [
                      {
                          key: "camera",
                          label: t("composerActionsMenu.camera"),
                          run: () => onTakePhoto?.(),
                          icon: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM9 2 7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10z",
                      },
                  ]
                : []),
            ...(onPickPhotos
                ? [
                      {
                          key: "photos",
                          label: t("composerActionsMenu.photosAndVideos"),
                          run: () => onPickPhotos?.(),
                          icon: "M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z",
                      },
                  ]
                : []),
            {
                key: "upload",
                label: onPickPhotos
                    ? t("composerActionsMenu.files")
                    : t("composerActionsMenu.uploadAFile"),
                run: () => onUpload(),
                icon: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
            },
            ...(onSendDirectly
                ? [
                      {
                          key: "direct",
                          label: t("composerActionsMenu.sendFileDirectly"),
                          run: () => onSendDirectly?.(),
                          icon: "M2 21l21-9L2 3v7l15 2-15 2v7z",
                      },
                  ]
                : []),
            {
                key: "poll",
                label: t("composerActionsMenu.createPoll"),
                run: () => onCreatePoll(),
                icon: "M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z",
            },
            // Only with a running game someone could be invited to.
            ...(onInviteToGame && invitableGames().length > 0
                ? [
                      {
                          key: "invite-game",
                          label: t("composerActionsMenu.inviteToGame"),
                          run: () => onInviteToGame?.(),
                          icon: "M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
                      },
                  ]
                : []),
            ...(onRecordVoice
                ? [
                      {
                          key: "voice",
                          label: t("composerActionsMenu.recordVoiceMessage"),
                          run: () => onRecordVoice?.(),
                          icon: "M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z",
                      },
                  ]
                : []),
            ...(onShareLocation
                ? [
                      {
                          key: "location",
                          label: t("composerActionsMenu.shareLocation"),
                          run: () => onShareLocation?.(),
                          icon: "M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z",
                      },
                  ]
                : []),
            ...(onCreateThread
                ? [
                      {
                          key: "thread",
                          label: t("composerActionsMenu.createThread"),
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
    {#each items as item ("entryId" in item ? item.entryId : item.key)}
        <button
            role="menuitem"
            onclick={() => choose(item.run)}
            class="w-full flex items-center gap-2.5 px-3 py-2 text-start text-sm text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
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

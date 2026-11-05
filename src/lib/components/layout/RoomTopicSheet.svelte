<script lang="ts">
    import { t } from "$lib/i18n";
    import Portal from "$lib/components/ui/Portal.svelte";
    import BottomSheet from "$lib/components/ui/BottomSheet.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { linkifyPlainText } from "$lib/utils/matrixLinks";
    import { renderPlainTextWithTwemoji } from "$lib/utils/twemojiText";

    interface Props {
        roomId: string;
        roomName: string;
        avatarSrc?: string | null;
        topic: string;
        onClose: () => void;
    }
    let {
        roomId,
        roomName,
        avatarSrc = null,
        topic,
        onClose,
    }: Props = $props();

    // Topics are plain text (m.room.topic). Escape first — linkifyPlainText
    // requires escaped input — then turn URLs / matrix identifiers into
    // anchors. Newlines are kept by whitespace-pre-wrap on the container.
    const topicHtml = $derived(
        linkifyPlainText(
            topic
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;"),
        ).replace(
            /<a href=/g,
            '<a target="_blank" rel="noopener noreferrer" href=',
        ),
    );
</script>

<Portal>
    <BottomSheet {onClose}>
        <div class="px-4 pb-4 pt-1 max-h-[70vh] overflow-y-auto">
            <div class="flex items-center gap-3 mb-3">
                <Avatar src={avatarSrc} name={roomName} id={roomId} size={40} />
                <h2
                    class="font-semibold text-discord-textPrimary break-words min-w-0"
                >
                    {@html renderPlainTextWithTwemoji(roomName)}
                </h2>
            </div>
            <p
                class="text-xs font-semibold uppercase text-discord-textMuted mb-1"
            >
                {t("roomTopicSheet.description")}
            </p>
            <div
                class="text-sm text-discord-textPrimary whitespace-pre-wrap break-words [&_a]:text-discord-accent [&_a]:underline"
            >
                {@html topicHtml}
            </div>
        </div>
    </BottomSheet>
</Portal>

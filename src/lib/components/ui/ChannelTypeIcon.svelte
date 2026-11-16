<script lang="ts">
    // The icon in front of a channel's name, Discord style: # for text, a
    // speaker for voice, and so on (kinds from utils/bridgedChannels.ts).
    import { t } from "$lib/i18n";
    import type { ChannelIconKind } from "$lib/utils/bridgedChannels";
    import {
        Hash,
        Image,
        Megaphone,
        MessageSquareLock,
        MessageSquareText,
        MessagesSquare,
        Radio,
        Video,
        Volume2,
    } from "lucide-svelte";

    interface Props {
        kind: ChannelIconKind;
        size?: number;
        class?: string;
    }

    let { kind, size = 14, class: className = "" }: Props = $props();

    const Icon = $derived(
        {
            text: Hash,
            video: Video,
            voice: Volume2,
            stage: Radio,
            announcement: Megaphone,
            forum: MessageSquareText,
            media: Image,
            thread: MessagesSquare,
            private_thread: MessageSquareLock,
        }[kind],
    );
    // Text channels are the default and go unlabelled, as before.
    const label = $derived(
        {
            text: null,
            video: t("common.videoRoom"),
            voice: t("bridgedChannels.voice"),
            stage: t("bridgedChannels.stage"),
            announcement: t("bridgedChannels.announcement"),
            forum: t("bridgedChannels.forum"),
            media: t("bridgedChannels.media"),
            thread: t("bridgedThreads.thread"),
            private_thread: t("bridgedChannels.privateThread"),
        }[kind],
    );
</script>

<span
    class="flex items-center justify-center {className}"
    role={label ? "img" : undefined}
    aria-label={label ?? undefined}
    aria-hidden={label ? undefined : "true"}
    title={label ?? undefined}
>
    <Icon {size} />
</span>

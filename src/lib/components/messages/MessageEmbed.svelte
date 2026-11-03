<script lang="ts">
    import { t } from "$lib/i18n";
    import type { MatrixEvent, Room } from "matrix-js-sdk";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import {
        fetchSingleEvent,
        findEventById,
        getMemberAvatar,
        getMemberName,
        getRoom,
        getRoomDisplayName,
        getRoomIdForAlias,
    } from "$lib/matrix/client";
    import { messagesState } from "$lib/stores/messages.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { eventPreviewText } from "$lib/utils/eventPreviewText";
    import type { EventPermalink } from "$lib/utils/matrixLinks";
    import { fullTimestamp, messageTimestamp } from "$lib/utils/timeFormat";

    interface Props {
        link: EventPermalink;
        /** The room the linking message is in; its name is not repeated. */
        currentRoomId: string;
        onOpen: () => void;
    }

    let { link, currentRoomId, onOpen }: Props = $props();

    // The linked message, from the loaded timeline when we have it, else
    // fetched on its own. A room we are not in (and that is not world-readable)
    // refuses the fetch: then nothing renders and the link stays a plain link.
    let roomId = $state<string | null>(null);
    let target = $state<MatrixEvent | null>(null);
    $effect(() => {
        const l = link;
        roomId = null;
        target = null;
        let cancelled = false;
        (async () => {
            const id =
                l.kind === "room"
                    ? l.roomId
                    : (await getRoomIdForAlias(l.alias)).roomId;
            if (cancelled) return;
            roomId = id;
            const local = getRoom(id);
            const ev =
                (local && findEventById(local, l.eventId)) ??
                (await fetchSingleEvent(id, l.eventId));
            if (!cancelled) target = ev;
        })().catch((err) => {
            if (!cancelled) console.warn("Could not load linked message:", err);
        });
        return () => {
            cancelled = true;
        };
    });

    const room = $derived.by((): Room | null => {
        void roomsState.roomsTick;
        return roomId ? getRoom(roomId) : null;
    });
    const sender = $derived(target?.getSender() ?? "");
    const senderName = $derived.by(() => {
        void roomsState.roomsTick;
        return room ? getMemberName(room, sender) : sender;
    });
    const senderAvatar = $derived.by(() => {
        void roomsState.roomsTick;
        return room ? getMemberAvatar(room, sender) : null;
    });
    const roomLabel = $derived.by(() => {
        if (!roomId || roomId === currentRoomId) return null;
        if (room) return getRoomDisplayName(room);
        return link.kind === "alias" ? link.alias : null;
    });
    // Reads timelineTick: an encrypted message decrypts in place on the same
    // MatrixEvent, and the decryption bumps the tick (as for reply quotes).
    const text = $derived.by(() => {
        void messagesState.timelineTick;
        if (!target) return null;
        if (target.isRedacted()) return t("messageEmbed.deleted");
        return eventPreviewText(target);
    });
</script>

{#if target && text}
    <button
        type="button"
        class="mt-2 flex w-full max-w-lg text-start rounded overflow-hidden border border-discord-divider bg-discord-backgroundSecondary hover:bg-discord-messageHover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-discord-accent"
        onclick={(e) => {
            e.preventDefault();
            onOpen();
        }}
    >
        <span class="sr-only">{t("messageEmbed.jumpToMessage")}</span>
        <div class="w-1 flex-shrink-0 bg-discord-accent"></div>
        <div class="flex flex-1 min-w-0 flex-col p-2.5 gap-1">
            <div class="flex items-center gap-1.5 min-w-0">
                <Avatar
                    src={senderAvatar}
                    name={senderName}
                    id={sender}
                    size={18}
                />
                <span
                    class="text-xs font-semibold text-discord-textPrimary truncate"
                    >{senderName}</span
                >
                {#if roomLabel}
                    <span class="text-xs text-discord-textMuted truncate"
                        >{t("messageEmbed.inRoom", { room: roomLabel })}</span
                    >
                {/if}
                <span
                    class="text-xs text-discord-textMuted flex-shrink-0 ms-auto"
                    title={fullTimestamp(target.getTs())}
                    >{messageTimestamp(target.getTs())}</span
                >
            </div>
            <p
                dir="auto"
                class="text-sm text-discord-textSecondary leading-snug line-clamp-4 whitespace-pre-wrap break-words"
                class:italic={target.isRedacted()}
            >
                {text}
            </p>
        </div>
    </button>
{/if}

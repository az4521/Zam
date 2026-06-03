<script lang="ts">
    import type { MatrixEvent } from "matrix-js-sdk";
    import {
        getRoom,
        getRoomDisplayName,
        getMemberName,
        getMemberAvatar,
        mxcToHttp,
        fetchServerNotifications,
        onTimelineEvent,
        type ServerNotification,
    } from "$lib/matrix/client";
    import {
        getAllLoudNotifications,
        notificationsState,
        clearAllForRoom,
        type LoudNotification,
    } from "$lib/stores/notifications.svelte";
    import { navigateToRoom } from "$lib/stores/rooms.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { format } from "date-fns";

    interface Props {
        onClose: () => void;
        onJumpTo: (roomId: string, eventId: string) => void;
    }

    let { onClose, onJumpTo }: Props = $props();

    // null = not yet checked, "yes" = supported, "no" = not supported
    let serverSupport = $state<"unknown" | "yes" | "no">("unknown");
    let serverNotifications = $state<ServerNotification[]>([]);
    let loading = $state(true);

    async function refresh() {
        loading = true;
        const res = await fetchServerNotifications(100);
        if (res === null) {
            serverSupport = "no";
        } else {
            serverSupport = "yes";
            // Filter to only notifications with a sound tweak — that's our "loud" set.
            serverNotifications = res.notifications.filter((n) =>
                (n.actions ?? []).some(
                    (a: any) => a?.set_tweak === "sound",
                ),
            );
        }
        loading = false;
    }

    $effect(() => {
        refresh();
        const unsub = onTimelineEvent(() => {
            if (serverSupport === "yes") refresh();
        });
        return () => unsub();
    });

    interface DisplayItem {
        roomId: string;
        eventId: string;
        ts: number;
        sender: string;
        body: string;
        read: boolean;
    }

    function fromServer(n: ServerNotification): DisplayItem {
        const e = n.event as MatrixEvent;
        const content = e.getContent() as any;
        return {
            roomId: n.room_id,
            eventId: e.getId() ?? "",
            ts: n.ts,
            sender: e.getSender() ?? "",
            body: typeof content?.body === "string" ? content.body : "",
            read: n.read,
        };
    }
    function fromLocal(n: LoudNotification): DisplayItem {
        return { ...n, read: false };
    }

    const items = $derived.by(() => {
        void notificationsState.tick;
        if (serverSupport === "yes") {
            return serverNotifications.map(fromServer);
        }
        return getAllLoudNotifications().map(fromLocal);
    });

    function jump(roomId: string, eventId: string) {
        navigateToRoom(roomId);
        onJumpTo(roomId, eventId);
        onClose();
    }

    function clearLocal() {
        for (const roomId of Object.keys(notificationsState.byRoom)) {
            clearAllForRoom(roomId);
        }
    }
</script>

<div
    class="{interfaceState.isMobile
        ? ''
        : 'w-80'} h-full flex flex-col bg-discord-backgroundSecondary border-l border-discord-divider"
>
    <div
        class="h-12 flex items-center gap-2 px-4 py-3 border-b border-discord-divider flex-shrink-0"
    >
        <h3
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide flex-1"
        >
            Notifications
        </h3>
        {#if serverSupport === "no" && items.length > 0}
            <button
                onclick={clearLocal}
                class="text-xs text-discord-textMuted hover:text-discord-textPrimary"
                title="Clear all"
            >
                Clear all
            </button>
        {/if}
    </div>

    <div class="flex-1 overflow-y-auto">
        {#if loading && serverSupport === "unknown"}
            <div class="flex justify-center mt-8">
                <div
                    class="w-5 h-5 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"
                ></div>
            </div>
        {:else if items.length === 0}
            <p class="text-sm text-discord-textMuted text-center mt-8 px-4">
                No notifications.
            </p>
        {:else}
            <div class="p-2 space-y-1">
                {#each items as n (n.eventId)}
                    {@const room = getRoom(n.roomId)}
                    {@const roomName = room
                        ? getRoomDisplayName(room)
                        : n.roomId}
                    {@const avatarUrl = room
                        ? mxcToHttp(getMemberAvatar(room, n.sender))
                        : null}
                    {@const name = room
                        ? getMemberName(room, n.sender)
                        : n.sender}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        onclick={() => jump(n.roomId, n.eventId)}
                        class="p-2 rounded-lg hover:bg-discord-messageHover transition-colors cursor-pointer border-l-2 {n.read
                            ? 'border-yellow-500/30 opacity-60'
                            : 'border-yellow-500/70'}"
                    >
                        <div class="flex items-center gap-2 mb-1">
                            <Avatar src={avatarUrl} {name} size={18} />
                            <span
                                class="text-xs font-semibold text-discord-textPrimary truncate"
                                >{name}</span
                            >
                            <span
                                class="text-xs text-discord-textMuted ml-auto flex-shrink-0"
                                >{format(n.ts, "MMM d, HH:mm")}</span
                            >
                        </div>
                        <p
                            class="text-xs text-discord-textMuted truncate mb-1"
                        >
                            in #{roomName}
                        </p>
                        <p
                            class="text-xs text-discord-textPrimary line-clamp-3 break-words"
                        >
                            {n.body || "(message)"}
                        </p>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

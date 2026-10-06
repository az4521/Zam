<script lang="ts">
    import { t } from "$lib/i18n";
    import type { Room } from "matrix-js-sdk";
    import {
        getRoomThreads,
        ensureThreadsLoaded,
        onThreadsUpdated,
        getMemberName,
        getMemberAvatar,
    } from "$lib/matrix/client";
    import {
        buildThreadListItems,
        filterThreadListItems,
        type ThreadListFilter,
    } from "$lib/utils/threadList";
    import { threadBadgeState } from "$lib/utils/threadUnread";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { pinnedDate } from "$lib/utils/timeFormat";
    import { Circle } from "lucide-svelte";

    interface Props {
        room: Room;
        onClose: () => void;
        onOpenThread: (rootId: string) => void;
    }

    let { room, onClose, onOpenThread }: Props = $props();

    let threadsTick = $state(0);
    let loading = $state(true);
    let retryTick = $state(0);
    let filter = $state<ThreadListFilter>("all");

    // Load server-backed thread timeline sets (feature-detected) on room change.
    // On failure, surface a toast with a Retry (F6) rather than leaving the list
    // silently empty; the list still renders any sync-known threads.
    $effect(() => {
        void room.roomId;
        void retryTick;
        loading = true;
        ensureThreadsLoaded(room)
            .catch((err) => {
                console.error("Failed to load room threads:", err);
                showErrorToast(
                    t("threadsListPanel.couldnTLoadThreadsForThis"),
                    {
                        label: t("common.retry"),
                        run: () => retryTick++,
                    },
                );
            })
            .finally(() => {
                loading = false;
                threadsTick++;
            });
    });

    // Re-read the list on any thread lifecycle change in this room.
    $effect(() => {
        const unsub = onThreadsUpdated(room, () => threadsTick++);
        return unsub;
    });

    const allItems = $derived.by(() => {
        threadsTick;
        void roomsState.unreadTick;
        return buildThreadListItems(getRoomThreads(room));
    });
    const items = $derived(filterThreadListItems(allItems, filter));
</script>

<div
    class="{interfaceState.isMobile
        ? ''
        : 'w-72'} h-full flex flex-col bg-discord-backgroundSecondary border-l border-discord-divider"
>
    <div
        class="h-12 flex items-center gap-2 px-4 py-3 border-b border-discord-divider flex-shrink-0"
    >
        <h3
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide flex-1"
        >
            {t("threadsListPanel.threads")}
        </h3>
        <button
            onclick={onClose}
            class="text-discord-textMuted hover:text-discord-textPrimary transition-colors"
            title={t("common.close")}
            aria-label={t("threadsListPanel.closeThreadsPanel")}
        >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"
                ><path
                    d="M18.3 5.71 12 12.01l-6.3-6.3-1.42 1.42 6.3 6.3-6.3 6.3 1.42 1.42 6.3-6.3 6.3 6.3 1.42-1.42-6.3-6.3 6.3-6.3z"
                /></svg
            >
        </button>
    </div>

    <div
        class="flex gap-1 px-2 py-2 border-b border-discord-divider flex-shrink-0"
        role="group"
        aria-label={t("threadsListPanel.filterThreads")}
    >
        {#each [{ value: "all", label: t("threadsListPanel.allThreads") }, { value: "mine", label: t("threadsListPanel.myThreads") }] as opt (opt.value)}
            <button
                onclick={() => (filter = opt.value as ThreadListFilter)}
                aria-pressed={filter === opt.value}
                class="flex-1 px-2 py-1 rounded text-xs font-medium transition-colors {filter ===
                opt.value
                    ? 'bg-discord-messageHover text-discord-textPrimary'
                    : 'text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover'}"
                >{opt.label}</button
            >
        {/each}
    </div>

    <div class="flex-1 overflow-y-auto">
        {#if loading && allItems.length === 0}
            <div class="flex justify-center mt-8">
                <div
                    class="w-5 h-5 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"
                ></div>
            </div>
        {:else if items.length === 0}
            <p class="text-sm text-discord-textMuted text-center mt-8 px-4">
                {filter === "mine" && allItems.length > 0
                    ? t("threadsListPanel.noThreadsYouParticipatedIn")
                    : t("threadsListPanel.noThreadsInThisRoomYet")}
            </p>
        {:else}
            <div class="p-2 space-y-1">
                {#each items as item (item.rootId)}
                    {@const senderName = item.rootSenderId
                        ? getMemberName(room, item.rootSenderId)
                        : t("threadsListPanel.unknownSender")}
                    {@const avatarUrl = item.rootSenderId
                        ? getMemberAvatar(room, item.rootSenderId)
                        : null}
                    {@const badge = threadBadgeState({
                        total: item.unreadTotal,
                        highlight: item.unreadHighlight,
                    })}
                    <button
                        onclick={() => {
                            onOpenThread(item.rootId);
                            onClose();
                        }}
                        class="w-full text-start p-2 rounded-lg hover:bg-discord-messageHover transition-colors"
                    >
                        <div class="flex items-center gap-2 mb-1">
                            <Avatar
                                src={avatarUrl}
                                name={senderName}
                                id={item.rootSenderId ?? ""}
                                size={18}
                            />
                            <span
                                class="text-xs font-semibold text-discord-textPrimary truncate"
                                >{senderName}</span
                            >
                            {#if item.participated}
                                <span
                                    role="img"
                                    aria-label={t(
                                        "threadsListPanel.youParticipated",
                                    )}
                                    class="text-discord-accent flex-shrink-0 flex items-center"
                                    title={t(
                                        "threadsListPanel.youParticipated",
                                    )}
                                >
                                    <Circle size={8} fill="currentColor" />
                                </span>
                            {/if}
                            {#if badge === "mention"}
                                <span
                                    class="ms-auto flex-shrink-0 bg-discord-danger text-white text-xs font-bold rounded-full px-1.5 min-w-[1.2rem] text-center"
                                    title={t("threadsListPanel.unreadMentions")}
                                    >{item.unreadHighlight > 99
                                        ? "99+"
                                        : item.unreadHighlight}</span
                                >
                            {:else if badge === "unread"}
                                <span
                                    class="ms-auto flex-shrink-0 w-2 h-2 rounded-full bg-discord-accent"
                                    title={t("threadsListPanel.unreadReplies")}
                                ></span>
                            {/if}
                            <span
                                class="text-xs text-discord-textMuted {badge ===
                                'none'
                                    ? 'ms-auto'
                                    : 'ms-2'} flex-shrink-0"
                                >{pinnedDate(item.latestTs)}</span
                            >
                        </div>
                        {#if item.name}
                            <p
                                class="text-sm font-semibold text-discord-textPrimary truncate"
                            >
                                {item.name}
                            </p>
                        {/if}
                        <p
                            class="text-xs text-discord-textMuted break-words {item.name
                                ? 'line-clamp-1'
                                : 'line-clamp-2'}"
                        >
                            {item.rootPreview}
                        </p>
                        <div
                            class="flex items-center gap-1 mt-1 text-xs text-discord-textMuted"
                        >
                            <span class="text-discord-accent"
                                >{t("common.replyCount", {
                                    count: item.replyCount,
                                })}</span
                            >
                            <span>·</span>
                            <span class="truncate">{item.latestPreview}</span>
                        </div>
                    </button>
                {/each}
            </div>
        {/if}
    </div>
</div>

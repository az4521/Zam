<script lang="ts">
    import { t } from "$lib/i18n";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import {
        getRoomAvatar,
        getRoomDisplayName,
        getRoomTopic,
        acceptInvite,
        rejectInvite,
        cancelKnock,
        getInviteSender,
    } from "$lib/matrix/client";
    import { roomsState, setActiveRoom } from "$lib/stores/rooms.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import { renderPlainTextWithTwemoji } from "$lib/utils/twemojiText";

    interface Props {
        isMobile?: boolean;
        onMenuOpen?: () => void;
    }

    let { isMobile = false, onMenuOpen }: Props = $props();

    let busyIds = $state(new Set<string>());

    async function accept(roomId: string) {
        busyIds = new Set([...busyIds, roomId]);
        try {
            await acceptInvite(roomId);
            setActiveRoom(roomId);
        } catch (e) {
            console.error("Failed to accept invite", e);
            showErrorToast(t("inboxPanel.failedToAcceptInvite"));
        } finally {
            busyIds = new Set([...busyIds].filter((id) => id !== roomId));
        }
    }

    async function reject(roomId: string) {
        busyIds = new Set([...busyIds, roomId]);
        try {
            await rejectInvite(roomId);
        } catch (e) {
            console.error("Failed to reject invite", e);
            showErrorToast(t("inboxPanel.failedToRejectInvite"));
        } finally {
            busyIds = new Set([...busyIds].filter((id) => id !== roomId));
        }
    }

    async function cancelRequest(roomId: string) {
        busyIds = new Set([...busyIds, roomId]);
        try {
            await cancelKnock(roomId);
        } catch (e) {
            console.error("Failed to cancel join request", e);
            showErrorToast(t("inboxPanel.failedToCancelJoinRequest"));
        } finally {
            busyIds = new Set([...busyIds].filter((id) => id !== roomId));
        }
    }
</script>

<div class="flex-1 flex flex-col min-w-0 overflow-hidden">
    <div
        class="h-12 px-4 flex items-center gap-3 border-b border-discord-divider shadow-sm flex-shrink-0"
    >
        {#if isMobile}
            <button
                onclick={onMenuOpen}
                class="p-1.5 -ms-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors flex-shrink-0"
                title={t("common.openRoomList")}
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                </svg>
            </button>
        {/if}
        <h2 class="font-semibold text-discord-textPrimary">
            {t("inboxPanel.inbox")}
        </h2>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
        {#if roomsState.invitedRooms.length === 0 && roomsState.knockedRooms.length === 0}
            <div
                class="flex flex-col items-center justify-center h-full text-center py-16"
            >
                <div
                    class="w-16 h-16 rounded-full bg-discord-backgroundSecondary flex items-center justify-center mb-4"
                >
                    <svg
                        class="w-8 h-8 text-discord-textMuted"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        ><path
                            d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"
                        /></svg
                    >
                </div>
                <p class="text-discord-textPrimary font-semibold mb-1">
                    {t("inboxPanel.noPendingInvites")}
                </p>
                <p class="text-discord-textMuted text-sm">
                    {t("inboxPanel.roomInvitesWillAppearHere")}
                </p>
            </div>
        {:else}
            <div class="max-w-lg mx-auto flex flex-col gap-3">
                {#if roomsState.invitedRooms.length > 0}
                    <p
                        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1"
                    >
                        {t("inboxPanel.pendingInvites", {
                            length: roomsState.invitedRooms.length,
                        })}
                    </p>
                {/if}
                {#each roomsState.invitedRooms as room (room.roomId)}
                    {@const busy = busyIds.has(room.roomId)}
                    {@const sender = getInviteSender(room)}
                    {@const topic = getRoomTopic(room)}
                    <div
                        class="flex items-center gap-4 p-4 rounded-lg bg-discord-backgroundSecondary border border-discord-divider"
                    >
                        <Avatar
                            src={getRoomAvatar(room)}
                            name={getRoomDisplayName(room)}
                            size={48}
                        />
                        <div class="flex-1 min-w-0">
                            <p
                                class="font-semibold text-discord-textPrimary truncate"
                            >
                                {@html renderPlainTextWithTwemoji(
                                    getRoomDisplayName(room),
                                )}
                            </p>
                            {#if sender}
                                <p class="text-xs text-discord-textMuted">
                                    {t("inboxPanel.invitedBy", { sender })}
                                </p>
                            {/if}
                            {#if topic}
                                <p
                                    class="text-sm text-discord-textMuted mt-0.5 line-clamp-2"
                                >
                                    {topic}
                                </p>
                            {/if}
                        </div>
                        <div class="flex gap-2 flex-shrink-0">
                            <button
                                onclick={() => reject(room.roomId)}
                                disabled={busy}
                                class="px-3 py-1.5 rounded text-sm font-semibold text-discord-textMuted hover:text-white hover:bg-discord-danger border border-discord-divider hover:border-discord-danger transition-colors disabled:opacity-50"
                                >{t("inboxPanel.ignore")}</button
                            >
                            <button
                                onclick={() => accept(room.roomId)}
                                disabled={busy}
                                class="px-3 py-1.5 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {#if busy}
                                    <div
                                        class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"
                                    ></div>
                                {/if}
                                {t("inboxPanel.accept")}
                            </button>
                        </div>
                    </div>
                {/each}
                {#if roomsState.knockedRooms.length > 0}
                    <p
                        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1 {roomsState
                            .invitedRooms.length > 0
                            ? 'mt-3'
                            : ''}"
                    >
                        {t("inboxPanel.pendingJoinRequests", {
                            length: roomsState.knockedRooms.length,
                        })}
                    </p>
                    {#each roomsState.knockedRooms as room (room.roomId)}
                        {@const busy = busyIds.has(room.roomId)}
                        <div
                            class="flex items-center gap-4 p-4 rounded-lg bg-discord-backgroundSecondary border border-discord-divider"
                        >
                            <Avatar
                                src={getRoomAvatar(room)}
                                name={getRoomDisplayName(room)}
                                size={48}
                            />
                            <div class="flex-1 min-w-0">
                                <p
                                    class="font-semibold text-discord-textPrimary truncate"
                                >
                                    {@html renderPlainTextWithTwemoji(
                                        getRoomDisplayName(room),
                                    )}
                                </p>
                                <p class="text-xs text-discord-textMuted">
                                    {t("inboxPanel.youAskedToJoinWaitingFor")}
                                </p>
                            </div>
                            <div class="flex gap-2 flex-shrink-0">
                                <button
                                    onclick={() => cancelRequest(room.roomId)}
                                    disabled={busy}
                                    class="px-3 py-1.5 rounded text-sm font-semibold text-discord-textMuted hover:text-white hover:bg-discord-danger border border-discord-divider hover:border-discord-danger transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {#if busy}
                                        <div
                                            class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
                                        ></div>
                                    {/if}
                                    {t("inboxPanel.cancelRequest")}
                                </button>
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>
        {/if}
    </div>
</div>

<script lang="ts">
    import { t } from "$lib/i18n";
    import type { MatrixEvent } from "matrix-js-sdk";
    import { Search, X } from "lucide-svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import Portal from "$lib/components/ui/Portal.svelte";
    import {
        forwardMessage,
        getRooms,
        getRoomAvatar,
        getRoomDisplayName,
    } from "$lib/matrix/client";
    import { closeModal } from "$lib/stores/interface.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";

    interface Props {
        event: MatrixEvent;
    }

    let { event }: Props = $props();
    let query = $state("");
    let selectedRoomId = $state<string | null>(null);
    let isSending = $state(false);

    const rooms = $derived.by(() => {
        const needle = query.trim().toLocaleLowerCase();
        return getRooms()
            .filter((room) => !room.isSpaceRoom())
            .filter(
                (room) =>
                    !needle ||
                    getRoomDisplayName(room)
                        .toLocaleLowerCase()
                        .includes(needle) ||
                    room.roomId.toLocaleLowerCase().includes(needle),
            )
            .sort((a, b) =>
                getRoomDisplayName(a).localeCompare(getRoomDisplayName(b)),
            );
    });

    async function submit() {
        if (!selectedRoomId || isSending) return;
        isSending = true;
        try {
            await forwardMessage(selectedRoomId, event);
            closeModal();
        } catch (err) {
            showErrorToast(
                err instanceof Error
                    ? err.message
                    : t("forwardMessageDialog.failedToForwardMessage"),
            );
            isSending = false;
        }
    }
</script>

<Portal>
    <ModalDialog
        onClose={closeModal}
        labelledBy="forward-title"
        layerClass="z-[90] flex items-center justify-center p-3"
        panelClass="relative flex max-h-[min(620px,90dvh)] w-full max-w-md flex-col overflow-hidden rounded-lg border border-discord-divider bg-discord-backgroundSecondary shadow-2xl"
    >
        <div
            class="flex items-center justify-between border-b border-discord-divider px-4 py-3"
        >
            <h2
                id="forward-title"
                class="text-base font-semibold text-discord-textPrimary"
            >
                {t("forwardMessageDialog.forwardMessage")}
            </h2>
            <button
                type="button"
                onclick={closeModal}
                class="p-1.5 rounded text-discord-textMuted hover:bg-discord-messageHover hover:text-discord-textPrimary"
                aria-label={t("common.close")}
                title={t("common.close")}><X size={20} /></button
            >
        </div>

        <div class="p-3 pb-2">
            <label class="relative block">
                <Search
                    size={16}
                    class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-discord-textMuted"
                />
                <input
                    data-autofocus
                    bind:value={query}
                    placeholder={t("forwardMessageDialog.searchRooms")}
                    class="w-full rounded bg-discord-backgroundTertiary py-2 ps-9 pe-3 text-sm text-discord-textPrimary outline-none placeholder:text-discord-textMuted focus:ring-1 focus:ring-discord-accent"
                />
            </label>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {#each rooms as room (room.roomId)}
                <button
                    type="button"
                    onclick={() => (selectedRoomId = room.roomId)}
                    ondblclick={submit}
                    aria-pressed={selectedRoomId === room.roomId}
                    class="flex w-full items-center gap-3 rounded px-2 py-2 text-start transition-colors {selectedRoomId ===
                    room.roomId
                        ? 'bg-discord-accent/20'
                        : 'hover:bg-discord-messageHover'}"
                >
                    <Avatar
                        src={getRoomAvatar(room)}
                        name={getRoomDisplayName(room)}
                        id={room.roomId}
                        size={36}
                    />
                    <span
                        class="min-w-0 truncate text-sm font-medium text-discord-textPrimary"
                    >
                        {getRoomDisplayName(room)}
                    </span>
                </button>
            {:else}
                <p class="px-3 py-8 text-center text-sm text-discord-textMuted">
                    {t("forwardMessageDialog.noJoinedRoomsFound")}
                </p>
            {/each}
        </div>

        <div class="flex justify-end gap-2 border-t border-discord-divider p-3">
            <button
                type="button"
                onclick={closeModal}
                class="px-3 py-2 text-sm font-semibold text-discord-textMuted hover:text-discord-textPrimary"
                >{t("common.cancel")}</button
            >
            <button
                type="button"
                onclick={submit}
                disabled={!selectedRoomId || isSending}
                class="rounded bg-discord-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-discord-accentHover disabled:cursor-not-allowed disabled:opacity-50"
                >{isSending
                    ? t("forwardMessageDialog.forwarding")
                    : t("forwardMessageDialog.forward")}</button
            >
        </div>
    </ModalDialog>
</Portal>

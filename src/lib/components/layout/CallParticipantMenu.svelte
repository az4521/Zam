<script lang="ts">
    import type { Room } from "matrix-js-sdk";
    import Portal from "$lib/components/ui/Portal.svelte";
    import BottomSheet from "$lib/components/ui/BottomSheet.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { roomsState, setActiveRoom } from "$lib/stores/rooms.svelte";
    import {
        getMyPowerLevel,
        getUserPowerLevel,
        getRoomPowerLevels,
        getMemberName,
        kickUser,
        banUser,
        createDirectMessage,
        retryRoomFollowUp,
    } from "$lib/matrix/client";
    import type { RoomFollowUp } from "$lib/utils/roomCreationOutcome";
    import { menuGates } from "$lib/utils/callMenu";
    import {
        setUserVolume,
        setUserLocalMute,
        participantAudioFor,
    } from "$lib/stores/voiceCall.svelte";
    import { openProfileCard } from "$lib/stores/profileCard.svelte";
    import {
        isUserBlocked,
        blockUser,
        unblockUser,
    } from "$lib/stores/ignoredUsers.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import { matrixErrorMessage } from "$lib/utils/knock";
    import { focusTrap } from "$lib/actions/focusTrap";
    import { Circle } from "lucide-svelte";

    interface Props {
        room: Room;
        userId: string;
        x: number;
        y: number;
        touch?: boolean;
        onClose: () => void;
    }
    let { room, userId, x, y, touch = false, onClose }: Props = $props();

    const isSelf = $derived(userId === auth.userId);

    // Live SDK objects mutate in place — depend on the tick so power-level and
    // membership changes re-derive while the menu is open.
    const name = $derived(
        (void roomsState.roomsTick, getMemberName(room, userId)),
    );
    const gates = $derived.by(() => {
        void roomsState.roomsTick;
        const member = room.getMember(userId);
        // A stale RTC membership can outlive the room membership. A *missing*
        // member means "cannot act", not "level 0" — otherwise we'd offer an
        // admin Kick/Ban entries that only fail server-side. Mirrors
        // UserProfileCard's `!!member` guard; `menuGates` has no such concept,
        // so the check belongs here at the call site.
        if (!member) return { canKick: false, canBan: false };
        const pl = getRoomPowerLevels(room);
        return menuGates({
            isSelf,
            myLevel: getMyPowerLevel(room),
            targetLevel: getUserPowerLevel(room, userId),
            kickLevel: pl.kick,
            banLevel: pl.ban,
        });
    });
    const audio = $derived(participantAudioFor(userId));
    const blocked = $derived(isUserBlocked(userId));

    // Same viewport-clamping action the room/space context menus use.
    function positionMenu(node: HTMLElement, pos: { x: number; y: number }) {
        node.style.visibility = "hidden";
        node.style.left = "0px";
        node.style.top = "0px";
        requestAnimationFrame(() => {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const w = node.offsetWidth;
            const h = node.offsetHeight;
            let left = Math.min(pos.x, vw - w - 4);
            if (left < 4) left = 4;
            let top = pos.y;
            if (top + h > vh - 4) top = pos.y - h;
            if (top < 4) top = 4;
            const maxH = vh - top - 4;
            if (h > maxH) node.style.maxHeight = maxH + "px";
            node.style.left = left + "px";
            node.style.top = top + "px";
            node.style.visibility = "";
        });
    }

    // `fallback` may be a thunk so it can read live derived state (e.g. `name`)
    // at failure time rather than capturing it when the handler is built.
    function act(
        fn: () => Promise<unknown>,
        fallback: string | (() => string),
    ) {
        return async () => {
            try {
                await fn();
            } catch (err) {
                const msg =
                    typeof fallback === "function" ? fallback() : fallback;
                showErrorToast(matrixErrorMessage(err, msg));
            } finally {
                onClose();
            }
        };
    }

    // A created room whose follow-up write failed: the room is real, so we open
    // it and offer a retry of ONLY the failed step. Reporting a failure here
    // would send the user back to the form to create a duplicate (TX-01).
    function surfaceFollowUp(followUp: RoomFollowUp) {
        if (followUp.status !== "failed") return;
        const task = followUp.task;
        showErrorToast(followUp.message, {
            label: "Retry",
            run: () => {
                void retryRoomFollowUp(task).then((out) => {
                    if (out.status === "failed") surfaceFollowUp(out);
                });
            },
        });
    }

    // Close before opening the card: openProfileCard() claims the single modal
    // slot, so opening it first and closing afterwards would shut the card.
    const onProfile = (e: MouseEvent) => {
        const anchor = e.currentTarget as HTMLElement;
        onClose();
        openProfileCard(userId, anchor);
    };
    const onMessage = act(async () => {
        const { roomId, followUp } = await createDirectMessage(userId);
        surfaceFollowUp(followUp);
        setActiveRoom(roomId);
    }, "Could not open a direct message");
    const onToggleBlock = act(
        async () => (blocked ? unblockUser(userId) : blockUser(userId)),
        "Could not update the block list",
    );
    const onKick = act(
        () => kickUser(room.roomId, userId),
        () => `Could not kick ${name}`,
    );
    const onBan = act(
        () => banUser(room.roomId, userId),
        () => `Could not ban ${name}`,
    );
</script>

{#snippet menuItems()}
    <button
        onclick={onProfile}
        class="w-full text-left px-3 py-1.5 text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors"
        >Profile</button
    >
    {#if !isSelf}
        <button
            onclick={onMessage}
            class="w-full text-left px-3 py-1.5 text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors"
            >Message</button
        >

        <div class="w-full h-px bg-discord-divider my-1"></div>

        <div class="px-3 py-1.5">
            <label
                for="user-volume-{userId}"
                class="block text-xs text-discord-textMuted uppercase font-semibold tracking-wide"
            >
                User Volume
            </label>
            <input
                id="user-volume-{userId}"
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round(audio.volume * 100)}
                oninput={(e) =>
                    setUserVolume(userId, e.currentTarget.valueAsNumber / 100)}
                class="w-full mt-1.5 accent-discord-accent"
            />
        </div>
        <button
            onclick={() => setUserLocalMute(userId, !audio.muted)}
            aria-pressed={audio.muted}
            class="w-full text-left px-3 py-1.5 text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors flex items-center gap-2"
        >
            <span class="w-3 flex items-center justify-center">
                {#if audio.muted}<Circle size={8} fill="currentColor" />{/if}
            </span>
            Mute
        </button>

        <div class="w-full h-px bg-discord-divider my-1"></div>

        <button
            onclick={onToggleBlock}
            class="w-full text-left px-3 py-1.5 text-sm text-discord-danger hover:bg-discord-danger hover:text-white transition-colors"
            >{blocked ? "Unblock" : "Block"}</button
        >

        {#if gates.canKick || gates.canBan}
            <div class="w-full h-px bg-discord-divider my-1"></div>
        {/if}
        {#if gates.canKick}
            <button
                onclick={onKick}
                class="w-full text-left px-3 py-1.5 text-sm text-discord-danger hover:bg-discord-danger hover:text-white transition-colors truncate"
                >Kick {name}</button
            >
        {/if}
        {#if gates.canBan}
            <button
                onclick={onBan}
                class="w-full text-left px-3 py-1.5 text-sm text-discord-danger hover:bg-discord-danger hover:text-white transition-colors truncate"
                >Ban {name}</button
            >
        {/if}
    {/if}
{/snippet}

<Portal>
    <button
        type="button"
        aria-label="Close menu"
        class="fixed inset-0 z-50 {touch ? 'bg-black/40' : ''}"
        onclick={onClose}
    ></button>

    {#if touch}
        <BottomSheet {onClose}>
            {@render menuItems()}
        </BottomSheet>
    {:else}
        <div
            use:positionMenu={{ x, y }}
            use:focusTrap={{ onEscape: onClose }}
            class="fixed z-50 bg-discord-backgroundTertiary border border-discord-divider rounded-lg shadow-xl py-1 min-w-44 max-w-56 overflow-y-auto"
        >
            {@render menuItems()}
        </div>
    {/if}
</Portal>

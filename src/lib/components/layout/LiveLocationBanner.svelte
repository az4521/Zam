<script lang="ts">
    import type { Room } from "matrix-js-sdk";
    import {
        getRoomBeacons,
        getOwnUserId,
        getMemberName,
    } from "$lib/matrix/client";
    import {
        liveLocationState,
        shareStateFor,
        stopShare,
    } from "$lib/stores/liveLocation.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { remainingLabel } from "$lib/utils/liveLocation";
    import LiveLocationMapView from "$lib/components/layout/LiveLocationMapView.svelte";

    interface Props {
        room: Room;
    }
    let { room }: Props = $props();

    // A slow clock so the "43 min left" label refreshes while mounted.
    let now = $state(Date.now());
    $effect(() => {
        const id = setInterval(() => (now = Date.now()), 15000);
        return () => clearInterval(id);
    });

    let mapOpen = $state(false);
    const me = getOwnUserId();

    // Close the map when switching rooms — the view is per-room.
    $effect(() => {
        void room.roomId;
        mapOpen = false;
    });

    const ownShare = $derived(
        (void liveLocationState.beaconTick, shareStateFor(room.roomId)),
    );
    const others = $derived(
        (void liveLocationState.beaconTick,
        void roomsState.roomsTick,
        getRoomBeacons(room)).filter(
            (b) => b.isLive && b.beaconInfoOwner !== me,
        ),
    );
</script>

{#if ownShare}
    <div
        class="flex items-center gap-2 border-b border-discord-divider bg-discord-danger/10 px-4 py-2 text-sm"
    >
        <span class="h-2 w-2 flex-shrink-0 rounded-full bg-discord-danger"
        ></span>
        <button
            type="button"
            onclick={() => (mapOpen = true)}
            class="text-left text-discord-textPrimary hover:underline"
            title="Open map"
            >Sharing live location · {remainingLabel(
                ownShare.expiresAt,
                now,
            )}</button
        >
        <button
            type="button"
            onclick={() => (mapOpen = true)}
            class="ml-auto rounded bg-discord-backgroundSecondary px-3 py-1 text-xs font-semibold text-discord-textPrimary transition-colors hover:bg-discord-messageHover"
        >
            Map
        </button>
        <button
            type="button"
            onclick={() => stopShare(room.roomId)}
            class="rounded bg-discord-danger px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
            Stop
        </button>
    </div>
{:else if others.length > 0}
    <div class="border-b border-discord-divider bg-discord-backgroundSecondary">
        <button
            type="button"
            onclick={() => (mapOpen = true)}
            class="flex w-full items-center gap-2 px-4 py-2 text-sm text-discord-textPrimary transition-colors hover:bg-discord-messageHover"
        >
            <span class="text-discord-accent">⦿</span>
            {#if others.length === 1}
                <span
                    >{getMemberName(room, others[0].beaconInfoOwner)} is sharing live
                    location</span
                >
            {:else}
                <span>{others.length} people sharing live location</span>
            {/if}
            <span class="ml-auto text-xs text-discord-accent">View map ›</span>
        </button>
    </div>
{/if}

{#if mapOpen}
    <LiveLocationMapView {room} onClose={() => (mapOpen = false)} />
{/if}

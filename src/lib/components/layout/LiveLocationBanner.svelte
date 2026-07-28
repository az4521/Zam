<script lang="ts">
    import type { Room } from "matrix-js-sdk";
    import { LocateFixed, ChevronRight } from "lucide-svelte";
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
    import { remainingLabel, updatedAgoLabel } from "$lib/utils/liveLocation";
    import { timeOnly } from "$lib/utils/timeFormat";
    import LiveLocationMapView from "$lib/components/layout/LiveLocationMapView.svelte";
    import { untrack } from "svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import {
        liveMapState,
        openLiveLocationMap,
        closeLiveLocationMap,
    } from "$lib/stores/liveMap.svelte";

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

    const me = getOwnUserId();

    // Double gate, matching the share-location precedent (AppShell.svelte:1042):
    // the slot says a map is open, the store says it is THIS room's.
    const mapOpen = $derived(
        interfaceState.modal === "live-location-map" &&
            liveMapState.roomId === room.roomId,
    );

    // The view is per-room, and it lives inside this component — release the
    // slot when the room changes or the banner unmounts, or the slot would
    // stay claimed by a map that is no longer rendered and Escape would
    // silently "dismiss" nothing. The effect depends on room.roomId alone; the
    // store read/write happens in the teardown, which Svelte already runs
    // outside any tracking context, so it can never re-trigger this effect.
    // untrack() is defensive only.
    //
    // `room` is a live prop getter and the teardown fires AFTER the prop has
    // changed, so capture the id in the body: reading room.roomId inside the
    // closure would yield the NEW room and never match the still-open map.
    $effect(() => {
        const openedFor = room.roomId;
        return () =>
            untrack(() => {
                if (liveMapState.roomId === openedFor) closeLiveLocationMap();
            });
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
            onclick={() => openLiveLocationMap(room.roomId)}
            class="text-left text-discord-textPrimary hover:underline"
            title="Open map"
            >Sharing live location · {remainingLabel(
                ownShare.expiresAt,
                now,
            )}{ownShare.lastSentTs
                ? ` · last updated at ${timeOnly(ownShare.lastSentTs)} (${updatedAgoLabel(ownShare.lastSentTs, now)})`
                : ""}</button
        >
        <button
            type="button"
            onclick={() => openLiveLocationMap(room.roomId)}
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
            onclick={() => openLiveLocationMap(room.roomId)}
            class="flex w-full items-center gap-2 px-4 py-2 text-sm text-discord-textPrimary transition-colors hover:bg-discord-messageHover"
        >
            <LocateFixed size={16} class="text-discord-accent flex-shrink-0" />
            {#if others.length === 1}
                <span
                    >{getMemberName(room, others[0].beaconInfoOwner)} is sharing live
                    location</span
                >
            {:else}
                <span>{others.length} people sharing live location</span>
            {/if}
            <span
                class="ml-auto text-xs text-discord-accent flex items-center gap-0.5"
            >
                View map <ChevronRight size={14} />
            </span>
        </button>
    </div>
{/if}

{#if mapOpen}
    <LiveLocationMapView {room} onClose={closeLiveLocationMap} />
{/if}

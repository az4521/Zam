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
    import {
        beaconGeo,
        remainingLabel,
        updatedAgoLabel,
    } from "$lib/utils/liveLocation";
    import { formatCoords, mapLinkFor } from "$lib/utils/location";

    interface Props {
        room: Room;
    }
    let { room }: Props = $props();

    // A slow clock so the "43 min left" / "12 s ago" labels refresh while mounted.
    let now = $state(Date.now());
    $effect(() => {
        const id = setInterval(() => (now = Date.now()), 15000);
        return () => clearInterval(id);
    });

    let expanded = $state(false);
    const me = getOwnUserId();

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
        <span class="text-discord-textPrimary"
            >Sharing live location · {remainingLabel(
                ownShare.expiresAt,
                now,
            )}</span
        >
        <button
            type="button"
            onclick={() => stopShare(room.roomId)}
            class="ml-auto rounded bg-discord-danger px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
            Stop
        </button>
    </div>
{:else if others.length > 0}
    <div class="border-b border-discord-divider bg-discord-backgroundSecondary">
        <button
            type="button"
            onclick={() => (expanded = !expanded)}
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
            <span class="ml-auto text-xs text-discord-textMuted"
                >{expanded ? "▲" : "▼"}</span
            >
        </button>
        {#if expanded}
            <div class="flex flex-col gap-2 px-4 pb-3">
                {#each others as b (b.beaconInfoId)}
                    {@const geo = beaconGeo(b.latestLocationState)}
                    <div
                        class="rounded border border-discord-divider bg-discord-backgroundTertiary px-3 py-2"
                    >
                        <p class="text-sm font-medium text-discord-textPrimary">
                            {getMemberName(room, b.beaconInfoOwner)}
                        </p>
                        {#if b.latestLocationState?.description}
                            <p
                                class="break-words text-xs text-discord-textSecondary"
                            >
                                {b.latestLocationState.description}
                            </p>
                        {/if}
                        {#if geo}
                            <p class="text-xs text-discord-textMuted">
                                {formatCoords(geo.lat, geo.lon)}
                            </p>
                            <a
                                href={mapLinkFor(geo.lat, geo.lon)}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-xs text-discord-accent hover:underline"
                                >Open in OpenStreetMap ↗</a
                            >
                        {:else}
                            <p class="text-xs text-discord-textMuted">
                                Waiting for location…
                            </p>
                        {/if}
                        {#if b.latestLocationState?.timestamp}
                            <p class="text-xs text-discord-textMuted">
                                {updatedAgoLabel(
                                    b.latestLocationState.timestamp,
                                    now,
                                )}
                            </p>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
{/if}

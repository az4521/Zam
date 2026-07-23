<script lang="ts">
    import type { Room } from "matrix-js-sdk";
    import LocationMap from "$lib/components/ui/LocationMap.svelte";
    import type { MapMarkerInput } from "$lib/components/ui/LocationMap.svelte";
    import {
        getRoomBeacons,
        getOwnUserId,
        getMemberName,
        getMemberAvatar,
    } from "$lib/matrix/client";
    import {
        liveLocationState,
        shareStateFor,
        stopShare,
    } from "$lib/stores/liveLocation.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { remainingLabel, updatedAgoLabel } from "$lib/utils/liveLocation";
    import { beaconMarkers } from "$lib/utils/liveLocationMap";
    import { mapLinkFor } from "$lib/utils/location";

    interface Props {
        room: Room;
        onClose: () => void;
    }
    let { room, onClose }: Props = $props();

    let mapEl: ReturnType<typeof LocationMap> | undefined = $state();

    // Label clock — 5s so "updated just now" tracks incoming fixes closely.
    let now = $state(Date.now());
    $effect(() => {
        const id = setInterval(() => (now = Date.now()), 5000);
        return () => clearInterval(id);
    });

    const me = getOwnUserId();
    const ownShare = $derived(
        (void liveLocationState.beaconTick, shareStateFor(room.roomId)),
    );
    const markers = $derived.by((): MapMarkerInput[] => {
        void liveLocationState.beaconTick;
        void roomsState.roomsTick;
        return beaconMarkers(getRoomBeacons(room), me).map((m) => ({
            id: m.id,
            lat: m.lat,
            lon: m.lon,
            label: m.isSelf ? "You" : getMemberName(room, m.owner),
            avatarUrl: getMemberAvatar(room, m.owner),
            isSelf: m.isSelf,
        }));
    });
    const sharers = $derived.by(() => {
        void liveLocationState.beaconTick;
        void roomsState.roomsTick;
        return beaconMarkers(getRoomBeacons(room), me);
    });

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        }
    }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="fixed inset-0 z-[70] flex flex-col bg-discord-background">
    <!-- Header -->
    <div
        class="h-12 px-2 flex items-center gap-2 border-b border-discord-divider flex-shrink-0"
    >
        <button
            onclick={onClose}
            class="p-2 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
            title="Back"
        >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                    d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
                />
            </svg>
        </button>
        <span class="font-semibold text-discord-textPrimary">
            Live location
        </span>
        <button
            onclick={() => mapEl?.recenter()}
            class="ml-auto p-2 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
            title="Recenter"
        >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                    d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3A8.99 8.99 0 0 0 13 3.06V1h-2v2.06A8.99 8.99 0 0 0 3.06 11H1v2h2.06A8.99 8.99 0 0 0 11 20.94V23h2v-2.06A8.99 8.99 0 0 0 20.94 13H23v-2h-2.06zM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z"
                />
            </svg>
        </button>
    </div>

    <!-- Map -->
    <div class="relative flex-1 min-h-0">
        <LocationMap bind:this={mapEl} {markers} />
        {#if markers.length === 0}
            <div
                class="absolute inset-0 z-[401] flex items-center justify-center pointer-events-none"
            >
                <p
                    class="rounded bg-discord-backgroundSecondary/90 px-4 py-2 text-sm text-discord-textMuted"
                >
                    Waiting for a location fix…
                </p>
            </div>
        {/if}
    </div>

    <!-- Footer: own-share controls + sharer freshness -->
    <div
        class="flex-shrink-0 border-t border-discord-divider bg-discord-backgroundSecondary px-4 py-3 flex flex-col gap-2"
    >
        {#if ownShare}
            <div class="flex items-center gap-2 text-sm">
                <span
                    class="h-2 w-2 flex-shrink-0 rounded-full bg-discord-danger animate-pulse"
                ></span>
                <span class="text-discord-textPrimary">
                    Sharing live location · {remainingLabel(
                        ownShare.expiresAt,
                        now,
                    )}
                </span>
                {#if ownShare.error}
                    <span class="text-xs text-discord-textMuted">
                        {ownShare.error}
                    </span>
                {/if}
                <button
                    type="button"
                    onclick={() => stopShare(room.roomId)}
                    class="ml-auto rounded bg-discord-danger px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                    Stop sharing
                </button>
            </div>
        {/if}
        {#each sharers.filter((s) => !s.isSelf) as s (s.id)}
            <div class="flex items-center gap-2 text-xs text-discord-textMuted">
                <span class="font-medium text-discord-textSecondary">
                    {getMemberName(room, s.owner)}
                </span>
                {#if s.description}
                    <span class="truncate">· {s.description}</span>
                {/if}
                {#if s.updatedTs}
                    <span>· {updatedAgoLabel(s.updatedTs, now)}</span>
                {/if}
                <a
                    href={mapLinkFor(s.lat, s.lon)}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="ml-auto text-discord-accent hover:underline flex-shrink-0"
                    >OSM ↗</a
                >
            </div>
        {/each}
        {#if !ownShare && sharers.filter((s) => !s.isSelf).length === 0}
            <p class="text-xs text-discord-textMuted">
                No active live shares in this room.
            </p>
        {/if}
    </div>
</div>

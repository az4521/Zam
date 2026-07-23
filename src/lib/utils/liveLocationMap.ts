import { beaconGeo } from "./liveLocation";

/** The subset of an SDK `Beacon` the marker mapper reads. */
export interface BeaconMarkerSource {
    beaconInfoId: string;
    beaconInfoOwner: string;
    isLive: boolean;
    latestLocationState?: {
        uri?: string | null;
        timestamp?: number | null;
        description?: string | null;
    };
}

/** One map marker: a sharer's freshest live fix. */
export interface BeaconMarker {
    id: string;
    owner: string;
    isSelf: boolean;
    lat: number;
    lon: number;
    updatedTs: number | null;
    description: string | null;
}

/**
 * Live beacons → marker view models: drop dead/fix-less beacons, keep one
 * marker per owner (freshest fix wins when an owner somehow has several live
 * beacons), own marker first so the map view can style/prioritize it.
 */
export function beaconMarkers(
    beacons: readonly BeaconMarkerSource[],
    ownUserId: string | null,
): BeaconMarker[] {
    const byOwner = new Map<string, BeaconMarker>();
    for (const b of beacons) {
        if (!b.isLive) continue;
        const geo = beaconGeo(b.latestLocationState ?? null);
        if (!geo) continue;
        const marker: BeaconMarker = {
            id: b.beaconInfoId,
            owner: b.beaconInfoOwner,
            isSelf: b.beaconInfoOwner === ownUserId,
            lat: geo.lat,
            lon: geo.lon,
            updatedTs: b.latestLocationState?.timestamp ?? null,
            description: b.latestLocationState?.description ?? null,
        };
        const prev = byOwner.get(b.beaconInfoOwner);
        if (!prev || (marker.updatedTs ?? 0) >= (prev.updatedTs ?? 0)) {
            byOwner.set(b.beaconInfoOwner, marker);
        }
    }
    return [...byOwner.values()].sort(
        (a, b) => Number(b.isSelf) - Number(a.isSelf),
    );
}

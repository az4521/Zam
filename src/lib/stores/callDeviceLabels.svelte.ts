/**
 * Device display names for call participants who are joined from several
 * devices. Names come from the crypto store only (never a server download),
 * so this is a cheap, best-effort cache. Components read `callDeviceLabels.tick`
 * inside their expressions so they re-run when a fetch lands (tick pattern).
 */
import type { Room } from "matrix-js-sdk";
import {
    getCachedDeviceDisplayNames,
    getRoomCallMemberships,
} from "$lib/matrix/client";
import {
    deviceLabel,
    devicesByUser,
    type DeviceMembership,
} from "$lib/utils/callTileStatus";

/** Re-fetch a user's device names once their cached entry is this old. */
const REFRESH_MS = 5 * 60 * 1000;

export const callDeviceLabels = $state({ tick: 0 });

/** `${userId}\n${deviceId}` -> display name (null when the device has none). */
const names = new Map<string, string | null>();
/** userId -> time of the last fetch attempt. */
const fetchedAt = new Map<string, number>();

function key(userId: string, deviceId: string): string {
    return `${userId}\n${deviceId}`;
}

/** Display name of one device, or null when unknown or unnamed. */
export function deviceDisplayName(
    userId: string,
    deviceId: string,
): string | null {
    return names.get(key(userId, deviceId)) ?? null;
}

/** Fetch device names for users not fetched within REFRESH_MS. Fire-and-forget:
 *  failures leave the map as it was and the UI falls back to device ids. */
export async function requestDeviceLabels(userIds: string[]): Promise<void> {
    const now = Date.now();
    const stale = [...new Set(userIds)].filter((id) => {
        const last = fetchedAt.get(id);
        return last === undefined || now - last >= REFRESH_MS;
    });
    if (stale.length === 0) return;
    // Stamp before awaiting so overlapping calls do not refetch the same users.
    for (const id of stale) fetchedAt.set(id, now);
    try {
        const info = await getCachedDeviceDisplayNames(stale);
        for (const [userId, devices] of info) {
            for (const [deviceId, name] of devices) {
                names.set(key(userId, deviceId), name);
            }
        }
        callDeviceLabels.tick++;
    } catch {
        // Best effort: the labels simply stay on device ids.
    }
}

/** Request names for every user joined from 2+ devices in these rooms' calls. */
export function requestCallDeviceLabels(rooms: Room[]): Promise<void> {
    const multi = new Set<string>();
    for (const room of rooms) {
        for (const [userId, devices] of devicesByUser(
            getRoomCallMemberships(room),
        )) {
            if (devices.length > 1) multi.add(userId);
        }
    }
    return requestDeviceLabels([...multi]);
}

/** Labels for one user's devices (earliest joined first). Reads the tick, so
 *  calling it from markup re-renders when names arrive. */
export function callDeviceLabelsFor(
    userId: string,
    devices: DeviceMembership[],
    selfUserId: string | null,
    ownDeviceId: string | null,
    thisDeviceText: string,
): string[] {
    void callDeviceLabels.tick;
    return devices.map((d) =>
        deviceLabel(
            d.deviceId,
            deviceDisplayName(userId, d.deviceId),
            userId === selfUserId && d.deviceId === ownDeviceId,
            thisDeviceText,
        ),
    );
}

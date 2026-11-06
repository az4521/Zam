/**
 * Helpers for room-v12 (MSC4289) `additional_creators`: extra users who share
 * creator power with the room's sender. Pure so they can be unit-tested.
 */
import { USER_ID_RE } from "$lib/utils/matrixLinks";
import { roomVersionHasImmutableCreators } from "$lib/utils/powerLevels";

/**
 * Keep only well-formed user ids, dropping the caller (the sender is already a
 * creator) and duplicates. Order of first appearance is preserved.
 */
export function normalizeAdditionalCreators(
    ids: readonly string[],
    selfId: string | null | undefined,
): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of ids) {
        const id = raw.trim();
        if (!USER_ID_RE.test(id)) continue;
        if (selfId && id === selfId) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}

/**
 * The room version to create a room at when it needs immutable creators: the
 * highest advertised numeric version >= 12, else the server default when that
 * already has immutable creators, else `undefined` (no suitable version).
 */
export function pickCreatorRoomVersion(cap: {
    default: string;
    available: readonly string[];
}): string | undefined {
    let best: number | null = null;
    for (const v of cap.available) {
        if (!/^\d+$/.test(v)) continue;
        const n = Number(v);
        if (n >= 12 && (best === null || n > best)) best = n;
    }
    if (best !== null) return String(best);
    if (cap.default && roomVersionHasImmutableCreators(cap.default)) {
        return cap.default;
    }
    return undefined;
}

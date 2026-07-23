/**
 * Add a room to the `m.direct` account-data mapping under a given partner,
 * returning a NEW object (no mutation of the input). Creates the map and the
 * partner's room list as needed, and is idempotent — re-adding a room already
 * listed under that partner is a no-op. Other partners are preserved.
 *
 * `m.direct` shape: `{ [partnerUserId]: roomId[] }`.
 */
export function addToMDirect(
    existing: Record<string, string[]> | undefined,
    partnerId: string,
    roomId: string,
): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(existing ?? {}))
        out[k] = [...(Array.isArray(v) ? v : [])];
    const list = (out[partnerId] ??= []);
    if (!list.includes(roomId)) list.push(roomId);
    return out;
}

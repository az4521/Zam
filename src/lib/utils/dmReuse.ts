/**
 * Pick the DM room to reuse for a contact from their `m.direct` entry.
 *
 * `m.direct[userId]` is an ORDERED list of room IDs. Reuse the first one the
 * client is actually joined to — never blindly `[0]`. A stale first entry (a DM
 * the user left/forgot, or a federated room whose state never synced so the
 * client doesn't hold it) has no `"join"` membership; the old code only checked
 * `[0]`, so a dead first entry made it skip a perfectly good live DM at `[1+]`
 * and mint a brand-new duplicate room on every open — which appended to
 * `m.direct`, keeping `[0]` dead so it recurred forever. Bit a cross-server DM
 * (whose room presents as an "Empty Room") on 2026-08-13.
 *
 * Pure so it can be unit-tested; the SDK lookup is injected.
 *
 * @param roomIds `m.direct[userId]` — may be `undefined` or empty.
 * @param membershipOf resolves a room's own-membership, e.g.
 *   `getRoom(id)?.getMyMembership()`. Anything other than `"join"` — including
 *   `undefined`/`null` for a room the client does not hold — is not reusable.
 * @returns the first reusable (joined) room id, or `undefined` if none.
 */
export function firstReusableDmRoom(
    roomIds: readonly string[] | undefined,
    membershipOf: (roomId: string) => string | null | undefined,
): string | undefined {
    return roomIds?.find((id) => membershipOf(id) === "join");
}

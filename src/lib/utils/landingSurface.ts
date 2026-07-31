/**
 * Where the app should land when the main pane has no valid room to show.
 *
 * `keep` means "change nothing" — either the current selection is still good
 * or we cannot yet tell, and guessing would be worse than waiting.
 * `none` means "there is genuinely no room to open here"; the caller clears the
 * selection and the UI renders a context-appropriate surface (a space's Browse
 * Channels list, or an empty state).
 */
export type LandingTarget =
    | { kind: "keep" }
    | { kind: "room"; roomId: string }
    | { kind: "none" };

export interface LandingInput {
    /**
     * True once the SDK's room list is genuinely populated (first sync done).
     * While false every id looks stale, so acting would overwrite the user's
     * remembered room with a guess — and persist it.
     */
    roomsReady: boolean;
    /** The inbox is a deliberate no-room surface; never land over it. */
    showInbox: boolean;
    /** `null` is the Home sentinel. */
    activeSpaceId: string | null;
    activeRoomId: string | null;
    /**
     * Whether `activeRoomId` is somewhere we may leave the user sitting — i.e.
     * **not provably gone**, which is weaker than "membership reads join". A
     * room the SDK has no membership opinion about yet (just joined, or a
     * federated room /sync has not described) counts as landable: moving the
     * user out of a room they just opened is worse than briefly keeping one
     * they have left. Deliberately NOT "is it in `spaceRoomIds`" either — a
     * federated room omitted from /sync can be missing from the space's child
     * list while the user is really sitting in it.
     */
    activeRoomIsLandable: boolean;
    /** Joined rooms of the active space, already in sidebar order. */
    spaceRoomIds: readonly string[];
    /** Home's rooms then DMs, already in sidebar order. */
    homeRoomIds: readonly string[];
}

/**
 * Decide the landing surface. Pure: every SDK and store read happens in the
 * caller, so each branch below is directly testable.
 *
 * The chain, in the order the user asked for it:
 *   1. a selection that is not provably gone wins over everything;
 *   2. at Home, the first room (rooms then DMs) in sidebar order;
 *   3. in a space, that space's first room in sidebar order;
 *   4. otherwise there is nothing to open: `none`, and the UI shows Browse
 *      Channels or an empty state.
 *
 * A space we are not joined to deliberately does NOT redirect to Home:
 * "unknown" must not mean "gone". The only signal we have for space membership
 * is a store snapshot that is stale for a beat after joining a space, so a
 * redirect would eject the user from the space they had just joined; and its
 * only upside — a space left elsewhere landing on Home rather than on that
 * space's Browse Channels — is no dead end, since Browse Channels is a real,
 * actionable surface with the sidebar right beside it.
 */
export function resolveLandingTarget(input: LandingInput): LandingTarget {
    if (!input.roomsReady) return { kind: "keep" };
    if (input.showInbox) return { kind: "keep" };
    if (input.activeRoomId && input.activeRoomIsLandable)
        return { kind: "keep" };

    if (input.activeSpaceId === null) {
        const first = input.homeRoomIds[0];
        return first ? { kind: "room", roomId: first } : { kind: "none" };
    }

    const first = input.spaceRoomIds[0];
    return first ? { kind: "room", roomId: first } : { kind: "none" };
}

/**
 * Decide whether a joined room's local state is real, or only the husk sync
 * left behind — the signal that drives the `seedRoomStateIfMissing()` heal.
 *
 * Two ways a joined room ends up without usable state on continuwuity:
 *
 *  1. **No state at all.** Rooms joined over federation are omitted from
 *     /sync (state and timeline both), leaving a bare stub — detected here
 *     by the absent `m.room.create`.
 *  2. **Only what `invite_state` shipped.** A room entered through an INVITE
 *     is built from `invite_state`: create, name, join_rules and a member
 *     event or two. Accepting doesn't fix it — the server won't re-deliver
 *     full state for a room it already streamed — so the room stays missing
 *     its power levels, history visibility, and (for a space) every
 *     `m.space.child` edge, while looking perfectly stated.
 *
 * Case 2 is NOT reliably detectable from the state alone: the spec says
 * stripped events carry no `event_id`, but continuwuity's invite_state
 * events have real ids (in room v12 the create event's id is derived from
 * the room id), and nothing else is universally present enough to test for.
 * So case 2 is handled at its source instead — callers that know a room just
 * went invite → join force the seed. The id test below still stands for
 * servers that do strip properly; it is a supplementary signal, not the one
 * the invite path relies on.
 *
 * Why it matters: a bridged SPACE joined by invite has zero child edges, so
 * it lists no channels and every room joined inside it is filed as an orphan
 * — into Home instead of under the space (2026-07-26).
 */
export interface RoomStateProbe {
    /** Our membership in the room ("join", "invite", "leave", …). */
    membership: string;
    /** The room's `m.room.create` event id, if it holds one at all. */
    createEventId: string | null | undefined;
    /** Whether an `m.room.create` state event is present, id or not. */
    hasCreateEvent: boolean;
}

/**
 * True when a JOINED room needs its state fetched and injected. Rooms we
 * haven't joined are never seeded — their state isn't ours to read, and an
 * invite legitimately holds nothing but stripped state until accepted.
 */
export function needsStateSeed(probe: RoomStateProbe): boolean {
    if (probe.membership !== "join") return false;
    if (!probe.hasCreateEvent) return true;
    return !probe.createEventId;
}

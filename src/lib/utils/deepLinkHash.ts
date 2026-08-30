/**
 * Parse a PWA cold-start deep-link fragment (`#room=<id>&event=<id>`) into a
 * navigation target.
 *
 * The service worker opens `/#room=<roomId>[&event=<eventId>]` when a
 * notification is tapped with no focused client (a cold PWA start). At boot the
 * app reads `location.hash` through this parser and routes the result with the
 * existing `navigateToRoom`.
 *
 * Contract:
 * - Accepts the fragment with or without a leading `#`.
 * - Requires a `room` param that is a valid internal room id (starts with `!`);
 *   anything else (no room, empty, an alias, a random fragment) returns null so
 *   a non-deep-link hash never navigates.
 * - `event` is optional and only kept when it is a valid event id (starts with
 *   `$`). A missing or malformed event id yields `{ roomId }` — open the room,
 *   do not jump. Extra params are ignored; order does not matter.
 */
export function parseDeepLinkHash(
    hash: string | null | undefined,
): { roomId: string; eventId?: string } | null {
    if (!hash) return null;
    const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!fragment) return null;
    const params = new URLSearchParams(fragment);
    const roomId = params.get("room");
    if (!roomId || !roomId.startsWith("!")) return null;
    const eventId = params.get("event");
    return eventId && eventId.startsWith("$")
        ? { roomId, eventId }
        : { roomId };
}

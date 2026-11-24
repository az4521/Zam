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
 * - `user` is optional: the account the notification was posted under (starts
 *   with `@`), so the app can switch to it first. Malformed → left out.
 */
export function parseDeepLinkHash(
    hash: string | null | undefined,
): { roomId: string; eventId?: string; userId?: string } | null {
    if (!hash) return null;
    const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!fragment) return null;
    const params = new URLSearchParams(fragment);
    const roomId = params.get("room");
    if (!roomId || !roomId.startsWith("!")) return null;
    const eventId = params.get("event");
    const userId = params.get("user");
    return {
        roomId,
        ...(eventId && eventId.startsWith("$") ? { eventId } : {}),
        ...(userId && userId.startsWith("@") ? { userId } : {}),
    };
}

/**
 * The account to boot for a cold-start deep link: the one the notification
 * was posted under, when it is signed in here and is not already the active
 * account. Booting it directly avoids starting the active account only to
 * switch (a second full start), and a second window never waits on the
 * active account's session held by the first one.
 */
export function deepLinkBootAccount(
    hash: string | null | undefined,
    signedIn: readonly string[],
    activeUserId: string | null,
): string | null {
    const userId = parseDeepLinkHash(hash)?.userId;
    if (!userId || userId === activeUserId) return null;
    return signedIn.includes(userId) ? userId : null;
}

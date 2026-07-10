/**
 * Pure helpers for the ignore ("block") list: list editing and the timeline
 * filter predicate. SDK-free so it can be unit-tested.
 */

/** Returns a new list with `userId` appended, deduplicating an existing entry. */
export function addIgnoredUser(
    list: readonly string[],
    userId: string,
): string[] {
    if (list.includes(userId)) return [...list];
    return [...list, userId];
}

/** Returns a new list without `userId` (no-op when absent). */
export function removeIgnoredUser(
    list: readonly string[],
    userId: string,
): string[] {
    return list.filter((id) => id !== userId);
}

/**
 * Whether a timeline event should be hidden behind the "blocked message"
 * collapse: its sender is on the ignore list. The user's own messages are
 * never hidden, even if their id somehow ends up in the list.
 */
export function shouldHideMessage(
    senderId: string | null | undefined,
    ignoredUsers: readonly string[],
    ownUserId: string | null | undefined,
): boolean {
    if (!senderId) return false;
    if (senderId === ownUserId) return false;
    return ignoredUsers.includes(senderId);
}

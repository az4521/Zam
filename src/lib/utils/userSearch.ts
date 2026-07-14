/** One raw entry from the user directory search response (Client-Server API shape). */
export interface RawDirectoryUser {
    user_id: string;
    display_name?: string;
    avatar_url?: string;
}

/** A normalized user directory search result. */
export interface DirectoryUser {
    userId: string;
    displayName: string | null;
    /** Raw mxc:// avatar URL — the caller converts it to HTTP. */
    avatarMxc: string | null;
}

/** Whether the input is a complete Matrix user id (@localpart:server, optional port). */
export function isValidUserId(input: string): boolean {
    return /^@[^\s:@]+:[^\s:@]+(:\d+)?$/.test(input);
}

/** The server-name portion of a Matrix user id (everything after the first colon). */
export function userDomain(userId: string): string {
    const i = userId.indexOf(":");
    return i === -1 ? "" : userId.slice(i + 1);
}

/**
 * Normalize a user directory response: drop malformed entries and the
 * searching user, dedupe by user id, and hoist an exact user-id match for the
 * search term to the top. Server order is preserved otherwise.
 */
export function mapUserSearchResults(
    results: RawDirectoryUser[],
    opts: { ownUserId?: string | null; term?: string } = {},
): DirectoryUser[] {
    const seen = new Set<string>();
    const mapped: DirectoryUser[] = [];
    for (const entry of results ?? []) {
        const userId = entry?.user_id;
        if (typeof userId !== "string" || !userId.startsWith("@")) continue;
        if (userId === opts.ownUserId || seen.has(userId)) continue;
        seen.add(userId);
        mapped.push({
            userId,
            displayName: entry.display_name?.trim() || null,
            avatarMxc: entry.avatar_url ?? null,
        });
    }
    // Rank same-homeserver users above federated ones. The directory returns
    // remote users the server has seen in public rooms; a same-domain match is
    // almost always who the user means. Array.sort is stable, so input order is
    // preserved within each group.
    const ownDomain = opts.ownUserId ? userDomain(opts.ownUserId) : "";
    if (ownDomain) {
        mapped.sort(
            (a, b) =>
                (userDomain(a.userId) === ownDomain ? 0 : 1) -
                (userDomain(b.userId) === ownDomain ? 0 : 1),
        );
    }
    const term = opts.term?.trim();
    if (term) {
        const exact = mapped.findIndex((u) => u.userId === term);
        if (exact > 0) mapped.unshift(mapped.splice(exact, 1)[0]);
    }
    return mapped;
}

/**
 * Trailing-edge debounce: the wrapped function runs once, with the latest
 * arguments, after `delayMs` of silence. `cancel()` drops any pending call.
 */
export function debounce<Args extends unknown[]>(
    fn: (...args: Args) => void,
    delayMs: number,
): { (...args: Args): void; cancel: () => void } {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = (...args: Args) => {
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn(...args);
        }, delayMs);
    };
    debounced.cancel = () => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
    };
    return debounced;
}

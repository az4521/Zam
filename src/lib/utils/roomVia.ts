/**
 * Picks the `via` servers for a matrix.to link or an m.space.child event.
 *
 * Room ids in room version 12 and later carry no `:server` part, so a link
 * built from the room id alone has to name a server that actually holds the
 * room. Our own server goes first, then the servers most joined members come
 * from, so the link still resolves when our server is not in the room.
 *
 * @param ownServer the logged-in account's server name ("" if unknown)
 * @param memberUserIds joined member user ids of the room
 * @param max the most servers to return
 */
export function pickViaServers(
    ownServer: string,
    memberUserIds: string[],
    max = 3,
): string[] {
    const counts = new Map<string, number>();
    for (const userId of memberUserIds) {
        const colon = userId.indexOf(":");
        if (colon < 0) continue;
        const server = userId.slice(colon + 1);
        if (!server || server === ownServer) continue;
        counts.set(server, (counts.get(server) ?? 0) + 1);
    }

    // Map iteration keeps first-seen order, so equal counts keep member order.
    const ranked = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([server]) => server);

    const result = ownServer ? [ownServer, ...ranked] : ranked;
    return result.slice(0, Math.max(0, max));
}

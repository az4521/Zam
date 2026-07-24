export interface LoginUsername {
    username: string;
    homeserver: string | null;
}

/**
 * Split a full Matrix user ID entered in the username field. The homeserver
 * portion is a Matrix server name, not a URL, so schemes and paths are rejected.
 */
export function parseLoginUsername(input: string): LoginUsername {
    const trimmed = input.trim();
    const fullUserId = /^@([^\s:]+):([^\s/?#]+)$/.exec(trimmed);

    return fullUserId
        ? { username: fullUserId[1], homeserver: fullUserId[2] }
        : { username: trimmed, homeserver: null };
}

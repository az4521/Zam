/**
 * Streamer-mode stand-ins for own account identifiers. A blur is reversible
 * (deblurring recovers the text), so identifiers are replaced with random
 * values rather than styled. The alias is random, not derived from the real
 * value, and stable for the page's lifetime so the same account always shows
 * the same fake while streaming.
 */

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const aliases = new Map<string, string>();

function randomString(length: number): string {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let out = "";
    for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
    return out;
}

function alias(kind: string, real: string, make: () => string): string {
    const key = `${kind}\0${real}`;
    let value = aliases.get(key);
    if (value === undefined) {
        value = make();
        aliases.set(key, value);
    }
    return value;
}

/** Fake Matrix ID (`@abcdefgh:ijklmnop.example`) for `userId`. */
export function aliasUserId(userId: string): string {
    return alias(
        "user",
        userId,
        () => `@${randomString(8)}:${randomString(8)}.example`,
    );
}

/** Localpart of {@link aliasUserId}, for places that show the bare name. */
export function aliasUserLocalpart(userId: string): string {
    return aliasUserId(userId).slice(1).split(":")[0];
}

/** Fake homeserver host for `host` (a hostname or a URL). */
export function aliasHomeserver(host: string): string {
    return alias("server", host, () => `${randomString(8)}.example`);
}

/** Value to display: the real one, or its random alias when streaming. */
export function shownUserId(userId: string, streamerMode: boolean): string {
    return streamerMode ? aliasUserId(userId) : userId;
}

export function shownHomeserver(host: string, streamerMode: boolean): string {
    return streamerMode ? aliasHomeserver(host) : host;
}

// Steam's links for joining a friend's game: the same ones Steam's own Join Game
// button opens. Built only from parts that pass the checks here, so nothing
// else from a caller can reach the OS shell through them.

const DIGITS = /^\d{1,20}$/;
const CONTROL = /[\x00-\x1f\x7f]/;
const MAX_CONNECT = 512;

function isDigits(value) {
    return typeof value === "string" && DIGITS.test(value);
}

/** A connect string Steam can take: 1 to 512 characters, no control characters. */
function isConnectString(value) {
    return (
        typeof value === "string" &&
        value.length >= 1 &&
        value.length <= MAX_CONNECT &&
        !CONTROL.test(value)
    );
}

/**
 * The link Steam's Join Game button opens for a friend's game, or null when the
 * parts do not allow one. In the friend's lobby (lobbyId): joinlobby. Otherwise
 * the friend's game with its connect string: rungame.
 */
function steamJoinUrl({ appId, connect, steamId, lobbyId }) {
    if (!isDigits(appId)) return null;
    if (isDigits(lobbyId) && isDigits(steamId)) {
        return `steam://joinlobby/${appId}/${lobbyId}/${steamId}`;
    }
    if (isDigits(steamId) && isConnectString(connect)) {
        return `steam://rungame/${appId}/${steamId}/${encodeURIComponent(connect)}`;
    }
    return null;
}

/**
 * steam://run/<appId>//<connect>/ with the connect string URL-encoded, or null
 * when either part is not valid. Only for invites that carry no Steam id: it
 * starts the game with its arguments rather than joining the friend.
 */
function steamRunUrl({ appId, connect }) {
    if (!isDigits(appId)) return null;
    if (!isConnectString(connect)) return null;
    return `steam://run/${appId}//${encodeURIComponent(connect)}/`;
}

module.exports = { isConnectString, steamJoinUrl, steamRunUrl };

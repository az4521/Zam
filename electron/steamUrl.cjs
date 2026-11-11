// Steam's links for joining a friend's game: the same ones Steam's own Join Game
// button opens. Built only from parts that pass the checks here, so nothing
// else from a caller can reach the OS shell through them.

const DIGITS = /^\d{1,20}$/;
const CONTROL = /[\x00-\x1f\x7f]/;
const MAX_CONNECT = 512;

function isDigits(value) {
    return typeof value === "string" && DIGITS.test(value);
}

/**
 * Team Fortress 2 publishes its party-join string with one argument
 * ("+tf_party_request_join_user <steamid>"), but its own handler
 * (secure_command_line.cpp) only accepts it with a second ("... <steamid> 0"),
 * so Steam's Join Game fails with "Invalid rich presence join string". Adding
 * the second argument, 0 (no invite expected: ask to join), makes it work.
 */
const TF2_APP_ID = "440";
const TF2_PARTY_JOIN = /^\+tf_party_request_join_user \d{1,20}$/;

/** The string to hand the game: `connect`, or its fixed form for a known bug. */
function gameConnect(appId, connect) {
    return appId === TF2_APP_ID && TF2_PARTY_JOIN.test(connect)
        ? connect + " 0"
        : connect;
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
        return `steam://rungame/${appId}/${steamId}/${encodeURIComponent(gameConnect(appId, connect))}`;
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
    return `steam://run/${appId}//${encodeURIComponent(gameConnect(appId, connect))}/`;
}

module.exports = { isConnectString, steamJoinUrl, steamRunUrl };

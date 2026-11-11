// Steam's "run with arguments" link, which starts a game with a connect string
// (a server address, a lobby). Built only from parts that pass the checks here,
// so nothing else from a caller can reach the OS shell through it.

const APP_ID = /^\d{1,20}$/;
const CONTROL = /[\x00-\x1f\x7f]/;
const MAX_CONNECT = 512;

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
 * steam://run/<appId>//<connect>/ with the connect string URL-encoded, or null
 * when either part is not valid.
 */
function steamRunUrl({ appId, connect }) {
    if (typeof appId !== "string" || !APP_ID.test(appId)) return null;
    if (!isConnectString(connect)) return null;
    return `steam://run/${appId}//${encodeURIComponent(connect)}/`;
}

module.exports = { isConnectString, steamRunUrl };

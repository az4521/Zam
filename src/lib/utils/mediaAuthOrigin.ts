/**
 * Where the service worker is allowed to attach the access token.
 *
 * The SW injects `Authorization: Bearer <token>` on element-initiated requests
 * (img/video/audio) so authenticated media renders without every component
 * hand-rolling a fetch. That makes the destination check a token-exposure
 * boundary: anything it lets through gets the user's credential.
 *
 * It used to compare `hostname`, which ignores scheme and port — a message
 * whose media URL pointed at the homeserver's own hostname on an
 * attacker-controlled port (or over plain http) matched, and the token went to
 * a foreign origin (audit SEC-03). Origins must match exactly.
 *
 * `static/sw.js` is served verbatim and cannot import this module, so it
 * carries a hand-written copy of this gate; `mediaAuthOrigin.test.ts` pins the
 * two together. This module is that copy's tested reference — change both.
 *
 * Scope note: this is the *destination* check only. The SW separately refuses
 * to store a non-https homeserver URL at all (`isValidHomeserverUrl`), so in
 * practice `homeserverUrl` is always https here — which is exactly why the
 * hostname-only comparison was exploitable, since the REQUEST side had no such
 * constraint and `http://<homeserver-host>/…` matched.
 */

/**
 * The only path family the token may ever be attached to. `includes`, not
 * `startsWith`, so a homeserver mounted under a base path still matches; the
 * origin + base-path checks below constrain the rest.
 */
export const AUTHENTICATED_MEDIA_PATH = "/_matrix/client/v1/media/";

/** A pathname with a guaranteed trailing slash, so prefix tests hit a boundary. */
function pathBoundary(pathname: string): string {
    return pathname.endsWith("/") ? pathname : pathname + "/";
}

/**
 * True when `requestUrl` is an authenticated-media endpoint of exactly the
 * homeserver at `homeserverUrl` — same origin (scheme, host AND port) and
 * under its base path. Unparseable input is refused rather than guessed at.
 */
export function isAuthorisedMediaTarget(
    requestUrl: string,
    homeserverUrl: string,
): boolean {
    let reqUrl: URL;
    let hsUrl: URL;
    try {
        reqUrl = new URL(requestUrl);
        hsUrl = new URL(homeserverUrl);
    } catch {
        return false;
    }

    if (!reqUrl.pathname.includes(AUTHENTICATED_MEDIA_PATH)) return false;
    if (reqUrl.origin !== hsUrl.origin) return false;
    return pathBoundary(reqUrl.pathname).startsWith(
        pathBoundary(hsUrl.pathname),
    );
}

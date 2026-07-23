/**
 * Human-readable messages for Geolocation API failures.
 *
 * The subtlety: browsers in an insecure (non-HTTPS) context auto-deny
 * geolocation with PERMISSION_DENIED (code 1) *without ever prompting*,
 * which reads to a user exactly like "permission denied" even though no
 * dialog appeared. Branch on the secure-context bit so the message points
 * at the actual fix.
 */

/** Structural stand-in for GeolocationPositionError (jsdom lacks the class). */
export interface GeoErrorLike {
    code: number;
}

const HTTPS_HINT =
    "Location needs a secure (HTTPS) connection — open the app over https.";

/** Message for a getCurrentPosition/watchPosition error callback. */
export function geoErrorMessage(
    err: GeoErrorLike | null | undefined,
    secureContext: boolean,
): string {
    switch (err?.code) {
        case 1: // PERMISSION_DENIED
            return secureContext
                ? "Location permission was denied — check site permissions."
                : HTTPS_HINT;
        case 2: // POSITION_UNAVAILABLE
            return "Your position is unavailable (location off or no GPS fix).";
        case 3: // TIMEOUT
            return "Timed out getting your location.";
        default:
            return "Couldn't get your location.";
    }
}

/** Message for when navigator.geolocation itself is missing. */
export function geolocationUnavailableMessage(secureContext: boolean): string {
    return secureContext
        ? "Location isn't available in this browser."
        : HTTPS_HINT;
}

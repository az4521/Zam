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
import { t } from "$lib/i18n";
export interface GeoErrorLike {
    code: number;
}

const HTTPS_HINT = t("geoErrors.locationNeedsASecureHttpsConnection");

/** Message for a getCurrentPosition/watchPosition error callback. */
export function geoErrorMessage(
    err: GeoErrorLike | null | undefined,
    secureContext: boolean,
): string {
    switch (err?.code) {
        case 1: // PERMISSION_DENIED
            return secureContext
                ? t("geoErrors.locationPermissionWasDeniedCheckSite")
                : HTTPS_HINT;
        case 2: // POSITION_UNAVAILABLE
            return t("geoErrors.yourPositionIsUnavailableLocationOff");
        case 3: // TIMEOUT
            return t("geoErrors.timedOutGettingYourLocation");
        default:
            return t("geoErrors.couldnTGetYourLocation");
    }
}

/** Message for when navigator.geolocation itself is missing. */
export function geolocationUnavailableMessage(secureContext: boolean): string {
    return secureContext
        ? t("geoErrors.locationIsnTAvailableInThis")
        : HTTPS_HINT;
}

// The provider's account management page (MSC2965 / Matrix spec "account
// management URL"). Under a native OAuth session the homeserver no longer owns
// passwords, devices or deactivation, so the app links out to this page.

/**
 * Actions the spec defines for the account management URL's `action` param
 * (spec v1.18, MSC4191 names). Providers may still advertise the pre-MSC4191
 * names, see {@link ACTION_CANDIDATES}.
 */
export type AccountManagementAction =
    | "org.matrix.profile"
    | "org.matrix.devices_list"
    | "org.matrix.device_view"
    | "org.matrix.device_delete"
    | "org.matrix.account_deactivate"
    | "org.matrix.cross_signing_reset";

/**
 * Names each action may be advertised under, stable first. The legacy names
 * are the pre-MSC4191 `org.matrix.sessions_list` / `session_view` /
 * `session_end`.
 */
const ACTION_CANDIDATES: Record<AccountManagementAction, readonly string[]> = {
    "org.matrix.profile": ["org.matrix.profile"],
    "org.matrix.devices_list": [
        "org.matrix.devices_list",
        "org.matrix.sessions_list",
    ],
    "org.matrix.device_view": [
        "org.matrix.device_view",
        "org.matrix.session_view",
    ],
    "org.matrix.device_delete": [
        "org.matrix.device_delete",
        "org.matrix.session_end",
    ],
    "org.matrix.account_deactivate": ["org.matrix.account_deactivate"],
    "org.matrix.cross_signing_reset": ["org.matrix.cross_signing_reset"],
};

/** Actions that act on one device, so take a `device_id`. */
const DEVICE_ACTIONS: ReadonlySet<string> = new Set([
    "org.matrix.device_view",
    "org.matrix.session_view",
    "org.matrix.device_delete",
    "org.matrix.session_end",
]);

/**
 * `base` with `action` (and `device_id` for a single device) applied. The
 * action is only added when the provider lists it, under its stable name or
 * its legacy one (stable wins); otherwise the bare page is returned so the
 * link still lands somewhere useful. Null when `base` is not an https URL, so
 * a hostile or broken metadata document cannot make the app open a
 * `javascript:` or `data:` link.
 */
export function buildAccountManagementUrl(
    base: string | undefined | null,
    opts: {
        action?: AccountManagementAction;
        deviceId?: string;
        supportedActions?: string[];
    } = {},
): string | null {
    if (!base) return null;
    let url: URL;
    try {
        url = new URL(base);
    } catch {
        return null;
    }
    if (url.protocol !== "https:") return null;
    const { action, deviceId, supportedActions } = opts;
    if (action) {
        const chosen = ACTION_CANDIDATES[action].find((name) =>
            supportedActions?.includes(name),
        );
        if (chosen) {
            url.searchParams.set("action", chosen);
            if (deviceId && DEVICE_ACTIONS.has(chosen))
                url.searchParams.set("device_id", deviceId);
        }
    }
    return url.href;
}

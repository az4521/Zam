// The provider's account management page (MSC2965 / Matrix spec "account
// management URL"). Under a native OAuth session the homeserver no longer owns
// passwords, devices or deactivation, so the app links out to this page.

/** Actions the spec defines for the account management URL's `action` param. */
export type AccountManagementAction =
    | "org.matrix.profile"
    | "org.matrix.sessions_list"
    | "org.matrix.session_view"
    | "org.matrix.account_deactivate"
    | "org.matrix.cross_signing_reset";

/**
 * `base` with `action` (and `device_id` for a single session) applied. The
 * action is only added when the provider lists it as supported; otherwise the
 * bare page is returned so the link still lands somewhere useful. Null when
 * `base` is not an https URL, so a hostile or broken metadata document cannot
 * make the app open a `javascript:` or `data:` link.
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
    if (action && supportedActions?.includes(action)) {
        url.searchParams.set("action", action);
        if (deviceId && action === "org.matrix.session_view")
            url.searchParams.set("device_id", deviceId);
    }
    return url.href;
}

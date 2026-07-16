/**
 * Ask for OS notification permission. Call from a user gesture — iOS Safari
 * requires one before it will show the prompt.
 *
 * Deliberately NOT requestWebPushPermission(): that one refuses ("unsupported")
 * when no VAPID key is configured, because it is about push subscriptions.
 * Ringing needs the Notification API and nothing else.
 */
export async function requestNotificationPermission(): Promise<
    NotificationPermission | "unsupported"
> {
    if (typeof Notification === "undefined") return "unsupported";
    if (Notification.permission !== "default") return Notification.permission;
    try {
        return await Notification.requestPermission();
    } catch {
        return "denied";
    }
}

/**
 * The warning to show beside the "ring for incoming calls" toggle for a given
 * notification-permission state, or null when nothing needs saying.
 *
 * The ring *sound* plays regardless of this permission; what a blocked/absent
 * permission costs is the visual "X is calling" OS alert that surfaces a call
 * while the window is hidden or in the tray. `default` returns null — the
 * toggle prompts from there, so there is nothing to warn about yet.
 */
export function callAlertHint(
    permission: NotificationPermission | "unsupported",
): string | null {
    if (permission === "denied")
        return "Notifications are blocked, so incoming calls won't alert you when this window is hidden. Unblock notifications in your system settings.";
    if (permission === "unsupported")
        return "This browser can't show call alerts when the window is hidden.";
    return null;
}

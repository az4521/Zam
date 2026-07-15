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

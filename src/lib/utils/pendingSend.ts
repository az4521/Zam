/**
 * Whether a local echo's send status means the server hasn't confirmed it
 * yet. Such a message renders greyed out, so leaving the app before it lands
 * is visible (a send interrupted that way may never go out). Takes the SDK's
 * EventStatus string values ("queued", "encrypting", "sending") so this stays
 * free of SDK imports. NOT_SENT is a failure, shown by its own indicator.
 */
export function isPendingSendStatus(
    status: string | null | undefined,
): boolean {
    return (
        status === "queued" || status === "encrypting" || status === "sending"
    );
}

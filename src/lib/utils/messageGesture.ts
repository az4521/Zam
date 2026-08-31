// Pure resolver for the message-row context-menu gesture.
//
// The device-local "hold vs tap" toggle makes the mobile actions bar open on
// EITHER a tap OR a hold, never both (Tap XOR Hold). This is the single place
// that decides, for a given pointer gesture, whether the menu should open.
// Item 6 (swipe-to-reply) stacks on this branch and adds a "swipe" gesture
// that this resolver deliberately ignores — swipe owns reply/edit, never the
// context menu.

/** Which pointer gesture is wired to open the message context menu. */
export type MessageMenuMode = "tap" | "hold";

/** A pointer gesture the message row can produce. "swipe" is item 6's. */
export type RowGesture = "tap" | "hold" | "swipe";

/**
 * True when `gesture` should open the message context menu under `mode`.
 * The menu opens only when the gesture matches the active mode; a swipe
 * never opens it (it is neither "tap" nor "hold").
 */
export function shouldOpenMessageMenu(
    mode: MessageMenuMode,
    gesture: RowGesture,
): boolean {
    return gesture === mode;
}

/** Map the device-local bool setting to the active mode. false = tap (default). */
export function menuModeFromSetting(holdToOpen: boolean): MessageMenuMode {
    return holdToOpen ? "hold" : "tap";
}

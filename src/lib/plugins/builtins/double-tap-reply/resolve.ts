// Pure double-tap action resolver for the double-tap-reply built-in plugin.
// No SDK/DOM/localStorage imports — carries only plain strings.

export type DoubleTapAction = "none" | "reaction" | "reply" | "edit";

function normalize(value: string, allowEdit: boolean): DoubleTapAction {
    if (value === "reaction" || value === "reply") return value;
    if (allowEdit && value === "edit") return "edit";
    return "none";
}

/** Which action fires for this tap. `edit` is only valid for your own
 *  messages; for others it collapses to `none`. */
export function resolveDoubleTapAction(
    isOwn: boolean,
    ownAction: string,
    otherAction: string,
): DoubleTapAction {
    return isOwn ? normalize(ownAction, true) : normalize(otherAction, false);
}

/** True iff a double-tap would DO something (either side non-none). Drives
 *  conditional handler registration so the desktop word-select is only stolen
 *  when an action is actually configured. */
export function isActive(ownAction: string, otherAction: string): boolean {
    return (
        resolveDoubleTapAction(true, ownAction, otherAction) !== "none" ||
        resolveDoubleTapAction(false, ownAction, otherAction) !== "none"
    );
}

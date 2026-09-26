// Pure map from an emitted swipe threshold + editability + the enable flag to the
// plugin's action. Edit is offered only when the message is editable (your own text);
// short is always a reply; a disabled swipe does nothing. Self-contained (no src/lib/utils
// import) so the built-in plugin stays portable.
export type SwipePluginAction = "reply" | "edit" | "none";

export function resolveSwipeAction(
    threshold: "short" | "far",
    canEdit: boolean,
    enabled: boolean,
): SwipePluginAction {
    if (!enabled) return "none";
    if (threshold === "far" && canEdit) return "edit";
    return "reply";
}

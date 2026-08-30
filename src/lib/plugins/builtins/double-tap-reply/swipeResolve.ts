// Pure map from an emitted swipe threshold + ownership + the enable flag to the
// plugin's action. Edit is offered only on your own messages; short is always a
// reply; a disabled swipe does nothing. Self-contained (no src/lib/utils import)
// so the built-in plugin stays portable.
export type SwipePluginAction = "reply" | "edit" | "none";

export function resolveSwipeAction(
    threshold: "short" | "far",
    isOwn: boolean,
    enabled: boolean,
): SwipePluginAction {
    if (!enabled) return "none";
    if (threshold === "far" && isOwn) return "edit";
    return "reply";
}

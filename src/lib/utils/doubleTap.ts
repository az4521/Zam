export type DoubleTapAction = "none" | "reaction" | "reply" | "edit";

export interface TapPoint {
    at: number;
    x: number;
    y: number;
}

export function normalizeDoubleTapAction(
    value: string | null,
    fallback: DoubleTapAction,
    allowEdit: boolean,
): DoubleTapAction {
    if (value === "none" || value === "reaction" || value === "reply")
        return value;
    if (allowEdit && value === "edit") return value;
    return fallback;
}

export function isDoubleTap(
    previous: TapPoint | null,
    current: TapPoint,
): boolean {
    if (!previous) return false;
    const elapsed = current.at - previous.at;
    return (
        elapsed > 0 &&
        elapsed <= 350 &&
        Math.hypot(current.x - previous.x, current.y - previous.y) <= 32
    );
}

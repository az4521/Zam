export interface TapPoint {
    at: number;
    x: number;
    y: number;
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

// Momentum-aware settle logic for the mobile navigation drawer.
//
// The drawer follows the finger 1:1 while dragging; on release it must decide
// whether to settle open or closed and how long that settle should take. A pure
// position threshold ignores a fast flick (you throw it and nothing happens) and
// a fixed-duration tween ignores how fast you let go (the tail crawls or feels
// detached). This resolves both: direction wins when you flick, position decides
// otherwise, and the duration scales with the remaining distance and release
// speed so the animation inherits the fling's momentum.

export interface DrawerSnapDecision {
    open: boolean;
    durationMs: number;
}

// px/ms (~350 px/s). Above this, the flick direction overrides the position.
const FLICK_VELOCITY = 0.35;
// Fraction of travel needed to commit when the release is not a flick.
const POSITION_THRESHOLD = 0.5;

export const MIN_SNAP_MS = 120;
export const MAX_SNAP_MS = 320;

/**
 * Decide how a drawer drag should settle.
 *
 * @param translate current translateX in px, expected in [-width, 0]
 *   (−width = fully closed, 0 = fully open); values outside are clamped.
 * @param width full drawer width in px (> 0).
 * @param velocity horizontal release velocity in px/ms; positive opens
 *   (rightward), negative closes (leftward).
 */
export function decideDrawerSnap(
    translate: number,
    width: number,
    velocity: number,
): DrawerSnapDecision {
    const clamped = Math.min(0, Math.max(-width, translate));
    const progress = width > 0 ? (clamped + width) / width : 0; // 0 closed .. 1 open

    let open: boolean;
    if (velocity > FLICK_VELOCITY) open = true;
    else if (velocity < -FLICK_VELOCITY) open = false;
    else open = progress >= POSITION_THRESHOLD;

    const target = open ? 0 : -width;
    const remaining = Math.abs(target - clamped);
    // Floor the speed so a zero-velocity release still settles within MAX_SNAP_MS
    // rather than dividing by ~0.
    const referenceSpeed = width / MAX_SNAP_MS;
    const speed = Math.max(Math.abs(velocity), referenceSpeed);
    const durationMs = Math.min(
        MAX_SNAP_MS,
        Math.max(MIN_SNAP_MS, remaining / speed),
    );

    return { open, durationMs };
}

// Width of the room widgets panel on desktop, in px. The panel sits on the
// right of the room column and is resized from its left edge. The timeline
// beside it keeps at least ROOM_TIMELINE_MIN_W, so a wide panel cannot squeeze
// the conversation out.

export const WIDGETS_PANEL_MIN_W = 280;
/** 28rem, the panel's historical fixed width. */
export const WIDGETS_PANEL_DEFAULT_W = 448;
export const ROOM_TIMELINE_MIN_W = 360;

/** The widest the panel may be inside a room column `roomAreaWidth` px wide
 *  (timeline plus panel). Never narrower than the panel minimum. */
export function widgetsPanelMaxWidth(roomAreaWidth: number): number {
    return Math.max(
        WIDGETS_PANEL_MIN_W,
        Math.floor(roomAreaWidth - ROOM_TIMELINE_MIN_W),
    );
}

/** Clamp a requested panel width to the allowed range for this room column. */
export function clampWidgetsPanelWidth(
    width: number,
    roomAreaWidth: number,
): number {
    const w = Number.isFinite(width) ? width : WIDGETS_PANEL_DEFAULT_W;
    return Math.round(
        Math.min(
            widgetsPanelMaxWidth(roomAreaWidth),
            Math.max(WIDGETS_PANEL_MIN_W, w),
        ),
    );
}

/** A stored width, or null when nothing usable is stored. */
export function parseStoredWidgetsPanelWidth(
    raw: string | null,
): number | null {
    if (raw === null) return null;
    const v = Number(raw);
    return Number.isFinite(v) && v > 0 ? v : null;
}

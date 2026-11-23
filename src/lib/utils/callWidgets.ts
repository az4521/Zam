/**
 * Keys for room widgets shown as tiles inside the call view. A widget tile
 * shares the focus key space with video tiles (`voiceCallState.focusedTileKey`)
 * but uses its own prefix, so it can never collide with an identity-based
 * video key (those start with "@").
 */
const CALL_WIDGET_KEY_PREFIX = "widget:";

/** The focus/tile key of an open call widget. */
export function callWidgetKey(id: string): string {
    return CALL_WIDGET_KEY_PREFIX + id;
}

/** The widget id a tile key belongs to, or null for a video tile key. */
export function widgetIdFromTileKey(key: string | null): string | null {
    if (!key || !key.startsWith(CALL_WIDGET_KEY_PREFIX)) return null;
    const id = key.slice(CALL_WIDGET_KEY_PREFIX.length);
    return id === "" ? null : id;
}

// The desktop room list's width (px): user-resizable, saved per browser. Shared
// by AppShell and the launch skeleton so the placeholder is as wide as the list
// that replaces it.
export const ROOM_LIST_WIDTH_KEY = "layout.roomListWidth";
export const ROOM_LIST_MIN_W = 200;
export const ROOM_LIST_DEFAULT_W = 240;

export function roomListMaxWidth(viewportWidth: number): number {
    return Math.max(ROOM_LIST_MIN_W, Math.min(640, viewportWidth * 0.5));
}

export function clampRoomListWidth(w: number, viewportWidth: number): number {
    return Math.round(
        Math.min(roomListMaxWidth(viewportWidth), Math.max(ROOM_LIST_MIN_W, w)),
    );
}

/** The saved width, clamped to this window, or the default. */
export function loadRoomListWidth(viewportWidth: number): number {
    try {
        const v = Number(localStorage.getItem(ROOM_LIST_WIDTH_KEY));
        return v > 0
            ? clampRoomListWidth(v, viewportWidth)
            : ROOM_LIST_DEFAULT_W;
    } catch {
        return ROOM_LIST_DEFAULT_W;
    }
}

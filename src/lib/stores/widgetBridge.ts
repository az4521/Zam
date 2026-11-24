// Glue between room widgets and the rest of the app: the template variables a
// widget URL is filled with, and how a widget's navigation request is carried
// out. Shared by WidgetFrame and WidgetModalDialog.

import { getLocale } from "$lib/i18n";
import { settingsState } from "$lib/stores/settings.svelte";
import { buildWidgetUrl, type RoomWidget } from "$lib/utils/widgets";
import { widgetUrlContext } from "$lib/matrix/widgetHost";
import { getRoom, getRoomIdForAlias } from "$lib/matrix/client";
import { navigateToRoom, setActiveSpace } from "$lib/stores/rooms.svelte";
import {
    assertWidgetRoomJoined,
    widgetLinkTarget,
} from "$lib/utils/widgetNavigation";

/** The app's base theme as a widget theme. Amoled is a dark theme. */
export function currentWidgetTheme(): "light" | "dark" {
    return settingsState.theme === "light" ? "light" : "dark";
}

/**
 * The widget's URL with its `$placeholders` filled in for the current user
 * and room, or null when there is no signed-in client to fill them from.
 * Used for the iframe and for the "open in browser" link.
 */
export function templatedWidgetUrl(
    roomId: string,
    w: RoomWidget,
): string | null {
    const ctx = widgetUrlContext(roomId, currentWidgetTheme(), getLocale());
    if (!ctx) return null;
    return buildWidgetUrl(w, ctx, location.origin + location.pathname);
}

/**
 * Carries out a navigation a widget asked for. Only rooms the user has already
 * joined are shown; an alias is resolved first, and a space focuses the space.
 * Rejects when the link is refused, so the widget gets an error back.
 */
export async function navigateWidgetLink(uri: string): Promise<void> {
    const target = widgetLinkTarget(uri);
    const roomId =
        target.kind === "alias"
            ? (await getRoomIdForAlias(target.alias)).roomId
            : target.roomId;
    const room = getRoom(roomId);
    assertWidgetRoomJoined(room?.getMyMembership());
    if (room?.isSpaceRoom()) {
        setActiveSpace(roomId);
        return;
    }
    navigateToRoom(roomId, target.eventId);
}

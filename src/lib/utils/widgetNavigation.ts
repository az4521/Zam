// Pure rules for a widget navigating Zam to a matrix link. The async part
// (alias resolution, space and room switching) lives in stores/widgetBridge.ts.

import { parseMatrixLink } from "./matrixLinks";

export type WidgetLinkTarget =
    | { kind: "alias"; alias: string; eventId?: string }
    | { kind: "room"; roomId: string; eventId?: string };

/**
 * The room or alias a widget asked to open. Throws for user links, which
 * widgets may not open, and for anything that is not a matrix link.
 */
export function widgetLinkTarget(uri: string): WidgetLinkTarget {
    const target = parseMatrixLink(uri);
    if (!target) throw new Error("unsupported link");
    if (target.kind === "user") {
        throw new Error("user links are not supported in widgets");
    }
    if (target.kind === "alias") {
        return { kind: "alias", alias: target.alias, eventId: target.eventId };
    }
    return { kind: "room", roomId: target.roomId, eventId: target.eventId };
}

/** Widgets may show rooms the user is in, never join one for them. */
export function assertWidgetRoomJoined(
    membership: string | null | undefined,
): void {
    if (membership !== "join") throw new Error("not joined");
}

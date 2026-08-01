/**
 * Pure ordering for a space's `m.space.child` state. Lifted out of client.ts so
 * the comparator is unit-testable and so client.ts can memoize the result: the
 * sort runs twice per space on every unread tick via SpaceSidebar's badge walk.
 */
import { compareOrderLex } from "./orderKey";

export interface SpaceChildDescriptor {
    eventId: string;
    stateKey: string;
    via: unknown;
    order: unknown;
    ts: number;
}

export function compareChildOrder(
    a: SpaceChildDescriptor,
    b: SpaceChildDescriptor,
): number {
    const byOrder = compareOrderLex(
        a.order as string | undefined,
        b.order as string | undefined,
    );
    if (byOrder !== 0) return byOrder;
    // Equal/both-missing order: the spec's primary no-order tie-break is the
    // child event's origin_server_ts ascending, then room ID for stability.
    const byTs = a.ts - b.ts;
    if (byTs !== 0) return byTs;
    return a.stateKey < b.stateKey ? -1 : 1;
}

export function sortSpaceChildIds(events: SpaceChildDescriptor[]): string[] {
    return events
        .filter((e) => Array.isArray(e.via) && e.via.length > 0)
        .sort(compareChildOrder)
        .map((e) => e.stateKey)
        .filter(Boolean);
}

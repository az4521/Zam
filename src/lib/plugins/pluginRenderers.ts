/**
 * Rules for `zam.messages.registerRenderer`. A plugin may only render what
 * Zam has no view of its own for (ARCHITECTURE: nothing that displays a
 * standard event may sit behind a plugin), so `m.`-namespaced types and
 * msgtypes, and the unstable types Zam renders (polls, file offers, calls),
 * are refused. Pure — no SDK or DOM imports.
 */
import type { MessageRenderer } from "./types";
import { isPollStartEventType } from "../utils/pollContent";
import { isFileOfferEventType } from "../utils/fileTransfer";
import { isCallEventType } from "../utils/callSummary";

/** Why `r` can't be registered, or null if it can. */
export function rendererProblem(r: MessageRenderer): string | null {
    if (!r || typeof r.render !== "function")
        return "a renderer needs a render function";
    const { eventType, msgtype } = r;
    if ((eventType === undefined) === (msgtype === undefined))
        return "give exactly one of eventType or msgtype";
    const name = (eventType ?? msgtype) as unknown;
    if (typeof name !== "string" || name === "")
        return "eventType/msgtype must be a non-empty string";
    if (name.startsWith("m."))
        return `${name} is a standard Matrix type, which Zam renders itself`;
    if (
        eventType !== undefined &&
        (isPollStartEventType(eventType) ||
            isFileOfferEventType(eventType) ||
            isCallEventType(eventType))
    )
        return `${eventType} is rendered by Zam`;
    return null;
}

/** The renderer for an event, the first registered winning. */
export function findRenderer(
    renderers: readonly MessageRenderer[],
    eventType: string,
    msgtype: string | undefined,
): MessageRenderer | null {
    for (const r of renderers) {
        if (r.eventType !== undefined && r.eventType === eventType) return r;
        if (
            r.msgtype !== undefined &&
            eventType === "m.room.message" &&
            r.msgtype === msgtype
        )
            return r;
    }
    return null;
}

/** The custom event types that should reach the timeline. */
export function rendererEventTypes(
    renderers: readonly MessageRenderer[],
): Set<string> {
    const types = new Set<string>();
    for (const r of renderers) if (r.eventType) types.add(r.eventType);
    return types;
}

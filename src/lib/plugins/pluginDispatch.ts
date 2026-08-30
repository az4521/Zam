/**
 * Pure, error-isolated fan-out for the imperative plugin hooks: the double-tap
 * gesture signal and the named event bus (spec §6/§7). Each handler runs in a
 * try/catch so one throwing plugin never breaks the gesture or drops the other
 * subscribers. Types only — no SDK/DOM imports; the live wiring that builds the
 * payloads lives in the components / pluginBoot.
 */
import type {
    DoubleTapHandler,
    SwipeHandler,
    SwipeThreshold,
    EventSubscription,
    PluginEventName,
} from "./types";

export function dispatchDoubleTap(
    handlers: DoubleTapHandler[],
    ctx: { roomId: string; eventId: string; isOwn: boolean },
): void {
    for (const handler of handlers) {
        try {
            handler(ctx);
        } catch (e) {
            console.error("[zam] onDoubleTap handler threw", e);
        }
    }
}

export function dispatchSwipe(
    handlers: SwipeHandler[],
    ctx: {
        roomId: string;
        eventId: string;
        isOwn: boolean;
        threshold: SwipeThreshold;
    },
): void {
    for (const handler of handlers) {
        try {
            handler(ctx);
        } catch (e) {
            console.error("[zam] onSwipe handler threw", e);
        }
    }
}

export function dispatchPluginEvent(
    subs: EventSubscription[],
    name: PluginEventName,
    payload: unknown,
): void {
    for (const sub of subs) {
        if (sub.event !== name) continue;
        try {
            sub.handler(payload);
        } catch (e) {
            console.error(`[zam] events.on(${name}) handler threw`, e);
        }
    }
}

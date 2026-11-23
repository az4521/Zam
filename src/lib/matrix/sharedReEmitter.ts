/**
 * Shared-forwarder replacement for matrix-js-sdk's `ReEmitter.reEmit`.
 *
 * Why: the SDK's ReEmitter creates one closure per (source object, event name)
 * and one Map per source. The client re-emits events from every User,
 * RoomMember, MatrixEvent and Room, so a live session held ~169,000 of these
 * closures (plus their contexts and ~70k Maps), roughly 10-15 MB of heap.
 *
 * What: `installSharedReEmitter()` replaces `ReEmitter.prototype.reEmit` and
 * `stopReEmitting`. Each ReEmitter instance now keeps ONE forwarder function per
 * event name, shared by every source it re-emits from. The source is recovered
 * from the forwarder's `this`, so the target still receives
 * `(...args, source)` exactly as before. `TypedReEmitter` inherits both methods,
 * so it is covered by the same patch.
 *
 * Contract this relies on:
 * - The `events` EventEmitter (the SDK's base class, and Node's builtin one)
 *   invokes listeners with `this` set to the emitting object. Verified against
 *   `events` 3.3.0 (`ReflectApply(handler, this, args)`).
 * - No code invokes a re-emitted source's listeners directly with a different
 *   `this`. `TypedEventEmitter.emitPromised` does this (`l(...args)`), so it
 *   must never be used on a source that is re-emitted. Today only
 *   `SlidingSync` uses it, and nothing re-emits from `SlidingSync`.
 * - `ReEmitter` keeps its target in a field named `target` (runtime name; it
 *   is TypeScript-private only). The per-instance forwarder map lives in a
 *   module-level WeakMap, so no fields are added to SDK objects.
 */
import type { EventEmitter } from "events";
import { ReEmitter } from "matrix-js-sdk/lib/ReEmitter.js";

type Forwarder = (this: EventEmitter, ...args: unknown[]) => void;

const forwardersByReEmitter = new WeakMap<ReEmitter, Map<string, Forwarder>>();
let installed = false;

function targetOf(reEmitter: ReEmitter): EventEmitter {
    return (reEmitter as unknown as { target: EventEmitter }).target;
}

function forwarderFor(reEmitter: ReEmitter, eventName: string): Forwarder {
    let byEvent = forwardersByReEmitter.get(reEmitter);
    if (!byEvent) {
        byEvent = new Map();
        forwardersByReEmitter.set(reEmitter, byEvent);
    }
    let forwarder = byEvent.get(eventName);
    if (!forwarder) {
        forwarder = function (this: EventEmitter, ...args: unknown[]): void {
            const target = targetOf(reEmitter);
            // Same as the SDK: a missing 'error' listener on the target must
            // not make the re-emit throw.
            if (eventName === "error" && target.listenerCount("error") === 0)
                return;
            target.emit(eventName, ...args, this);
        };
        byEvent.set(eventName, forwarder);
    }
    return forwarder;
}

/**
 * Patch ReEmitter.prototype so every instance shares one forwarder per event
 * name. Idempotent. Must run before any ReEmitter starts re-emitting; the
 * client calls it at module load.
 */
export function installSharedReEmitter(): void {
    if (installed) return;
    installed = true;

    ReEmitter.prototype.reEmit = function (
        this: ReEmitter,
        source: EventEmitter,
        eventNames: string[],
    ): void {
        for (const eventName of eventNames) {
            const forwarder = forwarderFor(this, eventName);
            if (!source.listeners(eventName).includes(forwarder)) {
                source.on(eventName, forwarder);
            }
        }
    };

    ReEmitter.prototype.stopReEmitting = function (
        this: ReEmitter,
        source: EventEmitter,
        eventNames: string[],
    ): void {
        const byEvent = forwardersByReEmitter.get(this);
        if (!byEvent) return; // never re-emitting anything from this instance
        for (const eventName of eventNames) {
            const forwarder = byEvent.get(eventName);
            if (forwarder) source.off(eventName, forwarder);
        }
    };
}

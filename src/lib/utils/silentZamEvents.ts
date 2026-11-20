/**
 * Zam room events that are commands, not messages. They live in the room so
 * every member's client can act on them, but they must never render, count as
 * unread, notify, or show as a preview. Add a type here and every surface that
 * reads this predicate follows.
 *
 * `static/sw.js` and `MatrixMessagingService.java` cannot import this module,
 * so they carry the same literal. `silentZamEvents.test.ts` checks that they
 * still do.
 */
import { CALL_KICK_EVENT_TYPE } from "./callKick";

export const SILENT_ZAM_EVENT_TYPES: readonly string[] = [CALL_KICK_EVENT_TYPE];

export function isSilentZamEvent(type: string): boolean {
    return SILENT_ZAM_EVENT_TYPES.includes(type);
}

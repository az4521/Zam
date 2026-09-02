/**
 * Imperative host side-effects that need live components not yet built this
 * item. Items 8 (openPopover), 9 (startReply), and the UI shell (notify) set
 * these slots at boot; until then the host API's imperative UI methods are
 * safe, documented no-ops. Kept a plain module (not $state) — these are
 * effect callbacks, like interface.svelte.ts's focusComposer, never rendered.
 */
import type { Disposable } from "./types";

export const hostBridge = {
    /** Set by item 8 (composer buttons + custom-UI mount). */
    openPopover: null as
        | null
        | ((opts: {
              anchor: HTMLElement;
              render(el: HTMLElement): void | (() => void);
          }) => Disposable),
    /** Set by the UI shell — routes to the existing notification/toast path. */
    notify: null as null | ((opts: { title?: string; body: string }) => void),
    /** Set by item 9 (startReply) — sets the composer's reply target. */
    startReply: null as
        | null
        | ((ctx: { roomId: string; eventId: string }) => void),
    /** Set by the double-tap-reply migration (item 16) — start inline edit of
     *  your own text message. Guards own+m.text host-side. */
    startEdit: null as
        | null
        | ((ctx: { roomId: string; eventId: string }) => void),
    /** Set by the GIF-picker migration (item 14) — appends text to the active
     *  main composer for a room (URL-as-text rail). */
    insertText: null as
        | null
        | ((ctx: { roomId: string; text: string }) => void),
    /** Set by item 7 (call-menu "Mention") — insert an @mention for a user into
     *  the active room's main composer. */
    insertMention: null as
        | null
        | ((ctx: { roomId: string; userId: string }) => void),
    /** Queue slot: a mention requested before the composer has claimed the hook
     *  (the composer mounts asynchronously after the call→chat view flip).
     *  Drained + cleared by the composer's claim effect. */
    pendingMention: null as null | { roomId: string; userId: string },
};

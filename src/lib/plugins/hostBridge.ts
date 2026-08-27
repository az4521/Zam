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
};

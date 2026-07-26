// Centralised UI/interface state.
//
// Two mutually-exclusive "slots":
//   - modal:   the single open popup / modal / context-menu / picker.
//   - sidebar: the single open side panel (member list, pinned, notifications).
//
// Components no longer track their own open/closed booleans — they render based
// on `interfaceState.modal === "<id>"` / `interfaceState.sidebar === "<id>"` and
// open/close through the helpers below. The main page (+page.svelte) owns the
// global Escape-key and mobile back-button handling and operates on this store.

export type ModalId =
    | "app-settings"
    | "room-settings"
    | "quick-actions"
    | "room-menu"
    | "room-header-menu"
    | "space-menu"
    | "account-switcher"
    | "color-picker"
    | "create-room"
    | "add-room"
    | "invite"
    | "room-directory"
    | "reaction-picker"
    | "report-message"
    | "forward-message"
    | "composer-picker"
    | "composer-actions"
    | "create-poll"
    | "share-location"
    | "profile-card"
    | "lightbox"
    // Shared by two call sites (RoomList roster rows, CallView tiles). Both
    // hold a claim token and release with clearModalIfOwner, so a second claim
    // supersedes the first cleanly instead of stranding it.
    | "call-participant-menu";

export type SidebarId =
    | "members"
    | "pinned"
    | "notifications"
    | "search"
    | "threads";

export const interfaceState = $state({
    isMobile: false,
    isTouchscreen: false,
    /** Mobile space/room drawer (distinct from the content sidebars below). */
    leftOpen: false,
    /** Fullscreen image/video viewer open. Mirrors the modal slot holding
     *  "lightbox" — maintained here, never written by components. */
    lightboxOpen: false,
    selectedMessageId: null as string | null,
    /** Dev DebugPanel visibility (toggled by the global Ctrl+Shift+D shortcut). */
    debugOpen: false,
    /** Which composer picker the "composer-picker" modal is showing. */
    composerPicker: null as "emoji" | "sticker" | "gif" | null,
    /** Focuses the message composer, if one is mounted (set by MessageInput). */
    focusComposer: null as null | (() => void),

    /** The single open popup/modal, or null. */
    modal: null as ModalId | null,
    /** Closes the open modal (runs its cleanup). Set alongside `modal`. */
    modalClose: null as null | (() => void),
    /** The single open side panel, or null. */
    sidebar: null as SidebarId | null,
    /** Closes the open sidebar (runs its cleanup). Set alongside `sidebar`. */
    sidebarClose: null as null | (() => void),
    /** Room currently shown as a call view instead of its timeline. The app
     *  shell renders CallView when this matches the active room. */
    callViewRoomId: null as string | null,
});

/** Opaque handle for one occupancy of a slot. See `openModal`. */
export type SlotToken = number;

// Monotonic claim tokens for the modal/sidebar slots.
//
// Deliberately module-scope plain `let`s and NOT fields on `interfaceState`:
// teardown paths (onMount cleanup, $effect destroy) read them, and reading a
// $state field from a tracked scope would register a reactive dependency.
let nextSlotToken = 1;
let modalToken: SlotToken = 0;
let sidebarToken: SlotToken = 0;

/** Open (or toggle off) a composer emoji/sticker/gif picker. */
export function openComposerPicker(kind: "emoji" | "sticker" | "gif"): void {
    if (
        interfaceState.modal === "composer-picker" &&
        interfaceState.composerPicker === kind
    ) {
        closeModal();
        return;
    }
    // Claim first: the outgoing owner's close nulls `composerPicker`.
    openModal("composer-picker", () => (interfaceState.composerPicker = null));
    interfaceState.composerPicker = kind;
}

/**
 * Claim the modal/popup slot, returning the token that identifies THIS
 * occupancy. Whatever held the slot is closed first — including another
 * instance holding the SAME id, whose `close` would otherwise never run and
 * whose UI would strand.
 *
 * ORDERING CONTRACT: claim FIRST, then assign your local state. The outgoing
 * owner's `close()` runs synchronously inside this call, and on a same-id
 * handover that callback typically resets the very field you are about to set.
 * That close runs while the slot is EMPTY, so a close handler must never
 * assume the slot still names it.
 *
 * Keep the returned token and release with `clearModalIfOwner(token)` so a
 * stale instance can never null a slot someone else now owns.
 */
export function openModal(id: ModalId, close: () => void): SlotToken {
    // Release the slot BEFORE running the outgoing close: it then executes
    // against an empty slot and cannot clobber (or be clobbered by) the
    // incoming owner, whatever it does — including re-entering this API.
    const prev = interfaceState.modalClose;
    modalToken = 0;
    interfaceState.modal = null;
    interfaceState.modalClose = null;
    interfaceState.lightboxOpen = false;
    prev?.();

    const token = nextSlotToken++;
    modalToken = token;
    interfaceState.modal = id;
    interfaceState.modalClose = close;
    interfaceState.lightboxOpen = id === "lightbox";
    return token;
}

/** Dismiss the open modal, running its close handler. */
export function closeModal(): void {
    const close = interfaceState.modalClose;
    modalToken = 0;
    interfaceState.modal = null;
    interfaceState.modalClose = null;
    interfaceState.lightboxOpen = false;
    close?.();
}

/** Release the modal slot if `token` still owns it, without re-running its
 *  close handler. Used by a component whose modal was dismissed by its own
 *  means (unmount, self-close). Returns whether the slot was released — a
 *  stale token is a silent no-op, which is the whole point. */
export function clearModalIfOwner(token: SlotToken): boolean {
    if (token === 0 || modalToken !== token) return false;
    modalToken = 0;
    interfaceState.modal = null;
    interfaceState.modalClose = null;
    interfaceState.lightboxOpen = false;
    return true;
}

/** Show a room's call view. Does NOT join the call — peeking is allowed. */
export function showCallView(roomId: string): void {
    interfaceState.callViewRoomId = roomId;
}

/** Flip back to the timeline. */
export function showChatView(): void {
    interfaceState.callViewRoomId = null;
}

/** Claim the side-panel slot, returning this occupancy's token. Same ownership
 *  and ordering rules as `openModal`. */
export function openSidebar(id: SidebarId, close: () => void): SlotToken {
    // Release the slot BEFORE running the outgoing close — see `openModal`.
    const prev = interfaceState.sidebarClose;
    sidebarToken = 0;
    interfaceState.sidebar = null;
    interfaceState.sidebarClose = null;
    prev?.();

    const token = nextSlotToken++;
    sidebarToken = token;
    interfaceState.sidebar = id;
    interfaceState.sidebarClose = close;
    return token;
}

/** Dismiss the open sidebar, running its close handler. */
export function closeSidebar(): void {
    const close = interfaceState.sidebarClose;
    sidebarToken = 0;
    interfaceState.sidebar = null;
    interfaceState.sidebarClose = null;
    close?.();
}

// No call sites today — both openSidebar callers drop the token. Kept
// deliberately for parity with the modal slot, so a panel that later needs to
// self-release has the same safe primitive. NOT dead code to sweep.
/** Release the sidebar slot if `token` still owns it, without re-running its
 *  close handler. Returns whether the slot was released. */
export function clearSidebarIfOwner(token: SlotToken): boolean {
    if (token === 0 || sidebarToken !== token) return false;
    sidebarToken = 0;
    interfaceState.sidebar = null;
    interfaceState.sidebarClose = null;
    return true;
}

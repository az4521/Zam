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
    // Shared by two call sites (RoomList roster rows, CallView tiles), and
    // openModal cannot supersede a same-id owner (it short-circuits when `id`
    // is unchanged). Safety rests on CallParticipantMenu's `fixed inset-0 z-50`
    // backdrop eating pointer events; make it pointer-events-none and the two
    // call sites will strand each other's state.
    | "call-participant-menu";

export type SidebarId = "members" | "pinned" | "notifications" | "search";

export const interfaceState = $state({
    isMobile: false,
    isTouchscreen: false,
    /** Mobile space/room drawer (distinct from the content sidebars below). */
    leftOpen: false,
    /** Fullscreen image/video viewer (managed by Lightbox.svelte). */
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

/** Open (or toggle off) a composer emoji/sticker/gif picker. */
export function openComposerPicker(kind: "emoji" | "sticker" | "gif"): void {
    if (
        interfaceState.modal === "composer-picker" &&
        interfaceState.composerPicker === kind
    ) {
        closeModal();
        return;
    }
    interfaceState.composerPicker = kind;
    openModal("composer-picker", () => (interfaceState.composerPicker = null));
}

/**
 * Open a modal/popup. Any currently-open modal is closed first (only one at a
 * time). `close` should reset the owning component's local data and is invoked
 * both on dismissal and when another modal supersedes this one.
 */
export function openModal(id: ModalId, close: () => void): void {
    if (interfaceState.modal && interfaceState.modal !== id) {
        const prev = interfaceState.modalClose;
        interfaceState.modalClose = null;
        prev?.();
    }
    interfaceState.modal = id;
    interfaceState.modalClose = close;
}

/** Dismiss the open modal, running its close handler. */
export function closeModal(): void {
    const close = interfaceState.modalClose;
    interfaceState.modal = null;
    interfaceState.modalClose = null;
    close?.();
}

/** Clear the slot if `id` still owns it, without re-invoking its close handler.
 *  Used by a component whose modal was dismissed by its own means. */
export function clearModal(id: ModalId): void {
    if (interfaceState.modal === id) {
        interfaceState.modal = null;
        interfaceState.modalClose = null;
    }
}

/** Show a room's call view. Does NOT join the call — peeking is allowed. */
export function showCallView(roomId: string): void {
    interfaceState.callViewRoomId = roomId;
}

/** Flip back to the timeline. */
export function showChatView(): void {
    interfaceState.callViewRoomId = null;
}

/** Open a side panel. Any currently-open sidebar is closed first. */
export function openSidebar(id: SidebarId, close: () => void): void {
    if (interfaceState.sidebar && interfaceState.sidebar !== id) {
        const prev = interfaceState.sidebarClose;
        interfaceState.sidebarClose = null;
        prev?.();
    }
    interfaceState.sidebar = id;
    interfaceState.sidebarClose = close;
}

/** Dismiss the open sidebar, running its close handler. */
export function closeSidebar(): void {
    const close = interfaceState.sidebarClose;
    interfaceState.sidebar = null;
    interfaceState.sidebarClose = null;
    close?.();
}

/** Clear the sidebar slot if `id` still owns it, without re-invoking close. */
export function clearSidebar(id: SidebarId): void {
    if (interfaceState.sidebar === id) {
        interfaceState.sidebar = null;
        interfaceState.sidebarClose = null;
    }
}

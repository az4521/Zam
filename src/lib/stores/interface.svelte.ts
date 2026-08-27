// Centralised UI/interface state.
//
// Three UI slots, dismissed in this priority order by AppShell.dismissTopmost()
// (Escape and mobile hardware back):
//   - subPage: a page layered INSIDE the open modal (mobile settings
//              drill-down) — popped first, leaving the modal open.
//   - modal:   the single open popup / modal / context-menu / picker.
//   - sidebar: the single open side panel (member list, pinned, notifications).
//
// Each slot holds at most one owner, but the slots are not exclusive of one
// another: a sub-page exists precisely while its modal is also open.
//
// Components no longer track their own open/closed booleans — they render based
// on `interfaceState.modal === "<id>"` / `interfaceState.sidebar === "<id>"` and
// open/close through the helpers below. AppShell.svelte owns the global
// Escape-key and mobile back-button handling and operates on this store.

import type { SettingsTab } from "../utils/settingsNav";

export type ModalId =
    | "app-settings"
    | "room-settings"
    | "quick-actions"
    | "room-menu"
    | "room-header-menu"
    // The mobile room-header "⋯" sheet (MessageArea). Distinct from
    // "room-header-menu" above, which RoomList's space header already owns —
    // sharing one id would let the two strand each other's slot.
    | "room-header-overflow"
    | "space-menu"
    // The space-rail "+" flyout (SpaceSidebar): a compact Create-space / Join
    // chooser. Distinct from "space-menu" (a space's right-click context menu).
    | "space-add-menu"
    | "account-switcher"
    | "color-picker"
    | "create-room"
    | "add-room"
    | "invite"
    | "room-directory"
    | "reaction-picker"
    // The mobile message-actions "⋯ More" bottom sheet (MessageItem).
    | "message-actions"
    | "report-message"
    | "redact-message"
    | "forward-message"
    | "composer-picker"
    | "composer-actions"
    // A plugin's custom-UI popover (zam.ui.openPopover) — a plugin renders
    // arbitrary DOM into an anchored floating element via PluginPopoverHost.
    // Shares the single modal slot so Escape/backdrop dismiss it through
    // AppShell's central stack like every other popup.
    | "plugin-popover"
    | "create-poll"
    | "share-location"
    // Fullscreen live-location map (LiveLocationMapView, mounted by
    // LiveLocationBanner). It is in the slot so Escape and mobile back
    // dismiss it through AppShell's central stack rather than a private
    // window keydown handler.
    | "live-location-map"
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
    | "threads"
    | "media";

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
    /** Which composer instance owns the open picker (its `composerKey`). Lets
     *  a thread composer and the main composer coexist without both rendering
     *  the single global picker slot. Defaults to "main" for the sole composer. */
    composerPickerOwner: null as string | null,
    /** Focuses the message composer, if one is mounted (set by MessageInput). */
    focusComposer: null as null | (() => void),

    /** The single open popup/modal, or null. */
    modal: null as ModalId | null,
    /** Closes the open modal (runs its cleanup). Set alongside `modal`. */
    modalClose: null as null | (() => void),
    /** A page layered inside the open modal (mobile settings drill-down).
     *  Popped by Escape / mobile back BEFORE the modal itself closes. Holds
     *  the "go back one level" handler, or null when no sub-page is open. */
    subPageClose: null as null | (() => void),
    /** The single open side panel, or null. */
    sidebar: null as SidebarId | null,
    /** Closes the open sidebar (runs its cleanup). Set alongside `sidebar`. */
    sidebarClose: null as null | (() => void),
    /** Room currently shown as a call view instead of its timeline. The app
     *  shell renders CallView when this matches the active room. */
    callViewRoomId: null as string | null,
    /** Settings tab to drill directly into on next modal open (e.g. verification
     *  nudge → "security"). Reset on close so the next normal open lands on the
     *  default tab. */
    settingsInitialTab: null as SettingsTab | null,
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

/** Open (or toggle off) a composer emoji/sticker/gif picker. `owner` is the
 *  claiming composer's key (defaults to "main"): a re-click by the SAME owner
 *  on the SAME kind toggles it off, but a different owner claiming the same
 *  kind switches ownership (so a thread composer opening emoji while the main
 *  composer's emoji is open moves the picker to the thread, not closes it). */
export function openComposerPicker(
    kind: "emoji" | "sticker" | "gif",
    owner: string = "main",
): void {
    if (
        interfaceState.modal === "composer-picker" &&
        interfaceState.composerPicker === kind &&
        interfaceState.composerPickerOwner === owner
    ) {
        closeModal();
        return;
    }
    // Claim first: the outgoing owner's close nulls `composerPicker` + owner.
    openModal("composer-picker", () => {
        interfaceState.composerPicker = null;
        interfaceState.composerPickerOwner = null;
    });
    interfaceState.composerPicker = kind;
    interfaceState.composerPickerOwner = owner;
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
    // against an empty slot, so it cannot clobber the incoming owner, and a
    // re-entrant closeModal() from it is a safe no-op. A close handler must
    // NOT itself call openModal/openSidebar, though: the claim it makes is
    // silently superseded below and its own close would never run.
    //
    // A sub-page dies with its modal, so drop that slot in the same detach —
    // WITHOUT running its handler, since "go back one level" is meaningless
    // once the level is gone.
    const prev = interfaceState.modalClose;
    modalToken = 0;
    interfaceState.modal = null;
    interfaceState.modalClose = null;
    interfaceState.subPageClose = null;
    interfaceState.lightboxOpen = false;
    prev?.();

    const token = nextSlotToken++;
    modalToken = token;
    interfaceState.modal = id;
    interfaceState.modalClose = close;
    interfaceState.lightboxOpen = id === "lightbox";
    return token;
}

/** Dismiss the open modal, running its close handler. Any sub-page layered
 *  inside it is dropped too — WITHOUT running its handler, since a sub-page
 *  dies with its modal by definition and "go back one level" is meaningless
 *  once the level is gone. */
export function closeModal(): void {
    // Drop the sub-page slot first: a modal dismissed by any path other than
    // dismissTopmost (backdrop click, onClose, a supersede) would otherwise
    // strand a stale handler that swallows one later Escape.
    interfaceState.subPageClose = null;
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

/**
 * Push a sub-page above the open modal. `close` pops one level (it should NOT
 * close the modal). Any previous sub-page is closed first — its handler runs
 * before the new owner takes the slot — so a component that supersedes
 * another's sub-page cannot strand it.
 */
export function openSubPage(close: () => void): void {
    const prev = interfaceState.subPageClose;
    if (prev === close) return;
    // Clear before running the superseded handler (as openModal does), so a
    // handler that reaches back into the store cannot pop the new owner.
    interfaceState.subPageClose = null;
    prev?.();
    interfaceState.subPageClose = close;
}

/** Pop the open sub-page, running its handler. No-op when none is open. */
export function closeSubPage(): void {
    const close = interfaceState.subPageClose;
    interfaceState.subPageClose = null;
    close?.();
}

/** Release the sub-page slot on unmount, without running the handler — but
 *  only if `close` still owns it. Function identity is the ownership token:
 *  a late cleanup must never null a slot a newer owner already claimed. */
export function clearSubPageIfOwner(close: () => void): void {
    if (interfaceState.subPageClose === close) {
        interfaceState.subPageClose = null;
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

/** Clear the mobile message-actions selection (the touch-selected message
 *  whose floating actions bar is showing). No-op when nothing is selected. */
export function clearSelectedMessage(): void {
    interfaceState.selectedMessageId = null;
}

/** Claim the side-panel slot, returning this occupancy's token. Same ownership
 *  and ordering rules as `openModal`. */
export function openSidebar(id: SidebarId, close: () => void): SlotToken {
    // Release the slot BEFORE running the outgoing close — see `openModal`.
    // It runs against an empty slot, so a re-entrant closeSidebar() is a safe
    // no-op, but a close handler must not call openSidebar/openModal itself.
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

/** Open app settings drilled straight into `tab` (e.g. the verification
 *  nudge → "security"). Resets the slot on close so the next normal open
 *  lands on the default tab. */
export function openAppSettingsTab(tab: SettingsTab): void {
    interfaceState.settingsInitialTab = tab;
    openModal("app-settings", () => {
        interfaceState.settingsInitialTab = null;
    });
}

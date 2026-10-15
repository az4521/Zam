/**
 * Runs the keyboard shortcuts ($lib/keybinds/keybinds, bound in
 * $lib/stores/keybinds.svelte). AppShell feeds it window key and mouse
 * events and registers the few actions that live in its own component
 * (settings, the quick switcher, new DM / space dialogs, answering calls).
 *
 * Channel and space navigation follows the sidebars as rendered: RoomList
 * marks each row with data-nav-room (plus data-nav-unread / -mention) and
 * SpaceSidebar each space with data-nav-space, so collapsed categories,
 * folders and the user's own order are respected without re-deriving them.
 */
import {
    KEYBIND_DEFS,
    bindingWorksWhileTyping,
    matchesHoldDown,
    matchesPress,
    mouseButtonKey,
    releasesHold,
    type KeybindAction,
} from "./keybinds";
import {
    GLOBAL_ACTIONS,
    keyEventFromInput,
    type GlobalInput,
} from "./globalHotkeys";
import { bindingFor, keybindsState } from "$lib/stores/keybinds.svelte";
import {
    roomsState,
    navigateToRoom,
    setActiveSpace,
} from "$lib/stores/rooms.svelte";
import {
    interfaceState,
    openComposerPicker,
    openSidebar,
    closeSidebar,
    type SidebarId,
} from "$lib/stores/interface.svelte";
import {
    voiceCallState,
    joinCall,
    leaveCall,
    toggleCallMute,
    toggleCallDeafen,
    toggleCamera,
    toggleScreenShare,
    setPushToTalkHeld,
    setPushToMuteHeld,
} from "$lib/stores/voiceCall.svelte";
import {
    incomingCallsState,
    declineIncomingCall,
} from "$lib/stores/incomingCalls.svelte";
import { markRoomAsRead } from "$lib/matrix/client";

/** What AppShell provides. */
export interface KeybindHost {
    openSettings(): void;
    openQuickSwitcher(): void;
    openQuickAction(mode: "create-dm" | "create-space" | "join-room"): void;
    acceptIncomingCall(roomId: string): void;
    toggleShortcutsHelp(): void;
}

let host: KeybindHost | null = null;

export function setKeybindHost(h: KeybindHost | null): void {
    host = h;
}

// ── Back / forward ──────────────────────────────────────────────────────

const HISTORY_LIMIT = 100;
const nav = { stack: [] as string[], index: -1 };

/** AppShell calls this whenever the open room changes. */
export function recordRoomVisit(roomId: string | null): void {
    if (!roomId || nav.stack[nav.index] === roomId) return;
    nav.stack = nav.stack.slice(0, nav.index + 1);
    nav.stack.push(roomId);
    if (nav.stack.length > HISTORY_LIMIT) nav.stack.shift();
    nav.index = nav.stack.length - 1;
}

function goHistory(step: -1 | 1): boolean {
    const i = nav.index + step;
    if (i < 0 || i >= nav.stack.length) return false;
    nav.index = i;
    navigateToRoom(nav.stack[i]);
    return true;
}

/** The room open before the current one (Ctrl+B). */
function previousRoom(): string | null {
    const cur = roomsState.activeRoomId;
    for (let i = nav.index - 1; i >= 0; i--)
        if (nav.stack[i] !== cur) return nav.stack[i];
    return null;
}

/** Test hook. */
export function resetNavHistory(): void {
    nav.stack = [];
    nav.index = -1;
}

// ── Sidebar navigation ──────────────────────────────────────────────────

function navRooms(): { id: string; unread: boolean; mention: boolean }[] {
    const seen = new Set<string>();
    const out: { id: string; unread: boolean; mention: boolean }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
        "[data-nav-room]",
    )) {
        const id = el.dataset.navRoom!;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
            id,
            unread: "navUnread" in el.dataset,
            mention: "navMention" in el.dataset,
        });
    }
    return out;
}

/** Next room in the list (wrapping) that passes `want`, or null. */
function stepRoom(
    dir: 1 | -1,
    want: (r: { unread: boolean; mention: boolean }) => boolean = () => true,
): string | null {
    const rooms = navRooms();
    if (rooms.length === 0) return null;
    const cur = rooms.findIndex((r) => r.id === roomsState.activeRoomId);
    const start = cur === -1 ? (dir === 1 ? -1 : 0) : cur;
    for (let n = 1; n <= rooms.length; n++) {
        const r =
            rooms[
                (((start + dir * n) % rooms.length) + rooms.length) %
                    rooms.length
            ];
        if (r.id !== roomsState.activeRoomId && want(r)) return r.id;
    }
    return null;
}

function stepSpace(dir: 1 | -1): boolean {
    const ids = [
        ...document.querySelectorAll<HTMLElement>("[data-nav-space]"),
    ].map((el) => el.dataset.navSpace ?? "");
    if (ids.length < 2) return false;
    const cur = Math.max(0, ids.indexOf(roomsState.activeSpaceId ?? ""));
    const next = ids[(cur + dir + ids.length) % ids.length];
    setActiveSpace(next || null);
    return true;
}

function goRoom(id: string | null): boolean {
    if (!id) return false;
    navigateToRoom(id);
    return true;
}

// ── Actions ─────────────────────────────────────────────────────────────

const roomOpen = () => !!roomsState.activeRoomId && !roomsState.showInbox;

function toggleSidebar(id: SidebarId): boolean {
    if (!roomOpen()) return false;
    if (interfaceState.sidebar === id) closeSidebar();
    else openSidebar(id, () => {});
    return true;
}

function picker(kind: "emoji" | "gif" | "sticker"): boolean {
    if (!roomOpen()) return false;
    openComposerPicker(kind, roomsState.activeRoomId!);
    return true;
}

/** Run a press action. False when it doesn't apply right now, so the key
 *  falls through to the next action bound to it (or to the page). */
function run(id: KeybindAction): boolean {
    const call = voiceCallState.roomId;
    const ringing = incomingCallsState.ringing[0] ?? null;
    switch (id) {
        case "quickSwitcher":
            if (!host) return false;
            host.openQuickSwitcher();
            return true;
        case "prevChannel":
        case "nextChannel":
            return goRoom(stepRoom(id === "nextChannel" ? 1 : -1));
        case "prevUnreadChannel":
        case "nextUnreadChannel":
            return goRoom(
                stepRoom(id === "nextUnreadChannel" ? 1 : -1, (r) => r.unread),
            );
        case "prevMentionChannel":
        case "nextMentionChannel":
            return goRoom(
                stepRoom(
                    id === "nextMentionChannel" ? 1 : -1,
                    (r) => r.mention,
                ),
            );
        case "prevServer":
        case "nextServer":
            return stepSpace(id === "nextServer" ? 1 : -1);
        case "navigateBack":
            return goHistory(-1);
        case "navigateForward":
            return goHistory(1);
        case "previousTextChannel":
            return goRoom(previousRoom());
        case "returnToCall":
            return goRoom(call);
        case "markChannelRead":
            if (!roomOpen()) return false;
            void markRoomAsRead(roomsState.activeRoomId!).catch(() => {});
            return true;
        case "markServerRead": {
            const unread = navRooms().filter((r) => r.unread);
            for (const r of unread) void markRoomAsRead(r.id).catch(() => {});
            return unread.length > 0;
        }
        case "jumpToOldestUnread":
            if (!roomOpen() || !interfaceState.jumpToUnread) return false;
            interfaceState.jumpToUnread();
            return true;
        case "emojiPicker":
            return picker("emoji");
        case "gifPicker":
            return picker("gif");
        case "stickerPicker":
            return picker("sticker");
        case "uploadFile":
            if (!roomOpen() || !interfaceState.composerUpload) return false;
            interfaceState.composerUpload();
            return true;
        case "search":
            return toggleSidebar("search");
        case "togglePins":
            return toggleSidebar("pinned");
        case "toggleInbox":
            return toggleSidebar("notifications");
        case "toggleMembers":
            return toggleSidebar("members");
        case "toggleMute":
            toggleCallMute();
            return true;
        case "toggleDeafen":
            toggleCallDeafen();
            return true;
        case "answerCall":
            if (!ringing || !host) return false;
            host.acceptIncomingCall(ringing);
            return true;
        case "declineCall":
            if (!ringing) return false;
            declineIncomingCall(ringing);
            return true;
        case "startCall":
            if (!roomOpen() || call === roomsState.activeRoomId) return false;
            void joinCall(roomsState.activeRoomId!);
            return true;
        case "toggleCamera":
            if (!call) return false;
            void toggleCamera();
            return true;
        case "toggleScreenShare":
            if (!call) return false;
            void toggleScreenShare();
            return true;
        case "leaveCall":
            if (!call) return false;
            leaveCall();
            return true;
        case "openSettings":
            if (!host) return false;
            host.openSettings();
            return true;
        case "createDm":
            if (!host) return false;
            host.openQuickAction("create-dm");
            return true;
        case "createOrJoinSpace":
            if (!host) return false;
            host.openQuickAction("create-space");
            return true;
        case "shortcutsHelp":
            if (!host) return false;
            host.toggleShortcutsHelp();
            return true;
        case "toggleDebug":
            interfaceState.debugOpen = !interfaceState.debugOpen;
            return true;
        case "pushToTalk":
        case "pushToMute":
            return false;
    }
}

/** Keys that never type anything, so their shortcuts work from a text
 *  field too (Escape marks the channel read from the composer, Shift+Page
 *  Up jumps to unread from it, as in Discord). */
const NON_TEXT_KEYS = /^(escape|pageup|pagedown|f\d{1,2})$/;

function isEditable(t: EventTarget | null): boolean {
    const el = t as HTMLElement | null;
    return (
        !!el &&
        (el.tagName === "INPUT" ||
            el.tagName === "TEXTAREA" ||
            el.tagName === "SELECT" ||
            el.isContentEditable)
    );
}

// While a modal is open only these run; the rest belong to the main view.
const IN_MODAL: ReadonlySet<KeybindAction> = new Set([
    "toggleMute",
    "toggleDeafen",
    "answerCall",
    "toggleDebug",
    "shortcutsHelp",
    "quickSwitcher",
    "openSettings",
]);

// Checked first: a ringing call takes a shared key (Escape) before the
// channel does.
const FIRST: readonly KeybindAction[] = ["declineCall", "answerCall"];
const PRESS_ORDER = [
    ...KEYBIND_DEFS.filter((d) => FIRST.includes(d.id)),
    ...KEYBIND_DEFS.filter((d) => !FIRST.includes(d.id)),
];

/**
 * Handle a keydown on the window (after Escape had nothing to dismiss).
 * Returns true when a shortcut ran (the caller then preventDefaults).
 */
export function handleKeybindDown(e: KeyboardEvent): boolean {
    if (keybindsState.recording || e.defaultPrevented || e.isComposing)
        return false;
    const typing = isEditable(e.target);
    for (const def of PRESS_ORDER) {
        if (def.hold) continue;
        const b = bindingFor(def.id);
        if (!b || !matchesPress(b, e)) continue;
        if (typing && !bindingWorksWhileTyping(b) && !NON_TEXT_KEYS.test(b.key))
            continue;
        if (interfaceState.modal && !IN_MODAL.has(def.id)) continue;
        if (run(def.id)) return true;
    }
    return false;
}

// ── Hold actions (push to talk / push to mute) ──────────────────────────

const held = { pushToTalk: false, pushToMute: false };

function setHeld(id: "pushToTalk" | "pushToMute", on: boolean): void {
    if (held[id] === on) return;
    held[id] = on;
    if (id === "pushToTalk") setPushToTalkHeld(on);
    else setPushToMuteHeld(on);
}

const HOLD_IDS = ["pushToTalk", "pushToMute"] as const;

/** Keydown/keyup for hold actions. These never block the key: push to talk
 *  on a letter still types it, as in Discord. */
export function handleHoldKey(e: KeyboardEvent, down: boolean): void {
    if (keybindsState.recording) return;
    for (const id of HOLD_IDS) {
        const b = bindingFor(id);
        if (!b) continue;
        if (down ? matchesHoldDown(b, e) : releasesHold(b, e))
            setHeld(id, down);
    }
}

/** Mouse side buttons bound to a hold action. Returns true when the button
 *  is bound (the caller stops it from navigating back/forward). */
export function handleHoldMouse(e: MouseEvent, down: boolean): boolean {
    if (keybindsState.recording) return false;
    const key = mouseButtonKey(e.button);
    if (!key) return false;
    let bound = false;
    for (const id of HOLD_IDS) {
        const b = bindingFor(id);
        if (b?.key !== key) continue;
        bound = true;
        setHeld(id, down);
    }
    return bound;
}

/** The window lost focus: keyups won't arrive, so let go of everything. */
export function releaseAllHolds(): void {
    setHeld("pushToTalk", false);
    setHeld("pushToMute", false);
}

// ── While Zam isn't focused (desktop; $lib/keybinds/globalHotkeys) ──────

const GLOBAL_PRESSES = GLOBAL_ACTIONS.filter(
    (id) => !HOLD_IDS.includes(id as (typeof HOLD_IDS)[number]),
);
/** Keys the hook reported down, to drop its auto-repeat. */
const globalDown = new Set<string>();

/**
 * A key or mouse button from the desktop's input hook. Holds follow it
 * whether or not Zam is focused (a second press or release of an already
 * held or released action changes nothing); toggles only run when Zam isn't
 * focused, since the window's own keydown runs them otherwise.
 */
export function handleGlobalInput(ev: GlobalInput, focused: boolean): void {
    if (keybindsState.recording || !keybindsState.globalVoice) return;
    if (ev.kind === "mouse") {
        const key = mouseButtonKey(ev.button);
        if (!key) return;
        for (const id of HOLD_IDS)
            if (bindingFor(id)?.key === key) setHeld(id, ev.down);
        return;
    }
    const e = keyEventFromInput(ev);
    if (!e) return;
    if (ev.down && globalDown.has(ev.code)) return;
    if (ev.down) globalDown.add(ev.code);
    else globalDown.delete(ev.code);
    for (const id of HOLD_IDS) {
        const b = bindingFor(id);
        if (!b) continue;
        if (ev.down ? matchesHoldDown(b, e) : releasesHold(b, e))
            setHeld(id, ev.down);
    }
    if (!ev.down || focused) return;
    for (const id of GLOBAL_PRESSES) {
        const b = bindingFor(id);
        if (b && matchesPress(b, e) && run(id)) return;
    }
}

/** The hook stopped: forget which keys it last saw down. */
export function resetGlobalInput(): void {
    globalDown.clear();
}

/** Rooms visited this session, most recent first (the quick switcher). */
export function recentRooms(): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (let i = nav.stack.length - 1; i >= 0; i--) {
        const id = nav.stack[i];
        if (!seen.has(id)) {
            seen.add(id);
            out.push(id);
        }
    }
    return out;
}

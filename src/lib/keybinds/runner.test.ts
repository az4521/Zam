import { describe, it, expect, beforeEach, vi } from "vitest";

const rooms = vi.hoisted(() => ({
    state: {
        activeRoomId: null as string | null,
        activeSpaceId: null as string | null,
        showInbox: false,
    },
    navigateToRoom: vi.fn((id: string) => {
        rooms.state.activeRoomId = id;
    }),
    setActiveSpace: vi.fn(),
}));
const call = vi.hoisted(() => ({
    state: { roomId: null as string | null },
    setPushToTalkHeld: vi.fn(),
    setPushToMuteHeld: vi.fn(),
    toggleCallMute: vi.fn(),
}));
const markRoomAsRead = vi.hoisted(() => vi.fn(async () => {}));
const ringing = vi.hoisted(() => ({ list: [] as string[] }));
const declineIncomingCall = vi.hoisted(() => vi.fn());

vi.mock("$lib/stores/rooms.svelte", () => ({
    roomsState: rooms.state,
    navigateToRoom: rooms.navigateToRoom,
    setActiveSpace: rooms.setActiveSpace,
}));
vi.mock("$lib/stores/voiceCall.svelte", () => ({
    voiceCallState: call.state,
    joinCall: vi.fn(),
    leaveCall: vi.fn(),
    toggleCallMute: call.toggleCallMute,
    toggleCallDeafen: vi.fn(),
    toggleCamera: vi.fn(),
    toggleScreenShare: vi.fn(),
    setPushToTalkHeld: call.setPushToTalkHeld,
    setPushToMuteHeld: call.setPushToMuteHeld,
}));
vi.mock("$lib/stores/incomingCalls.svelte", () => ({
    incomingCallsState: {
        get ringing() {
            return ringing.list;
        },
    },
    declineIncomingCall,
}));
vi.mock("$lib/matrix/client", () => ({ markRoomAsRead }));

import {
    handleHoldKey,
    handleHoldMouse,
    handleKeybindDown,
    recordRoomVisit,
    releaseAllHolds,
    resetNavHistory,
} from "./runner";
import { parseBinding } from "./keybinds";
import { resetAllKeybinds, setKeybind } from "$lib/stores/keybinds.svelte";
import { closeModal } from "$lib/stores/interface.svelte";

function key(
    k: string,
    mods: Partial<KeyboardEventInit> = {},
    code = "",
    target: EventTarget = document.body,
) {
    const e = new KeyboardEvent("keydown", { key: k, code, ...mods });
    Object.defineProperty(e, "target", { value: target });
    return e;
}

function sidebar(ids: [string, string?][]) {
    document.body.innerHTML = ids
        .map(
            ([id, flag]) =>
                `<div data-nav-room="${id}" ${flag === "unread" ? "data-nav-unread" : ""} ${flag === "mention" ? "data-nav-unread data-nav-mention" : ""}></div>`,
        )
        .join("");
}

beforeEach(() => {
    localStorage.clear();
    resetAllKeybinds();
    resetNavHistory();
    releaseAllHolds();
    closeModal();
    vi.clearAllMocks();
    rooms.state.activeRoomId = "b";
    rooms.state.showInbox = false;
    call.state.roomId = null;
    ringing.list = [];
    sidebar([["a"], ["b"], ["c", "unread"], ["d"], ["e", "mention"]]);
});

describe("channel navigation", () => {
    it("moves through the sidebar's rooms, wrapping", () => {
        expect(handleKeybindDown(key("ArrowDown", { altKey: true }))).toBe(
            true,
        );
        expect(rooms.navigateToRoom).toHaveBeenLastCalledWith("c");
        rooms.state.activeRoomId = "a";
        handleKeybindDown(key("ArrowUp", { altKey: true }));
        expect(rooms.navigateToRoom).toHaveBeenLastCalledWith("e");
    });

    it("skips to unread and mentioned rooms", () => {
        handleKeybindDown(key("ArrowUp", { altKey: true, shiftKey: true }));
        expect(rooms.navigateToRoom).toHaveBeenLastCalledWith("e");
        handleKeybindDown(
            key("ArrowDown", { altKey: true, shiftKey: true, ctrlKey: true }),
        );
        expect(rooms.navigateToRoom).toHaveBeenLastCalledWith("e");
    });

    it("goes back and forward through visited rooms", () => {
        recordRoomVisit("a");
        recordRoomVisit("b");
        recordRoomVisit("d");
        rooms.state.activeRoomId = "d";
        handleKeybindDown(key("ArrowLeft", { altKey: true }));
        expect(rooms.navigateToRoom).toHaveBeenLastCalledWith("b");
        handleKeybindDown(key("ArrowRight", { altKey: true }));
        expect(rooms.navigateToRoom).toHaveBeenLastCalledWith("d");
        // Ctrl+B: the room before this one.
        handleKeybindDown(key("b", { ctrlKey: true }, "KeyB"));
        expect(rooms.navigateToRoom).toHaveBeenLastCalledWith("b");
    });
});

describe("guards", () => {
    it("ignores plain keys while typing but not Escape", () => {
        const input = document.createElement("textarea");
        setKeybind("toggleMute", parseBinding("M")!);
        expect(handleKeybindDown(key("m", {}, "KeyM", input))).toBe(false);
        expect(handleKeybindDown(key("Escape", {}, "", input))).toBe(true);
        expect(markRoomAsRead).toHaveBeenCalledWith("b");
    });

    it("lets Escape decline a ringing call before marking read", () => {
        ringing.list = ["call-room"];
        handleKeybindDown(key("Escape"));
        expect(declineIncomingCall).toHaveBeenCalledWith("call-room");
        expect(markRoomAsRead).not.toHaveBeenCalled();
    });

    it("skips events the composer already handled", () => {
        const e = key("m", { ctrlKey: true, shiftKey: true }, "KeyM");
        e.preventDefault();
        // Not cancelable as constructed: fake defaultPrevented instead.
        Object.defineProperty(e, "defaultPrevented", { value: true });
        expect(handleKeybindDown(e)).toBe(false);
        expect(call.toggleCallMute).not.toHaveBeenCalled();
    });
});

describe("push to talk", () => {
    it("holds on keydown and lets go on keyup or blur", () => {
        setKeybind("pushToTalk", parseBinding("Control")!);
        handleHoldKey(key("Control", { ctrlKey: true }), true);
        expect(call.setPushToTalkHeld).toHaveBeenLastCalledWith(true);
        handleHoldKey(key("Control"), false);
        expect(call.setPushToTalkHeld).toHaveBeenLastCalledWith(false);
        handleHoldKey(key("Control", { ctrlKey: true }), true);
        releaseAllHolds();
        expect(call.setPushToTalkHeld).toHaveBeenLastCalledWith(false);
    });

    it("takes mouse side buttons", () => {
        setKeybind("pushToMute", {
            ...parseBinding("Control")!,
            key: "mouse4",
        });
        expect(
            handleHoldMouse(new MouseEvent("mousedown", { button: 3 }), true),
        ).toBe(true);
        expect(call.setPushToMuteHeld).toHaveBeenLastCalledWith(true);
        expect(
            handleHoldMouse(new MouseEvent("mousedown", { button: 4 }), true),
        ).toBe(false);
    });
});

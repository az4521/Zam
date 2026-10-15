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
    toggleCallDeafen: vi.fn(),
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
    toggleCallDeafen: call.toggleCallDeafen,
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
    handleGlobalInput,
    handleHoldMouse,
    handleKeybindDown,
    recordRoomVisit,
    releaseAllHolds,
    resetGlobalInput,
    resetNavHistory,
} from "./runner";
import { parseBinding } from "./keybinds";
import type { GlobalInput } from "./globalHotkeys";
import {
    keybindsState,
    resetAllKeybinds,
    setGlobalVoiceKeybinds,
    setKeybind,
} from "$lib/stores/keybinds.svelte";
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
    resetGlobalInput();
    setGlobalVoiceKeybinds(false);
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

function globalKey(
    code: string,
    down: boolean,
    mods: Partial<Record<"ctrl" | "shift" | "alt" | "meta", boolean>> = {},
): GlobalInput {
    return {
        kind: "key",
        code,
        down,
        ctrl: false,
        shift: false,
        alt: false,
        meta: false,
        ...mods,
    };
}

/** Ctrl+Shift, the toggles' default modifiers off macOS. */
const MOD = { ctrl: true, shift: true };

describe("while Zam isn't focused", () => {
    beforeEach(() => setGlobalVoiceKeybinds(true));

    it("does nothing until the setting is on", () => {
        setGlobalVoiceKeybinds(false);
        setKeybind("pushToTalk", parseBinding("V")!);
        handleGlobalInput(globalKey("KeyV", true), false);
        handleGlobalInput(globalKey("KeyM", true, MOD), false);
        expect(call.setPushToTalkHeld).not.toHaveBeenCalled();
        expect(call.toggleCallMute).not.toHaveBeenCalled();
    });

    it("holds push to talk from key down to key up", () => {
        setKeybind("pushToTalk", parseBinding("V")!);
        handleGlobalInput(globalKey("KeyV", true), false);
        expect(call.setPushToTalkHeld).toHaveBeenLastCalledWith(true);
        handleGlobalInput(globalKey("KeyV", false), false);
        expect(call.setPushToTalkHeld).toHaveBeenLastCalledWith(false);
    });

    it("ends a hold when one of its modifiers comes up", () => {
        setKeybind("pushToMute", parseBinding("Ctrl+`")!);
        handleGlobalInput(globalKey("Backquote", true, { ctrl: true }), false);
        expect(call.setPushToMuteHeld).toHaveBeenLastCalledWith(true);
        handleGlobalInput(globalKey("ControlLeft", false), false);
        expect(call.setPushToMuteHeld).toHaveBeenLastCalledWith(false);
    });

    it("takes a bare modifier and mouse side buttons", () => {
        setKeybind("pushToTalk", parseBinding("Control")!);
        handleGlobalInput(
            globalKey("ControlRight", true, { ctrl: true }),
            false,
        );
        expect(call.setPushToTalkHeld).toHaveBeenLastCalledWith(true);
        handleGlobalInput(globalKey("ControlRight", false), false);
        expect(call.setPushToTalkHeld).toHaveBeenLastCalledWith(false);

        setKeybind("pushToMute", {
            ...parseBinding("Control")!,
            key: "mouse5",
        });
        handleGlobalInput({ kind: "mouse", button: 4, down: true }, false);
        expect(call.setPushToMuteHeld).toHaveBeenLastCalledWith(true);
        handleGlobalInput({ kind: "mouse", button: 3, down: false }, false);
        expect(call.setPushToMuteHeld).toHaveBeenLastCalledWith(true);
        handleGlobalInput({ kind: "mouse", button: 4, down: false }, false);
        expect(call.setPushToMuteHeld).toHaveBeenLastCalledWith(false);
    });

    it("toggles mute and deafen once per press, not on auto-repeat", () => {
        handleGlobalInput(globalKey("KeyM", true, MOD), false);
        handleGlobalInput(globalKey("KeyM", true, MOD), false);
        expect(call.toggleCallMute).toHaveBeenCalledTimes(1);
        handleGlobalInput(globalKey("KeyM", false, MOD), false);
        handleGlobalInput(globalKey("KeyM", true, MOD), false);
        expect(call.toggleCallMute).toHaveBeenCalledTimes(2);
        handleGlobalInput(globalKey("KeyD", true, MOD), false);
        expect(call.toggleCallDeafen).toHaveBeenCalledTimes(1);
    });

    it("leaves toggles to the window while Zam is focused", () => {
        // The window's keydown runs it; the hook's copy must not run it again.
        expect(
            handleKeybindDown(
                key("m", { ctrlKey: true, shiftKey: true }, "KeyM"),
            ),
        ).toBe(true);
        handleGlobalInput(globalKey("KeyM", true, MOD), true);
        expect(call.toggleCallMute).toHaveBeenCalledTimes(1);
    });

    it("holds once whichever source reports the key first", () => {
        setKeybind("pushToTalk", parseBinding("V")!);
        handleHoldKey(key("v", {}, "KeyV"), true);
        handleGlobalInput(globalKey("KeyV", true), true);
        expect(call.setPushToTalkHeld).toHaveBeenCalledTimes(1);
        handleGlobalInput(globalKey("KeyV", false), true);
        handleHoldKey(key("v", {}, "KeyV"), false);
        expect(call.setPushToTalkHeld).toHaveBeenCalledTimes(2);
        expect(call.setPushToTalkHeld).toHaveBeenLastCalledWith(false);
    });

    it("runs only the voice actions", () => {
        // Alt+ArrowDown is "next channel": never from another app.
        handleGlobalInput(globalKey("ArrowDown", true, { alt: true }), false);
        expect(rooms.navigateToRoom).not.toHaveBeenCalled();
    });

    it("ignores input while Settings records a new binding", () => {
        setKeybind("pushToTalk", parseBinding("V")!);
        keybindsState.recording = true;
        handleGlobalInput(globalKey("KeyV", true), false);
        keybindsState.recording = false;
        expect(call.setPushToTalkHeld).not.toHaveBeenCalled();
    });
});

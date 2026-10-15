// uiohook key names -> DOM KeyboardEvent.code, shared by the hook process
// (hotkeyHook.cjs) and globalHotkeys.cjs.

// uiohook's numpad keys with Num Lock off are their own keycodes; the DOM
// still calls them by the digit's code.
const NUMPAD_NAV = {
    NumpadInsert: "Numpad0",
    NumpadEnd: "Numpad1",
    NumpadArrowDown: "Numpad2",
    NumpadPageDown: "Numpad3",
    NumpadArrowLeft: "Numpad4",
    NumpadArrowRight: "Numpad6",
    NumpadHome: "Numpad7",
    NumpadArrowUp: "Numpad8",
    NumpadPageUp: "Numpad9",
    NumpadDelete: "NumpadDecimal",
};
const MODIFIER_CODES = {
    Ctrl: "ControlLeft",
    CtrlRight: "ControlRight",
    Alt: "AltLeft",
    Shift: "ShiftLeft",
    Meta: "MetaLeft",
};

/** KeyboardEvent.code for a UiohookKey name (the rest are already spelled
 *  the DOM's way: "F1", "Backquote", "ArrowUp", "ShiftRight"...). */
function domCode(name) {
    if (/^[A-Z]$/.test(name)) return `Key${name}`;
    if (/^\d$/.test(name)) return `Digit${name}`;
    return MODIFIER_CODES[name] || NUMPAD_NAV[name] || name;
}

module.exports = { domCode };

import { afterEach, describe, expect, it } from "vitest";
import { CALL_KICK_WINDOW_MS } from "./callKick";
import {
    clearCallKicks,
    isCallDeviceKicked,
    recordCallKick,
} from "./callKickRegistry";

const room = "!room:x";
const now = 5_000_000;

afterEach(() => clearCallKicks());

describe("callKickRegistry", () => {
    it("treats a kicked device as gone for the window only", () => {
        recordCallKick(room, "@a:x", "D1", now);
        expect(isCallDeviceKicked(room, "@a:x", "D1", now + 1)).toBe(true);
        expect(
            isCallDeviceKicked(room, "@a:x", "D1", now + CALL_KICK_WINDOW_MS),
        ).toBe(false);
    });

    it("leaves the user's other devices alone for a device kick", () => {
        recordCallKick(room, "@a:x", "D1", now);
        expect(isCallDeviceKicked(room, "@a:x", "D2", now)).toBe(false);
    });

    it("kicks every device when no device was named", () => {
        recordCallKick(room, "@a:x", undefined, now);
        expect(isCallDeviceKicked(room, "@a:x", "D1", now)).toBe(true);
        expect(isCallDeviceKicked(room, "@a:x", "D2", now)).toBe(true);
    });

    it("scopes kicks to their room", () => {
        recordCallKick(room, "@a:x", "D1", now);
        expect(isCallDeviceKicked("!other:x", "@a:x", "D1", now)).toBe(false);
    });

    it("extends the window on a repeat kick and never shortens it", () => {
        const first = recordCallKick(room, "@a:x", "D1", now);
        const later = recordCallKick(room, "@a:x", "D1", now + 60_000);
        expect(later).toBeGreaterThan(first);
        const earlierAgain = recordCallKick(room, "@a:x", "D1", now + 1);
        expect(earlierAgain).toBe(later);
        expect(isCallDeviceKicked(room, "@a:x", "D1", later - 1)).toBe(true);
    });
});

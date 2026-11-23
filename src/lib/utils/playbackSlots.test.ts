import { describe, it, expect, vi } from "vitest";
import { PlaybackSlots } from "./playbackSlots";

describe("PlaybackSlots", () => {
    it("grants up to the cap at once and queues the rest", () => {
        const s = new PlaybackSlots<string>(2);
        const a = vi.fn();
        const b = vi.fn();
        const c = vi.fn();
        s.request("a", a);
        s.request("b", b);
        s.request("c", c);
        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
        expect(c).not.toHaveBeenCalled();
        expect(s.activeCount).toBe(2);
        expect(s.waitingCount).toBe(1);
    });

    it("promotes the longest waiter when a slot is cancelled", () => {
        const s = new PlaybackSlots<string>(1);
        const grantB = vi.fn();
        const grantC = vi.fn();
        s.request("a", () => {});
        s.request("b", grantB);
        s.request("c", grantC);
        s.cancel("a");
        expect(grantB).toHaveBeenCalledTimes(1);
        expect(grantC).not.toHaveBeenCalled();
        expect(s.isActive("b")).toBe(true);
    });

    it("cancelling a waiter just removes it", () => {
        const s = new PlaybackSlots<string>(1);
        const grantC = vi.fn();
        s.request("a", () => {});
        s.request("b", () => {});
        s.request("c", grantC);
        s.cancel("b");
        s.cancel("a");
        expect(grantC).toHaveBeenCalledTimes(1);
    });

    it("ignores repeated requests for a key already active or waiting", () => {
        const s = new PlaybackSlots<string>(1);
        const grant = vi.fn();
        s.request("a", grant);
        s.request("a", grant);
        s.request("b", () => {});
        s.request("b", () => {});
        expect(grant).toHaveBeenCalledTimes(1);
        expect(s.waitingCount).toBe(1);
    });

    it("keeps the cap when a grant cancels itself during promotion", () => {
        const s = new PlaybackSlots<string>(1);
        const grantC = vi.fn();
        s.request("a", () => {});
        // b is promoted, then immediately gives its slot back: c must follow.
        s.request("b", () => s.cancel("b"));
        s.request("c", grantC);
        s.cancel("a");
        expect(grantC).toHaveBeenCalledTimes(1);
        expect(s.activeCount).toBe(1);
        expect(s.isActive("c")).toBe(true);
    });
});

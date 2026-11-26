import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPipHud, PIP_HUD_IDLE_MS } from "./pipHud";

describe("createPipHud", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    const clock = {
        setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
        clearTimeout: (h: unknown) => clearTimeout(h as number),
    };

    it("starts shown and hides after the idle delay", () => {
        const onChange = vi.fn();
        const hud = createPipHud(clock, onChange);
        expect(hud.shown).toBe(true);
        vi.advanceTimersByTime(PIP_HUD_IDLE_MS - 1);
        expect(hud.shown).toBe(true);
        vi.advanceTimersByTime(1);
        expect(hud.shown).toBe(false);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(false);
    });

    it("activity restarts the count and shows the controls again", () => {
        const onChange = vi.fn();
        const hud = createPipHud(clock, onChange, 1000);
        vi.advanceTimersByTime(800);
        hud.activity();
        vi.advanceTimersByTime(800);
        expect(hud.shown).toBe(true);
        vi.advanceTimersByTime(200);
        expect(hud.shown).toBe(false);

        hud.activity();
        expect(hud.shown).toBe(true);
        expect(onChange.mock.calls).toEqual([[false], [true]]);
    });

    it("repeated activity while shown does not notify", () => {
        const onChange = vi.fn();
        const hud = createPipHud(clock, onChange, 1000);
        hud.activity();
        hud.activity();
        expect(onChange).not.toHaveBeenCalled();
    });

    it("dispose stops the timer and ignores later activity", () => {
        const onChange = vi.fn();
        const hud = createPipHud(clock, onChange, 1000);
        hud.dispose();
        vi.advanceTimersByTime(5000);
        expect(onChange).not.toHaveBeenCalled();
        hud.activity();
        expect(onChange).not.toHaveBeenCalled();
    });
});

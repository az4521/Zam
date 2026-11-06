import { describe, it, expect, beforeEach } from "vitest";
import { readSavedVolume, rememberVolume } from "./rememberVolume";

function player(): HTMLMediaElement {
    const el = new EventTarget() as HTMLMediaElement;
    el.volume = 1;
    el.muted = false;
    return el;
}

describe("rememberVolume", () => {
    beforeEach(() => localStorage.clear());

    it("leaves a player alone when nothing was saved", () => {
        const el = player();
        rememberVolume(el);
        expect(el.volume).toBe(1);
        expect(el.muted).toBe(false);
    });

    it("saves what is set and starts the next player with it", () => {
        const first = player();
        const action = rememberVolume(first);
        first.volume = 0.3;
        first.muted = true;
        first.dispatchEvent(new Event("volumechange"));
        action.destroy();

        const next = player();
        rememberVolume(next);
        expect(next.volume).toBe(0.3);
        expect(next.muted).toBe(true);
    });

    it("stops saving once destroyed", () => {
        const el = player();
        rememberVolume(el).destroy();
        el.volume = 0.1;
        el.dispatchEvent(new Event("volumechange"));
        expect(readSavedVolume()).toBeNull();
    });

    it("ignores a corrupt or out-of-range saved value", () => {
        for (const bad of [
            "not json",
            '{"volume":7}',
            '{"volume":"x"}',
            "null",
        ]) {
            localStorage.setItem("settings:mediaVolume", bad);
            expect(readSavedVolume()).toBeNull();
        }
    });
});

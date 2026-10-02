import { describe, it, expect } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const { parseWindowState, fitToDisplays } = require(
    join(__dirname, "../../../electron/windowState.cjs"),
);

const DISPLAY = { x: 0, y: 0, width: 1920, height: 1040 };

describe("parseWindowState", () => {
    it("falls back to defaults for a missing or corrupt file", () => {
        const def = { width: 1280, height: 800, maximized: false };
        expect(parseWindowState("")).toEqual(def);
        expect(parseWindowState("{not json")).toEqual(def);
        expect(parseWindowState("null")).toEqual(def);
        expect(parseWindowState('{"width":-5,"height":"big"}')).toEqual(def);
    });

    it("reads a saved state", () => {
        expect(
            parseWindowState(
                '{"x":10,"y":20,"width":1500,"height":900,"maximized":true}',
            ),
        ).toEqual({ x: 10, y: 20, width: 1500, height: 900, maximized: true });
    });

    it("ignores a half-saved position", () => {
        expect(parseWindowState('{"x":10,"width":1500}')).toEqual({
            width: 1500,
            height: 800,
            maximized: false,
        });
    });
});

describe("fitToDisplays", () => {
    it("keeps a position that is on screen", () => {
        const s = {
            x: 100,
            y: 100,
            width: 1280,
            height: 800,
            maximized: false,
        };
        expect(fitToDisplays(s, [DISPLAY])).toEqual(s);
    });

    it("drops a position on a display that is gone", () => {
        const s = {
            x: 2500,
            y: 100,
            width: 1280,
            height: 800,
            maximized: false,
        };
        expect(fitToDisplays(s, [DISPLAY])).toEqual({
            width: 1280,
            height: 800,
            maximized: false,
        });
    });

    it("keeps a position on a second monitor", () => {
        const s = {
            x: 2500,
            y: 100,
            width: 1280,
            height: 800,
            maximized: false,
        };
        const second = { x: 1920, y: 0, width: 2560, height: 1400 };
        expect(fitToDisplays(s, [DISPLAY, second])).toEqual(s);
    });

    it("never opens larger than the biggest screen", () => {
        const s = { width: 4000, height: 3000, maximized: false };
        expect(fitToDisplays(s, [DISPLAY])).toEqual({
            width: 1920,
            height: 1040,
            maximized: false,
        });
    });
});

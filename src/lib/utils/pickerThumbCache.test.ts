// @vitest-environment node
// Reads static/sw.js off disk (see pickerCursorFunnel.test.ts for why node).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
    PICKER_THUMB_PARAM,
    PICKER_THUMB_CACHE_PREFIX,
    markPickerThumb,
} from "./pickerThumbCache";

const SW = readFileSync(
    fileURLToPath(new URL("../../../static/sw.js", import.meta.url)),
    "utf8",
);

describe("picker thumbnail cache", () => {
    it("uses the same marker and cache prefix as the service worker", () => {
        expect(SW).toContain(
            `const PICKER_THUMB_PARAM = "${PICKER_THUMB_PARAM}";`,
        );
        expect(SW).toContain(
            `const PICKER_THUMB_CACHE_PREFIX = "${PICKER_THUMB_CACHE_PREFIX}";`,
        );
    });

    it("prunes signed-out accounts on every auth change", () => {
        for (const type of ["SET_AUTH", "SET_ACCOUNTS", "CLEAR_AUTH"]) {
            const from = SW.indexOf(`=== "${type}"`);
            const body = SW.slice(from, SW.indexOf("} else if", from + 1));
            expect(body, type).toContain("prunePickerThumbCaches()");
        }
    });

    it("marks a thumbnail URL", () => {
        expect(markPickerThumb("https://hs/t?width=96")).toBe(
            `https://hs/t?width=96&${PICKER_THUMB_PARAM}=1`,
        );
        expect(markPickerThumb("https://hs/t")).toBe(
            `https://hs/t?${PICKER_THUMB_PARAM}=1`,
        );
    });
});

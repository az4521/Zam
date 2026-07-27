import { describe, it, expect } from "vitest";
import { resolvePickerSize, COMPOSER_PICKER_SIZE } from "./pickerSize";

function reader(store: Record<string, number>) {
    return (key: string) => (key in store ? store[key] : null);
}

const OPTS = {
    storageKey: "composerPicker",
    legacyKeys: [
        { key: "emojiPicker", defaultW: 340, defaultH: 440 },
        { key: "stickerPicker", defaultW: 340, defaultH: 440 },
        { key: "gifPicker", defaultW: 416, defaultH: 480 },
    ],
    defaultW: 416,
    defaultH: 480,
};

describe("resolvePickerSize", () => {
    it("returns the defaults when nothing is stored", () => {
        expect(resolvePickerSize(reader({}), OPTS)).toEqual({ w: 416, h: 480 });
    });

    it("uses the shared key when present", () => {
        const store = { "composerPicker:w": 500, "composerPicker:h": 600 };
        expect(resolvePickerSize(reader(store), OPTS)).toEqual({
            w: 500,
            h: 600,
        });
    });

    it("migrates from the legacy keys, taking the largest of each dimension", () => {
        const store = {
            "emojiPicker:w": 340,
            "emojiPicker:h": 700,
            "gifPicker:w": 600,
            "gifPicker:h": 480,
        };
        expect(resolvePickerSize(reader(store), OPTS)).toEqual({
            w: 600,
            h: 700,
        });
    });

    it("resolves each dimension independently when the shared key is half-written", () => {
        const store = { "composerPicker:w": 500, "stickerPicker:h": 620 };
        expect(resolvePickerSize(reader(store), OPTS)).toEqual({
            w: 500,
            h: 620,
        });
    });

    it("prefers the shared key over larger legacy values", () => {
        const store = {
            "composerPicker:w": 300,
            "composerPicker:h": 300,
            "gifPicker:w": 900,
            "gifPicker:h": 900,
        };
        expect(resolvePickerSize(reader(store), OPTS)).toEqual({
            w: 300,
            h: 300,
        });
    });

    it("keeps a never-resized picker's old default in the migration", () => {
        const store = { "emojiPicker:w": 300, "emojiPicker:h": 300 };
        expect(resolvePickerSize(reader(store), OPTS)).toEqual({
            w: 416,
            h: 480,
        });
    });

    it("keeps the user's size when they shrank every picker", () => {
        const store = {
            "emojiPicker:w": 300,
            "emojiPicker:h": 300,
            "stickerPicker:w": 300,
            "stickerPicker:h": 300,
            "gifPicker:w": 300,
            "gifPicker:h": 300,
        };
        expect(resolvePickerSize(reader(store), OPTS)).toEqual({
            w: 300,
            h: 300,
        });
    });

    it("falls back to the defaults when no legacy keys are configured", () => {
        expect(
            resolvePickerSize(reader({}), { ...OPTS, legacyKeys: [] }),
        ).toEqual({ w: 416, h: 480 });
    });

    it("exports one shared config for all three pickers", () => {
        expect(COMPOSER_PICKER_SIZE.storageKey).toBe("composerPicker");
        expect(COMPOSER_PICKER_SIZE.legacyKeys).toEqual([
            { key: "emojiPicker", defaultW: 340, defaultH: 440 },
            { key: "stickerPicker", defaultW: 340, defaultH: 440 },
            { key: "gifPicker", defaultW: 416, defaultH: 480 },
        ]);
        expect(COMPOSER_PICKER_SIZE.defaultW).toBe(416);
        expect(COMPOSER_PICKER_SIZE.defaultH).toBe(480);
    });
});

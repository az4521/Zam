import { describe, expect, it } from "vitest";
import {
    ROOM_TIMELINE_MIN_W,
    WIDGETS_PANEL_DEFAULT_W,
    WIDGETS_PANEL_MIN_W,
    clampWidgetsPanelWidth,
    parseStoredWidgetsPanelWidth,
    widgetsPanelMaxWidth,
} from "./widgetsPanelWidth";

describe("widgetsPanelMaxWidth", () => {
    it("leaves the timeline its minimum width", () => {
        expect(widgetsPanelMaxWidth(1200)).toBe(1200 - ROOM_TIMELINE_MIN_W);
    });

    it("never drops below the panel minimum in a narrow column", () => {
        expect(widgetsPanelMaxWidth(500)).toBe(WIDGETS_PANEL_MIN_W);
        expect(widgetsPanelMaxWidth(0)).toBe(WIDGETS_PANEL_MIN_W);
    });
});

describe("clampWidgetsPanelWidth", () => {
    it("keeps an in-range width and rounds it", () => {
        expect(clampWidgetsPanelWidth(400.6, 1200)).toBe(401);
    });

    it("raises a width below the minimum", () => {
        expect(clampWidgetsPanelWidth(100, 1200)).toBe(WIDGETS_PANEL_MIN_W);
    });

    it("caps a width that would starve the timeline", () => {
        expect(clampWidgetsPanelWidth(2000, 1000)).toBe(
            1000 - ROOM_TIMELINE_MIN_W,
        );
    });

    it("falls back to the default for a non-finite request", () => {
        expect(clampWidgetsPanelWidth(Number.NaN, 1200)).toBe(
            WIDGETS_PANEL_DEFAULT_W,
        );
    });
});

describe("parseStoredWidgetsPanelWidth", () => {
    it("returns null when nothing is stored or the value is unusable", () => {
        expect(parseStoredWidgetsPanelWidth(null)).toBeNull();
        expect(parseStoredWidgetsPanelWidth("")).toBeNull();
        expect(parseStoredWidgetsPanelWidth("abc")).toBeNull();
        expect(parseStoredWidgetsPanelWidth("-5")).toBeNull();
    });

    it("returns the stored number", () => {
        expect(parseStoredWidgetsPanelWidth("512")).toBe(512);
    });
});

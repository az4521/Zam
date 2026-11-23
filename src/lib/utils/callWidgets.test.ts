import { describe, it, expect } from "vitest";
import { callWidgetKey, widgetIdFromTileKey } from "./callWidgets";

describe("callWidgetKey", () => {
    it("prefixes the widget id", () => {
        expect(callWidgetKey("zam_abc")).toBe("widget:zam_abc");
    });
});

describe("widgetIdFromTileKey", () => {
    it("round-trips a widget key", () => {
        expect(widgetIdFromTileKey(callWidgetKey("zam_abc"))).toBe("zam_abc");
    });

    it("returns null for a video tile key", () => {
        expect(widgetIdFromTileKey("@a:x:D1:camera")).toBeNull();
        expect(widgetIdFromTileKey("@a:x:D1:screenshare")).toBeNull();
    });

    it("returns null for a missing or empty key", () => {
        expect(widgetIdFromTileKey(null)).toBeNull();
        expect(widgetIdFromTileKey("")).toBeNull();
        expect(widgetIdFromTileKey("widget:")).toBeNull();
    });
});

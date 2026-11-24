import { describe, expect, it } from "vitest";
import { assertWidgetRoomJoined, widgetLinkTarget } from "./widgetNavigation";

describe("widgetLinkTarget", () => {
    it("reads room permalinks with their event", () => {
        expect(
            widgetLinkTarget(
                "https://matrix.to/#/!abc:example.org/$ev:example.org",
            ),
        ).toEqual({
            kind: "room",
            roomId: "!abc:example.org",
            eventId: "$ev:example.org",
        });
    });

    it("reads alias links", () => {
        expect(
            widgetLinkTarget("https://matrix.to/#/#general:example.org"),
        ).toEqual({
            kind: "alias",
            alias: "#general:example.org",
            eventId: undefined,
        });
    });

    it("refuses user links", () => {
        expect(() =>
            widgetLinkTarget("https://matrix.to/#/@alice:example.org"),
        ).toThrow(/user links/);
    });

    it("refuses anything that is not a matrix link", () => {
        expect(() => widgetLinkTarget("https://example.org/")).toThrow(
            "unsupported link",
        );
    });
});

describe("assertWidgetRoomJoined", () => {
    it("passes only for a joined room", () => {
        expect(() => assertWidgetRoomJoined("join")).not.toThrow();
        expect(() => assertWidgetRoomJoined("invite")).toThrow("not joined");
        expect(() => assertWidgetRoomJoined("leave")).toThrow("not joined");
        expect(() => assertWidgetRoomJoined(undefined)).toThrow("not joined");
        expect(() => assertWidgetRoomJoined(null)).toThrow("not joined");
    });
});

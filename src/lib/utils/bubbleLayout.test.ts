import { describe, it, expect } from "vitest";
import { resolveBubbleLayout } from "./bubbleLayout";

describe("resolveBubbleLayout", () => {
    it("other's message, feature on, first-of-group: normal left layout", () => {
        expect(
            resolveBubbleLayout({
                isOwn: false,
                alignOwnEnabled: true,
                showHeader: true,
            }),
        ).toEqual({
            alignOwn: false,
            showAvatar: true,
            showSenderName: true,
            showTimeOnlyHeader: false,
            bubble: false,
            showInlineHoverTime: false,
        });
    });
    it("other's message, feature on, grouped: no avatar/name, hover time shows", () => {
        expect(
            resolveBubbleLayout({
                isOwn: false,
                alignOwnEnabled: true,
                showHeader: false,
            }),
        ).toEqual({
            alignOwn: false,
            showAvatar: false,
            showSenderName: false,
            showTimeOnlyHeader: false,
            bubble: false,
            showInlineHoverTime: true,
        });
    });
    it("own message, feature OFF: unchanged normal left layout (first-of-group)", () => {
        expect(
            resolveBubbleLayout({
                isOwn: true,
                alignOwnEnabled: false,
                showHeader: true,
            }),
        ).toEqual({
            alignOwn: false,
            showAvatar: true,
            showSenderName: true,
            showTimeOnlyHeader: false,
            bubble: false,
            showInlineHoverTime: false,
        });
    });
    it("own message, feature OFF, grouped: unchanged (hover time shows)", () => {
        expect(
            resolveBubbleLayout({
                isOwn: true,
                alignOwnEnabled: false,
                showHeader: false,
            }),
        ).toEqual({
            alignOwn: false,
            showAvatar: false,
            showSenderName: false,
            showTimeOnlyHeader: false,
            bubble: false,
            showInlineHoverTime: true,
        });
    });
    it("own message, feature ON, first-of-group: right bubble, no avatar/name, time-only header", () => {
        expect(
            resolveBubbleLayout({
                isOwn: true,
                alignOwnEnabled: true,
                showHeader: true,
            }),
        ).toEqual({
            alignOwn: true,
            showAvatar: false,
            showSenderName: false,
            showTimeOnlyHeader: true,
            bubble: true,
            showInlineHoverTime: false,
        });
    });
    it("own message, feature ON, grouped: right bubble, no header, no hover time", () => {
        expect(
            resolveBubbleLayout({
                isOwn: true,
                alignOwnEnabled: true,
                showHeader: false,
            }),
        ).toEqual({
            alignOwn: true,
            showAvatar: false,
            showSenderName: false,
            showTimeOnlyHeader: false,
            bubble: true,
            showInlineHoverTime: false,
        });
    });
});

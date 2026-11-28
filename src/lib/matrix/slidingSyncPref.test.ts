import { describe, it, expect, beforeEach } from "vitest";
import {
    isSlidingSyncEnabled,
    isSlidingSyncKnownSupported,
    markSlidingSyncSupported,
    setSlidingSyncEnabled,
} from "./slidingSyncPref";

const USER = "@alice:example.org";
const DAY = 24 * 60 * 60 * 1000;

describe("sliding sync known-supported stamp", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("is unknown until a probe marks it", () => {
        expect(isSlidingSyncKnownSupported(USER)).toBe(false);
    });

    it("is known after a successful probe", () => {
        markSlidingSyncSupported(USER, true);
        expect(isSlidingSyncKnownSupported(USER)).toBe(true);
    });

    it("is per user", () => {
        markSlidingSyncSupported(USER, true);
        expect(isSlidingSyncKnownSupported("@bob:example.org")).toBe(false);
    });

    it("expires after seven days", () => {
        markSlidingSyncSupported(USER, true);
        const stamped = Number(
            localStorage.getItem("moe.crafty.matrix.sliding_sync_ok:" + USER),
        );
        expect(isSlidingSyncKnownSupported(USER, stamped + 6 * DAY)).toBe(true);
        expect(isSlidingSyncKnownSupported(USER, stamped + 7 * DAY + 1)).toBe(
            false,
        );
    });

    it("ignores a stamp from the future (clock moved back)", () => {
        markSlidingSyncSupported(USER, true);
        const stamped = Number(
            localStorage.getItem("moe.crafty.matrix.sliding_sync_ok:" + USER),
        );
        expect(isSlidingSyncKnownSupported(USER, stamped - DAY)).toBe(false);
    });

    it("ignores a corrupt stamp", () => {
        localStorage.setItem(
            "moe.crafty.matrix.sliding_sync_ok:" + USER,
            "not-a-number",
        );
        expect(isSlidingSyncKnownSupported(USER)).toBe(false);
    });

    it("markSlidingSyncSupported(false) forgets the stamp", () => {
        markSlidingSyncSupported(USER, true);
        markSlidingSyncSupported(USER, false);
        expect(isSlidingSyncKnownSupported(USER)).toBe(false);
    });

    it("disabling sliding sync clears the stamp", () => {
        setSlidingSyncEnabled(USER, true);
        markSlidingSyncSupported(USER, true);
        setSlidingSyncEnabled(USER, false);
        expect(isSlidingSyncEnabled(USER)).toBe(false);
        expect(isSlidingSyncKnownSupported(USER)).toBe(false);
    });
});

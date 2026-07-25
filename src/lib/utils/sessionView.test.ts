import { describe, it, expect } from "vitest";
import { rootView, shouldRestoreSession } from "./sessionView";

describe("rootView", () => {
    it("returns shell when authenticated (regardless of restoring)", () => {
        expect(rootView({ isAuthenticated: true, restoring: false })).toBe(
            "shell",
        );
        expect(rootView({ isAuthenticated: true, restoring: true })).toBe(
            "shell",
        );
    });
    it("returns splash when not authenticated but restoring", () => {
        expect(rootView({ isAuthenticated: false, restoring: true })).toBe(
            "splash",
        );
    });
    it("returns login when not authenticated and not restoring", () => {
        expect(rootView({ isAuthenticated: false, restoring: false })).toBe(
            "login",
        );
    });
});

describe("shouldRestoreSession", () => {
    it("true when a stored session exists and not in add-account mode", () => {
        expect(
            shouldRestoreSession({
                hasStoredSession: true,
                isAddAccountMode: false,
            }),
        ).toBe(true);
    });
    it("false in add-account mode even with a stored session", () => {
        expect(
            shouldRestoreSession({
                hasStoredSession: true,
                isAddAccountMode: true,
            }),
        ).toBe(false);
    });
    it("false when no stored session", () => {
        expect(
            shouldRestoreSession({
                hasStoredSession: false,
                isAddAccountMode: false,
            }),
        ).toBe(false);
        expect(
            shouldRestoreSession({
                hasStoredSession: false,
                isAddAccountMode: true,
            }),
        ).toBe(false);
    });
});

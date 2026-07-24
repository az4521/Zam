import { describe, it, expect } from "vitest";
import { isValidEmail, getThreePidInviteState } from "./threePidInvite";

describe("isValidEmail", () => {
    it("accepts a normal address", () => {
        expect(isValidEmail("user@example.com")).toBe(true);
    });
    it("accepts an address with a multi-label domain", () => {
        expect(isValidEmail("a.b@mail.example.co.uk")).toBe(true);
    });
    it("trims surrounding whitespace before validating", () => {
        expect(isValidEmail("  user@example.com  ")).toBe(true);
    });
    it("rejects an empty string", () => {
        expect(isValidEmail("")).toBe(false);
    });
    it("rejects a whitespace-only string", () => {
        expect(isValidEmail("   ")).toBe(false);
    });
    it("rejects internal whitespace", () => {
        expect(isValidEmail("user name@example.com")).toBe(false);
        expect(isValidEmail("user@ex ample.com")).toBe(false);
    });
    it("rejects a missing @", () => {
        expect(isValidEmail("userexample.com")).toBe(false);
    });
    it("rejects two @", () => {
        expect(isValidEmail("user@@example.com")).toBe(false);
        expect(isValidEmail("a@b@example.com")).toBe(false);
    });
    it("rejects an empty local part", () => {
        expect(isValidEmail("@example.com")).toBe(false);
    });
    it("rejects an empty domain", () => {
        expect(isValidEmail("user@")).toBe(false);
    });
    it("rejects a domain with no dot", () => {
        expect(isValidEmail("user@localhost")).toBe(false);
    });
    it("rejects a domain whose dot is at an edge", () => {
        expect(isValidEmail("user@.com")).toBe(false);
        expect(isValidEmail("user@example.")).toBe(false);
    });
});

describe("getThreePidInviteState", () => {
    it("is available when there is an identity server and the user can invite", () => {
        expect(
            getThreePidInviteState({
                hasIdentityServer: true,
                canInvite: true,
            }),
        ).toEqual({ available: true });
    });
    it("is disabled with an identity-server reason when no IS is configured", () => {
        const s = getThreePidInviteState({
            hasIdentityServer: false,
            canInvite: true,
        });
        expect(s.available).toBe(false);
        expect(s.reason).toMatch(/identity server/i);
    });
    it("is disabled with a permission reason when the user cannot invite", () => {
        const s = getThreePidInviteState({
            hasIdentityServer: true,
            canInvite: false,
        });
        expect(s.available).toBe(false);
        expect(s.reason).toMatch(/permission/i);
    });
    it("prefers the permission reason when both are missing", () => {
        const s = getThreePidInviteState({
            hasIdentityServer: false,
            canInvite: false,
        });
        expect(s.available).toBe(false);
        expect(s.reason).toMatch(/permission/i);
    });
});

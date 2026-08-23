import { describe, it, expect } from "vitest";
import {
    createHealedRoomRegistry,
    roomStateTrustBadge,
} from "./roomStateTrust";

describe("createHealedRoomRegistry", () => {
    it("reports an unmarked room as not healed", () => {
        const reg = createHealedRoomRegistry();
        expect(reg.isHealed("!room:server")).toBe(false);
    });

    it("reports a marked room as healed", () => {
        const reg = createHealedRoomRegistry();
        reg.markHealed("!room:server");
        expect(reg.isHealed("!room:server")).toBe(true);
    });

    it("is idempotent — marking twice keeps one entry and stays healed", () => {
        const reg = createHealedRoomRegistry();
        reg.markHealed("!room:server");
        reg.markHealed("!room:server");
        expect(reg.isHealed("!room:server")).toBe(true);
        reg.forget("!room:server");
        expect(reg.isHealed("!room:server")).toBe(false);
    });

    it("forget clears only the named room", () => {
        const reg = createHealedRoomRegistry();
        reg.markHealed("!a:server");
        reg.markHealed("!b:server");
        reg.forget("!a:server");
        expect(reg.isHealed("!a:server")).toBe(false);
        expect(reg.isHealed("!b:server")).toBe(true);
    });

    it("clear drops every entry", () => {
        const reg = createHealedRoomRegistry();
        reg.markHealed("!a:server");
        reg.markHealed("!b:server");
        reg.clear();
        expect(reg.isHealed("!a:server")).toBe(false);
        expect(reg.isHealed("!b:server")).toBe(false);
    });

    it("does not treat the empty string as a wildcard", () => {
        const reg = createHealedRoomRegistry();
        reg.markHealed("!a:server");
        expect(reg.isHealed("")).toBe(false);
    });
});

describe("roomStateTrustBadge", () => {
    it("is not unverified for a synced room", () => {
        const badge = roomStateTrustBadge(false);
        expect(badge.unverified).toBe(false);
        expect(badge.label).toBe("");
        expect(badge.tooltip).toBe("");
    });

    it("marks a healed room unverified with advisory, non-alarmist copy", () => {
        const badge = roomStateTrustBadge(true);
        expect(badge.unverified).toBe(true);
        expect(badge.label.length).toBeGreaterThan(0);
        expect(badge.tooltip.length).toBeGreaterThan(0);
        // Advisory, not alarmist: mentions the server-fetch origin, not compromise.
        expect(badge.tooltip.toLowerCase()).toContain("server");
        expect(badge.tooltip.toLowerCase()).not.toContain("compromis");
    });
});

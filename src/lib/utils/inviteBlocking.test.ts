import { describe, expect, it } from "vitest";
import {
    STABLE_INVITE_PERMISSION_TYPE,
    UNSTABLE_INVITE_PERMISSION_TYPE,
    inviteBlockingContent,
    inviteBlockingSupport,
    inviteBlockingWriteType,
    invitesBlockedFromContent,
    isInviteBlockedError,
    isInviteBlockingAccountType,
    resolveInvitesBlocked,
    buildInviteBlockPushRule,
    INVITE_BLOCK_PUSH_RULE_ID,
} from "./inviteBlocking";

describe("inviteBlockingSupport", () => {
    it("reads the stable flag as stable", () => {
        expect(
            inviteBlockingSupport({
                "org.matrix.msc4380.stable": true,
                "org.matrix.msc4380": true,
            }),
        ).toBe("stable");
        expect(
            inviteBlockingSupport({ "org.matrix.msc4380.stable": true }),
        ).toBe("stable");
    });

    it("reads the unstable flag as unstable", () => {
        expect(inviteBlockingSupport({ "org.matrix.msc4380": true })).toBe(
            "unstable",
        );
    });

    it("is none without the flags, or with them not true", () => {
        expect(inviteBlockingSupport({})).toBe("none");
        expect(inviteBlockingSupport(undefined)).toBe("none");
        expect(inviteBlockingSupport(null)).toBe("none");
        expect(inviteBlockingSupport({ "org.matrix.msc4380": false })).toBe(
            "none",
        );
    });
});

describe("inviteBlockingWriteType", () => {
    it("writes the unstable type only for an unstable-only server", () => {
        expect(inviteBlockingWriteType("unstable")).toBe(
            UNSTABLE_INVITE_PERMISSION_TYPE,
        );
    });

    it("writes the stable type for stable and for none", () => {
        expect(inviteBlockingWriteType("stable")).toBe(
            STABLE_INVITE_PERMISSION_TYPE,
        );
        expect(inviteBlockingWriteType("none")).toBe(
            STABLE_INVITE_PERMISSION_TYPE,
        );
    });

    it("recognises both account-data types", () => {
        expect(isInviteBlockingAccountType(STABLE_INVITE_PERMISSION_TYPE)).toBe(
            true,
        );
        expect(
            isInviteBlockingAccountType(UNSTABLE_INVITE_PERMISSION_TYPE),
        ).toBe(true);
        expect(isInviteBlockingAccountType("m.ignored_user_list")).toBe(false);
    });
});

describe("inviteBlockingContent and parsing", () => {
    it("round-trips blocked and allowed content", () => {
        expect(inviteBlockingContent(true)).toEqual({
            default_action: "block",
        });
        expect(inviteBlockingContent(false)).toEqual({});
        expect(invitesBlockedFromContent(inviteBlockingContent(true))).toBe(
            true,
        );
        expect(invitesBlockedFromContent(inviteBlockingContent(false))).toBe(
            false,
        );
    });

    it("is not blocked for odd content", () => {
        expect(invitesBlockedFromContent(undefined)).toBe(false);
        expect(invitesBlockedFromContent(null)).toBe(false);
        expect(invitesBlockedFromContent("block")).toBe(false);
        expect(invitesBlockedFromContent({ default_action: "allow" })).toBe(
            false,
        );
        expect(invitesBlockedFromContent({ default_action: true })).toBe(false);
    });
});

describe("resolveInvitesBlocked", () => {
    const block = { default_action: "block" };

    it("is false when neither type is present", () => {
        expect(resolveInvitesBlocked(undefined, undefined)).toBe(false);
        expect(resolveInvitesBlocked(null, null)).toBe(false);
    });

    it("reads the unstable type when the stable one is absent", () => {
        expect(resolveInvitesBlocked(undefined, block)).toBe(true);
        expect(resolveInvitesBlocked(null, {})).toBe(false);
    });

    it("lets a present stable type decide, even when it allows", () => {
        expect(resolveInvitesBlocked({}, block)).toBe(false);
        expect(resolveInvitesBlocked(block, {})).toBe(true);
    });
});

describe("isInviteBlockedError", () => {
    it("matches the stable and MSC4155 errcodes", () => {
        expect(isInviteBlockedError({ errcode: "M_INVITE_BLOCKED" })).toBe(
            true,
        );
        expect(
            isInviteBlockedError({
                errcode: "ORG.MATRIX.MSC4155.INVITE_BLOCKED",
            }),
        ).toBe(true);
    });

    it("reads the errcode from the response body too", () => {
        expect(
            isInviteBlockedError({
                message: "x",
                data: { errcode: "M_INVITE_BLOCKED" },
            }),
        ).toBe(true);
    });

    it("rejects other errors and non-objects", () => {
        expect(isInviteBlockedError({ errcode: "M_FORBIDDEN" })).toBe(false);
        expect(isInviteBlockedError({ data: { errcode: "M_FORBIDDEN" } })).toBe(
            false,
        );
        expect(isInviteBlockedError(new Error("M_INVITE_BLOCKED"))).toBe(false);
        expect(isInviteBlockedError("M_INVITE_BLOCKED")).toBe(false);
        expect(isInviteBlockedError(null)).toBe(false);
        expect(isInviteBlockedError(undefined)).toBe(false);
    });
});

describe("buildInviteBlockPushRule", () => {
    it("silences invites to the given user only", () => {
        const rule = buildInviteBlockPushRule("@me:example.org");
        expect(rule.kind).toBe("override");
        expect(rule.ruleId).toBe(INVITE_BLOCK_PUSH_RULE_ID);
        expect(rule.body.actions).toEqual([]);
        expect(rule.body.conditions).toContainEqual({
            kind: "event_property_is",
            key: "state_key",
            value: "@me:example.org",
        });
        expect(rule.body.conditions).toContainEqual({
            kind: "event_property_is",
            key: "content.membership",
            value: "invite",
        });
    });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// static/sw.js is un-bundled; run its invite helpers (mirrored by hand in
// MatrixMessagingService.java) straight from the source.
const SW_SOURCE = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../static/sw.js"),
    "utf-8",
);
const start = SW_SOURCE.indexOf("// #region mirrored:invite");
const end = SW_SOURCE.indexOf("// #endregion mirrored:invite");

type Info = {
    inviterId: string;
    inviterName: string;
    inviterAvatar: string;
    roomName: string;
    roomAvatar: string;
    isSpace: boolean;
    isDirect: boolean;
};
const sw = new Function(
    `${SW_SOURCE.slice(start, end)}
    return { parseInviteState, inviteNotificationText };`,
)() as {
    parseInviteState: (events: unknown, self: string) => Info | null;
    inviteNotificationText: (info: Info) => {
        title: string;
        body: string;
        avatar: string;
    };
};

const ME = "@me:hs";
const invite = (content: Record<string, unknown> = {}) => ({
    type: "m.room.member",
    state_key: ME,
    sender: "@alice:hs",
    content: { membership: "invite", ...content },
});
const alice = {
    type: "m.room.member",
    state_key: "@alice:hs",
    sender: "@alice:hs",
    content: {
        membership: "join",
        displayname: "Alice",
        avatar_url: "mxc://hs/alice",
    },
};

describe("sw invite notification", () => {
    it("finds the region", () => {
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
    });

    it("is null without a pending invite for us", () => {
        expect(sw.parseInviteState([alice], ME)).toBeNull();
        expect(sw.parseInviteState(undefined, ME)).toBeNull();
        expect(
            sw.parseInviteState([invite(), alice], "@someone:hs"),
        ).toBeNull();
    });

    it("titles a DM by the inviter, with their picture", () => {
        const info = sw.parseInviteState(
            [invite({ is_direct: true }), alice],
            ME,
        )!;
        expect(sw.inviteNotificationText(info)).toEqual({
            title: "Alice",
            body: "Invited you to a direct chat",
            avatar: "mxc://hs/alice",
        });
    });

    it("titles a space by its name, with its picture", () => {
        const info = sw.parseInviteState(
            [
                { type: "m.room.create", content: { type: "m.space" } },
                { type: "m.room.name", content: { name: "Gaming" } },
                { type: "m.room.avatar", content: { url: "mxc://hs/space" } },
                invite(),
                alice,
            ],
            ME,
        )!;
        expect(sw.inviteNotificationText(info)).toEqual({
            title: "Gaming",
            body: "Alice invited you to join this space",
            avatar: "mxc://hs/space",
        });
    });

    it("titles a room by its name (or alias), the inviter in the text", () => {
        const info = sw.parseInviteState(
            [
                {
                    type: "m.room.canonical_alias",
                    content: { alias: "#lounge:hs" },
                },
                invite(),
                alice,
            ],
            ME,
        )!;
        expect(sw.inviteNotificationText(info)).toEqual({
            title: "#lounge:hs",
            body: "Alice invited you to join this room",
            avatar: "mxc://hs/alice",
        });
    });

    it("falls back to the inviter's id for an unnamed room", () => {
        const info = sw.parseInviteState([invite()], ME)!;
        expect(sw.inviteNotificationText(info)).toEqual({
            title: "@alice:hs",
            body: "Invited you to a room",
            avatar: "",
        });
    });
});

import { describe, it, expect, afterEach, vi } from "vitest";
import { mount, unmount, flushSync, tick } from "svelte";

// A Matrix HQ sized room: the list must render a window of rows, not all of
// them, and must only ask presence for the rows it renders (on sliding sync
// every presence lookup is an HTTP request).
const N = 50_000;

// jsdom has no layout: no ResizeObserver, and every clientHeight is 0, so the
// rendered window is just the overscan.
globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
} as unknown as typeof ResizeObserver;
const presenceCalls = vi.fn();

function fakeMember(i: number) {
    const userId = `@user${String(i).padStart(5, "0")}:example.org`;
    return {
        userId,
        name: `user${String(i).padStart(5, "0")}`,
        rawDisplayName: `user${String(i).padStart(5, "0")}`,
        membership: "join",
        powerLevel: i === 0 ? 100 : 0,
        getMxcAvatarUrl: () => undefined,
    };
}

const members = Array.from({ length: N }, (_, i) => fakeMember(i));
const room = {
    roomId: "!hq:example.org",
    getMembers: () => members,
    getJoinedMemberCount: () => N,
};
// The windowing tests list the whole roster (as a fully loaded room would);
// the large-room test flips this to get the active-members view.
let large = false;
let recentSenders: string[] = [];

vi.mock("$lib/matrix/client", async (importOriginal) => ({
    ...(await importOriginal<typeof import("$lib/matrix/client")>()),
    getRoomMembers: () => members,
    loadRoomMembersIfNeeded: () => Promise.resolve(),
    loadRoomMembersForView: () => Promise.resolve(),
    isLargeRoom: () => large,
    recentSenderIds: () => recentSenders,
    roleHolderIds: () => [members[0].userId],
    getOwnUserId: () => members[2].userId,
    getUserPresence: (userId: string) =>
        userId === members[3].userId
            ? { presence: "online", currentlyActive: true }
            : null,
    onRoomMembersChanged: () => () => {},
    hasImmutableCreatorPower: () => false,
    getUserPowerLevel: (_room: unknown, userId: string) =>
        userId === members[0].userId ? 100 : 0,
    mxcToHttp: () => null,
}));

vi.mock("$lib/stores/presence.svelte", async (importOriginal) => ({
    ...(await importOriginal<typeof import("$lib/stores/presence.svelte")>()),
    presenceFor: (userId: string) => {
        presenceCalls(userId);
        return null;
    },
}));

import MemberList from "./MemberList.svelte";

let instance: Record<string, unknown> | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
    if (instance) unmount(instance);
    instance = null;
    host?.remove();
    host = null;
    presenceCalls.mockReset();
    large = false;
    recentSenders = [];
});

describe("MemberList in a huge room", () => {
    it("renders a window of rows and asks presence only for those", async () => {
        host = document.createElement("div");
        document.body.appendChild(host);
        instance = mount(MemberList, {
            target: host,
            props: { room: room as never },
        });
        flushSync();
        await tick();

        const rows = host.querySelectorAll("[data-user-id]");
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBeLessThan(50);
        expect(presenceCalls.mock.calls.length).toBeLessThan(100);
        // Admin first, then the online member, then the rest alphabetically.
        expect(rows[0].getAttribute("data-user-id")).toBe(members[0].userId);
        expect(rows[1].getAttribute("data-user-id")).toBe(members[3].userId);
        expect(rows[2].getAttribute("data-user-id")).toBe(members[1].userId);

        // The scroll area is as tall as every row, so the scrollbar is right.
        const inner = host.querySelector(".relative[style]") as HTMLElement;
        const height = parseInt(inner.style.height, 10);
        expect(height).toBeGreaterThan(N * 40);
    });

    it("follows scrolling to the far end", async () => {
        host = document.createElement("div");
        document.body.appendChild(host);
        instance = mount(MemberList, {
            target: host,
            props: { room: room as never },
        });
        flushSync();
        const scroller = host.querySelector(
            ".overflow-y-auto",
        ) as HTMLDivElement;
        scroller.scrollTop = N * 40;
        scroller.dispatchEvent(new Event("scroll"));
        flushSync();
        await tick();

        const ids = [...host.querySelectorAll("[data-user-id]")].map((el) =>
            el.getAttribute("data-user-id"),
        );
        expect(ids).toContain(members[N - 1].userId);
        expect(ids).not.toContain(members[1].userId);
        expect(ids.length).toBeLessThan(50);
    });

    it("shows only active members in a large room, online first", async () => {
        large = true;
        recentSenders = [members[5].userId, members[4].userId];
        host = document.createElement("div");
        document.body.appendChild(host);
        instance = mount(MemberList, {
            target: host,
            props: { room: room as never },
        });
        flushSync();
        await tick();

        const ids = [...host.querySelectorAll("[data-user-id]")].map((el) =>
            el.getAttribute("data-user-id"),
        );
        // Role holder, then the online member, then self and recent senders
        // by name. Everyone else of the 50k is left out.
        expect(ids).toEqual([
            members[0].userId,
            members[3].userId,
            members[2].userId,
            members[4].userId,
            members[5].userId,
        ]);
        // The header counts the whole room, not the loaded part.
        expect(host.textContent).toContain(String(N));
    });
});

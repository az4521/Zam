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
};

vi.mock("$lib/matrix/client", async (importOriginal) => ({
    ...(await importOriginal<typeof import("$lib/matrix/client")>()),
    getRoomMembers: () => members,
    loadRoomMembersIfNeeded: () => Promise.resolve(),
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
        // Admin first, then regular members alphabetically.
        expect(rows[0].getAttribute("data-user-id")).toBe(members[0].userId);
        expect(rows[1].getAttribute("data-user-id")).toBe(members[1].userId);

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
});

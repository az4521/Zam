import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { flushSync, mount, unmount } from "svelte";

// Each presence reader subscribes to its own user only: an event for a user
// nobody renders must not re-render anything, and a reader that mounts or
// unmounts must start or stop watching exactly its users.
const h = vi.hoisted(() => ({
    presence: new Map<
        string,
        { presence: string; currentlyActive: boolean; statusMsg?: string }
    >(),
    presenceCallback: null as ((userId: string) => void) | null,
}));

vi.mock("$lib/matrix/client", async (importOriginal) => ({
    ...(await importOriginal<typeof import("$lib/matrix/client")>()),
    getUserPresence: (userId: string) => h.presence.get(userId) ?? null,
    refreshUserPresence: vi.fn(),
    onPresenceEvent: (callback: (userId: string) => void) => {
        h.presenceCallback = callback;
        return () => {};
    },
    isUsingSlidingSync: () => true,
    onSlidingSyncActiveChange: () => () => {},
    setOwnPresence: vi.fn(() => Promise.resolve()),
    supportsBusyPresence: () => Promise.resolve(false),
    fetchOwnExtendedProfile: () => Promise.resolve(null),
    setAccountNotificationsDisabled: vi.fn(),
}));

import { refreshUserPresence } from "$lib/matrix/client";
import {
    initPresence,
    presenceFor,
    watchedPresenceUsers,
} from "$lib/stores/presence.svelte";
import PresenceProbe from "./__fixtures__/PresenceProbe.svelte";

const refreshMock = vi.mocked(refreshUserPresence);

let instance: Record<string, unknown> | null = null;
let host: HTMLElement | null = null;

beforeAll(() => {
    initPresence();
});

afterAll(() => {
    h.presenceCallback = null;
});

afterEach(() => {
    if (instance) unmount(instance);
    instance = null;
    host?.remove();
    host = null;
    h.presence.clear();
    refreshMock.mockClear();
});

function mountProbe(
    ids: string[],
    onRender: (id: string) => void,
    viaDerived = false,
) {
    host = document.createElement("div");
    document.body.appendChild(host);
    instance = mount(PresenceProbe, {
        target: host,
        props: { ids, onRender, viaDerived },
    });
    flushSync();
}

// Past the 300 ms a watched row waits before its presence is fetched.
const settle = () => new Promise((r) => setTimeout(r, 350));

describe("presence watching", () => {
    it("watches each rendered user and asks for their presence", async () => {
        mountProbe(["@a:x", "@b:x"], () => {});
        expect([...watchedPresenceUsers()].sort()).toEqual(["@a:x", "@b:x"]);
        expect(refreshMock).not.toHaveBeenCalled();
        await settle();
        expect(refreshMock).toHaveBeenCalledWith("@a:x");
        expect(refreshMock).toHaveBeenCalledWith("@b:x");
    });

    it("does not fetch for a row that only flashed past", async () => {
        mountProbe(["@a:x"], () => {});
        if (instance) unmount(instance);
        instance = null;
        await settle();
        expect(refreshMock).not.toHaveBeenCalled();
    });

    it("re-renders only the user whose presence changed", () => {
        const onRender = vi.fn();
        mountProbe(["@a:x", "@b:x"], onRender);
        onRender.mockClear();

        h.presenceCallback?.("@zzz:x");
        flushSync();
        expect(onRender).not.toHaveBeenCalled();

        h.presence.set("@a:x", { presence: "online", currentlyActive: true });
        h.presenceCallback?.("@a:x");
        flushSync();

        expect(onRender.mock.calls.map((call) => call[0])).toEqual(["@a:x"]);
        const span = host?.querySelector('[data-id="@a:x"]');
        expect(span?.textContent).toBe("online");
    });

    it("stops watching a user once its last reader unmounts", async () => {
        mountProbe(["@a:x", "@b:x"], () => {});
        expect(watchedPresenceUsers().length).toBe(2);

        if (instance) unmount(instance);
        instance = null;
        await Promise.resolve();
        await Promise.resolve();

        expect(watchedPresenceUsers()).toEqual([]);
    });

    it("watches users read through a $derived, and updates it", async () => {
        const onRender = vi.fn();
        mountProbe(["@a:x", "@b:x"], onRender, true);
        expect([...watchedPresenceUsers()].sort()).toEqual(["@a:x", "@b:x"]);

        onRender.mockClear();
        h.presenceCallback?.("@zzz:x");
        flushSync();
        expect(onRender).not.toHaveBeenCalled();

        h.presence.set("@b:x", { presence: "online", currentlyActive: true });
        h.presenceCallback?.("@b:x");
        flushSync();
        const span = host?.querySelector('[data-id="@b:x"]');
        expect(span?.textContent).toBe("online");

        // Re-running the derived must not drop and re-add the subscriptions
        // for good: after it settles both users are still watched once.
        await settle();
        expect([...watchedPresenceUsers()].sort()).toEqual(["@a:x", "@b:x"]);
        expect(
            refreshMock.mock.calls.filter((c) => c[0] === "@a:x").length,
        ).toBe(1);
    });

    it("does not watch a user read outside a reactive context", () => {
        presenceFor("@outside:x");
        expect(watchedPresenceUsers()).not.toContain("@outside:x");
    });
});

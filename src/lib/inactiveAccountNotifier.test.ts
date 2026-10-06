import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    startInactiveAccountNotifier,
    type AccountNotice,
} from "./inactiveAccountNotifier";
import type { StoredAccount } from "$lib/utils/accounts";

const alice: StoredAccount = {
    userId: "@alice:hs",
    accessToken: "tokA",
    deviceId: "DEVA",
    homeserverUrl: "https://hs.example",
};
const bob: StoredAccount = {
    userId: "@bob:hs",
    accessToken: "tokB",
    deviceId: "DEVB",
    homeserverUrl: "https://hs.example",
};

const note = (id: string, ts: number) => ({
    actions: ["notify", { set_tweak: "sound", value: "default" }],
    event: {
        event_id: id,
        type: "m.room.message",
        sender: "@carol:hs",
        content: { msgtype: "m.text", body: `text of ${id}` },
    },
    read: false,
    room_id: "!room:hs",
    ts,
});

let serverNotifications: unknown[] = [];
let status = 200;
const requests: { url: string; token: string }[] = [];

function json(body: unknown, code = 200) {
    return new Response(JSON.stringify(body), {
        status: code,
        headers: { "Content-Type": "application/json" },
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    serverNotifications = [];
    status = 200;
    requests.length = 0;
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
            const token = String(
                (init?.headers as Record<string, string>)?.Authorization,
            ).replace("Bearer ", "");
            requests.push({ url, token });
            if (url.includes("/notifications"))
                return status === 200
                    ? json({ notifications: serverNotifications })
                    : json({ errcode: "M_UNKNOWN_TOKEN" }, status);
            if (url.includes("/state/m.room.name/"))
                return json({ name: "Bob's room" });
            if (url.includes("/state/m.room.member/"))
                return json({ displayname: "Carol" });
            return json({}, 404);
        }),
    );
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

function start(posted: AccountNotice[]) {
    return startInactiveAccountNotifier({
        accounts: () => [alice, bob],
        activeUserId: () => alice.userId,
        post: (n) => posted.push(n),
        intervalMs: 30_000,
    });
}

describe("inactive account notifier", () => {
    it("polls only the inactive account, with its own token", async () => {
        const stop = start([]);
        await vi.advanceTimersByTimeAsync(1);
        expect(requests.length).toBeGreaterThan(0);
        expect(requests.every((r) => r.token === "tokB")).toBe(true);
        stop();
    });

    it("posts nothing for the backlog, then each new notification once", async () => {
        const posted: AccountNotice[] = [];
        serverNotifications = [note("$old", 100)];
        const stop = start(posted);
        await vi.advanceTimersByTimeAsync(1);
        expect(posted).toEqual([]);

        serverNotifications = [note("$new", 200), note("$old", 100)];
        await vi.advanceTimersByTimeAsync(35_000);
        expect(posted).toEqual([
            {
                userId: "@bob:hs",
                roomId: "!room:hs",
                eventId: "$new",
                title: "Bob's room",
                sender: "Carol",
                body: "text of $new",
                loud: true,
            },
        ]);

        // The same list again: nothing new.
        await vi.advanceTimersByTimeAsync(35_000);
        expect(posted).toHaveLength(1);
        stop();
    });

    it("stops polling an account whose token is refused", async () => {
        status = 401;
        const stop = start([]);
        await vi.advanceTimersByTimeAsync(1);
        const after = requests.length;
        await vi.advanceTimersByTimeAsync(120_000);
        expect(requests.length).toBe(after);
        stop();
    });

    it("does nothing once stopped", async () => {
        const stop = start([]);
        await vi.advanceTimersByTimeAsync(1);
        stop();
        const after = requests.length;
        await vi.advanceTimersByTimeAsync(120_000);
        expect(requests.length).toBe(after);
    });
});

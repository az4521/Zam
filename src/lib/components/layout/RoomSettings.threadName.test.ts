import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, tick, unmount } from "svelte";
import type { Room } from "matrix-js-sdk";

const setRoomPowerLevels = vi.hoisted(() => vi.fn());
const threadLevel = vi.hoisted(() => ({ value: 50 }));

vi.mock("$lib/matrix/client", async (importOriginal) => ({
    ...(await importOriginal<typeof import("$lib/matrix/client")>()),
    getMyPowerLevel: () => 100,
    getUserPowerLevel: () => 0,
    getRoomPowerLevels: () => ({
        ban: 50,
        kick: 50,
        redact: 50,
        invite: 0,
        events_default: 0,
        state_default: 50,
        users_default: 0,
        events: {},
        users: {},
    }),
    getThreadNameLevel: () => threadLevel.value,
    setRoomPowerLevels,
    isUsingSlidingSync: () => false,
    getRoomMembers: () => [],
    getBannedMembers: () => [],
    getKnockingMembers: () => [],
}));

import RoomSettings from "./RoomSettings.svelte";
import { THREAD_NAME_POWER_LEVEL_KEY } from "$lib/utils/threadName";

const ROW = "Name any thread";

/** Whatever RoomSettings reads off the room that these tests don't care about. */
function fakeRoom(isSpace: boolean): Room {
    const known: Record<string, unknown> = {
        roomId: "!r:x",
        name: "Room",
        isSpaceRoom: () => isSpace,
        hasEncryptionStateEvent: () => false,
        getVersion: () => "11",
        getJoinRule: () => "invite",
        getLiveTimeline: () => ({
            getState: () => ({
                getStateEvents: () => null,
                maySendStateEvent: () => true,
            }),
        }),
    };
    return new Proxy(known, {
        get: (target, key) =>
            key in target ? target[key as string] : () => undefined,
    }) as unknown as Room;
}

let instance: Record<string, unknown> | null = null;
let host: HTMLElement;

async function openPermissions(isSpace = false) {
    host = document.createElement("div");
    document.body.appendChild(host);
    instance = mount(RoomSettings, {
        target: host,
        props: { room: fakeRoom(isSpace), onClose: () => {} },
    });
    flushSync();
    const tab = [...host.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("Permissions"),
    );
    tab!.click();
    flushSync();
    await tick();
}

function levelInput(label: string): HTMLInputElement | null {
    const row = [...host.querySelectorAll("span")].find(
        (s) => s.textContent?.trim() === label,
    )?.parentElement;
    return row?.querySelector("input") ?? null;
}

function setLevel(label: string, value: number) {
    const input = levelInput(label)!;
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();
}

async function save() {
    [...host.querySelectorAll("button")]
        .find((b) => b.textContent?.includes("Save"))!
        .click();
    await tick();
    await new Promise((resolve) => setTimeout(resolve));
}

describe("RoomSettings: thread name level", () => {
    beforeEach(() => {
        threadLevel.value = 50;
        setRoomPowerLevels.mockReset().mockResolvedValue(undefined);
    });

    afterEach(() => {
        if (instance) unmount(instance);
        instance = null;
        host.remove();
    });

    it("shows the room's level", async () => {
        threadLevel.value = 25;
        await openPermissions();
        expect(levelInput(ROW)?.value).toBe("25");
    });

    it("isn't offered in a space, which has no threads", async () => {
        await openPermissions(true);
        expect(levelInput("Redact messages")).not.toBeNull();
        expect(levelInput(ROW)).toBeNull();
    });

    it("saves a changed level under the unstable key", async () => {
        await openPermissions();
        setLevel(ROW, 75);
        await save();
        expect(setRoomPowerLevels).toHaveBeenCalledOnce();
        expect(setRoomPowerLevels.mock.calls[0][1]).toMatchObject({
            [THREAD_NAME_POWER_LEVEL_KEY]: 75,
        });
    });

    it("doesn't add the key when only another level changed", async () => {
        await openPermissions();
        setLevel("Redact messages", 75);
        await save();
        expect(setRoomPowerLevels).toHaveBeenCalledOnce();
        expect(setRoomPowerLevels.mock.calls[0][1]).toMatchObject({
            redact: 75,
        });
        expect(setRoomPowerLevels.mock.calls[0][1]).not.toHaveProperty(
            THREAD_NAME_POWER_LEVEL_KEY,
        );
    });

    it("writes nothing when nothing changed", async () => {
        await openPermissions();
        await save();
        expect(setRoomPowerLevels).not.toHaveBeenCalled();
    });
});

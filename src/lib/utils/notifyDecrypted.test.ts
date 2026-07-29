import { describe, it, expect } from "vitest";
import {
    shouldNotifyDecrypted,
    isAlreadyReadEvent,
    createBoundedIdSet,
    createBoundedIdMap,
    NOTIFIED_ID_CAP,
    type DecryptedNotifyInput,
} from "./notifyDecrypted";

// A message from someone else, on the live tail, in an unmuted room: notify.
const base: DecryptedNotifyInput = {
    eventId: "$evt1",
    alreadyNotified: false,
    isLiveAppend: true,
    isOwnEvent: false,
    threadRootId: null,
    pushNotify: true,
};

describe("shouldNotifyDecrypted", () => {
    it("notifies for a fresh live message from another user", () => {
        expect(shouldNotifyDecrypted(base)).toBe(true);
    });

    it("does not notify without an event id", () => {
        expect(shouldNotifyDecrypted({ ...base, eventId: null })).toBe(false);
        expect(shouldNotifyDecrypted({ ...base, eventId: undefined })).toBe(
            false,
        );
        expect(shouldNotifyDecrypted({ ...base, eventId: "" })).toBe(false);
    });

    it("does not notify twice for the same event", () => {
        expect(shouldNotifyDecrypted({ ...base, alreadyNotified: true })).toBe(
            false,
        );
    });

    it("does not notify for a mid-timeline insertion", () => {
        // Out-of-order/related events the SDK slots into the middle of the
        // live timeline are not fresh tail messages.
        expect(shouldNotifyDecrypted({ ...base, isLiveAppend: false })).toBe(
            false,
        );
    });

    it("does not notify for my own message", () => {
        expect(shouldNotifyDecrypted({ ...base, isOwnEvent: true })).toBe(
            false,
        );
    });

    it("does not notify for a thread reply", () => {
        // Thread replies have their own participant/mention-gated path.
        expect(shouldNotifyDecrypted({ ...base, threadRootId: "$root" })).toBe(
            false,
        );
    });

    it("stays silent when push rules say not to notify (muted room)", () => {
        expect(shouldNotifyDecrypted({ ...base, pushNotify: false })).toBe(
            false,
        );
    });

    it("keeps a muted room silent even for a mention-shaped live event", () => {
        expect(
            shouldNotifyDecrypted({
                ...base,
                pushNotify: false,
                alreadyNotified: false,
                isLiveAppend: true,
            }),
        ).toBe(false);
    });
});

describe("isAlreadyReadEvent", () => {
    const read = () => true;
    const unread = () => false;

    it("reports an event the receipt already covers", () => {
        expect(
            isAlreadyReadEvent({
                eventId: "$evt1",
                myUserId: "@me:hs",
                hasUserReadEvent: read,
            }),
        ).toBe(true);
    });

    it("reports an unread event as unread", () => {
        expect(
            isAlreadyReadEvent({
                eventId: "$evt1",
                myUserId: "@me:hs",
                hasUserReadEvent: unread,
            }),
        ).toBe(false);
    });

    it("asks about the right user and event", () => {
        const calls: Array<[string, string]> = [];
        isAlreadyReadEvent({
            eventId: "$evt1",
            myUserId: "@me:hs",
            hasUserReadEvent: (u, e) => {
                calls.push([u, e]);
                return true;
            },
        });
        expect(calls).toEqual([["@me:hs", "$evt1"]]);
    });

    it("fails OPEN when the event id is missing", () => {
        // Ambiguity must notify: a suppression bug eats a real message.
        expect(
            isAlreadyReadEvent({
                eventId: null,
                myUserId: "@me:hs",
                hasUserReadEvent: read,
            }),
        ).toBe(false);
        expect(
            isAlreadyReadEvent({
                eventId: "",
                myUserId: "@me:hs",
                hasUserReadEvent: read,
            }),
        ).toBe(false);
    });

    it("fails OPEN when the user id is missing", () => {
        expect(
            isAlreadyReadEvent({
                eventId: "$evt1",
                myUserId: null,
                hasUserReadEvent: read,
            }),
        ).toBe(false);
        expect(
            isAlreadyReadEvent({
                eventId: "$evt1",
                myUserId: undefined,
                hasUserReadEvent: read,
            }),
        ).toBe(false);
    });

    it("fails OPEN when there is no room to ask", () => {
        expect(
            isAlreadyReadEvent({
                eventId: "$evt1",
                myUserId: "@me:hs",
                hasUserReadEvent: null,
            }),
        ).toBe(false);
        expect(
            isAlreadyReadEvent({
                eventId: "$evt1",
                myUserId: "@me:hs",
            }),
        ).toBe(false);
    });

    it("fails OPEN when the lookup throws", () => {
        expect(
            isAlreadyReadEvent({
                eventId: "$evt1",
                myUserId: "@me:hs",
                hasUserReadEvent: () => {
                    throw new Error("event unknown to the room");
                },
            }),
        ).toBe(false);
    });

    it("fails OPEN on a non-boolean answer", () => {
        expect(
            isAlreadyReadEvent({
                eventId: "$evt1",
                myUserId: "@me:hs",
                hasUserReadEvent: (() => "yes") as unknown as (
                    u: string,
                    e: string,
                ) => boolean,
            }),
        ).toBe(false);
    });
});

describe("createBoundedIdSet", () => {
    it("remembers ids that were added", () => {
        const set = createBoundedIdSet(3);
        set.add("a");
        expect(set.has("a")).toBe(true);
        expect(set.has("b")).toBe(false);
        expect(set.size).toBe(1);
    });

    it("ignores a duplicate add", () => {
        const set = createBoundedIdSet(3);
        set.add("a");
        set.add("a");
        expect(set.size).toBe(1);
    });

    it("evicts the oldest id past the cap so a long session cannot leak", () => {
        const set = createBoundedIdSet(3);
        set.add("a");
        set.add("b");
        set.add("c");
        set.add("d");
        expect(set.size).toBe(3);
        expect(set.has("a")).toBe(false);
        expect(set.has("d")).toBe(true);
    });

    it("defaults to the shared cap", () => {
        const set = createBoundedIdSet();
        for (let i = 0; i <= NOTIFIED_ID_CAP; i++) set.add(`$e${i}`);
        expect(set.size).toBe(NOTIFIED_ID_CAP);
        expect(set.has("$e0")).toBe(false);
    });
});

describe("createBoundedIdMap", () => {
    it("stores and reads values", () => {
        const map = createBoundedIdMap<number>(3);
        map.set("a", 1);
        expect(map.get("a")).toBe(1);
        expect(map.has("a")).toBe(true);
        expect(map.get("nope")).toBeUndefined();
    });

    it("overwrites an existing id without growing", () => {
        const map = createBoundedIdMap<number>(3);
        map.set("a", 1);
        map.set("a", 2);
        expect(map.size).toBe(1);
        expect(map.get("a")).toBe(2);
    });

    it("deletes an id", () => {
        const map = createBoundedIdMap<number>(3);
        map.set("a", 1);
        map.delete("a");
        expect(map.has("a")).toBe(false);
        expect(map.size).toBe(0);
    });

    it("evicts the oldest entry past the cap", () => {
        const map = createBoundedIdMap<number>(2);
        map.set("a", 1);
        map.set("b", 2);
        map.set("c", 3);
        expect(map.size).toBe(2);
        expect(map.has("a")).toBe(false);
        expect(map.get("c")).toBe(3);
    });
});

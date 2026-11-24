import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import { MatrixEvent, RoomEvent } from "matrix-js-sdk";
import { ClientWidgetApi } from "matrix-widget-api";

const fakeClient = new EventEmitter();

vi.mock("$lib/matrix/runtime", () => ({
    captureClient: () => ({ client: fakeClient, generation: 1 }),
    getClient: () => fakeClient,
    ownedClient: () => fakeClient,
    ownedClientOrThrow: () => fakeClient,
}));
vi.mock("$lib/matrix/livekitCall", () => ({
    configuredRtcFoci: async () => [],
}));
vi.mock("$lib/matrix/media", () => ({
    mxcToHttp: () => null,
    fetchMediaBytes: async () => new Blob(),
    uploadContent: async () => "mxc://x/y",
}));

import {
    coalescedFetch,
    filterStateEvents,
    isSupportedCapability,
    mountWidget,
    type ServerStateEvent,
} from "./widgetHost";
import type { RoomWidget } from "$lib/utils/widgets";

const ROOM = "!room:example.org";

function widget(): RoomWidget {
    return {
        id: "w1",
        stateType: "im.vector.modular.widgets",
        type: "m.custom",
        url: "https://widget.example.org/",
        name: "Test",
        data: {},
        creatorUserId: "@me:example.org",
        waitForIframeLoad: true,
    } as unknown as RoomWidget;
}

function mount() {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    return mountWidget({
        iframe,
        widget: widget(),
        roomId: ROOM,
        url: "https://widget.example.org/",
        requestCapabilities: async (r) => r,
        requestOpenId: async () => false,
    });
}

describe("isSupportedCapability", () => {
    it("accepts room account data for the widget's own room", () => {
        expect(
            isSupportedCapability(
                "com.beeper.capabilities.receive.room_account_data:com.example.x",
            ),
        ).toBe(true);
    });

    it("refuses the MSC4533 LiveKit capabilities", () => {
        expect(
            isSupportedCapability("org.matrix.msc4533.rtc.livekit.get_token"),
        ).toBe(false);
    });

    it("accepts ordinary capabilities", () => {
        expect(isSupportedCapability("m.sticker")).toBe(true);
        expect(isSupportedCapability("org.matrix.msc2762.timeline:*")).toBe(
            true,
        );
    });
});

describe("filterStateEvents", () => {
    const events: ServerStateEvent[] = [
        {
            type: "net.nordeck.whiteboard",
            state_key: "board",
            event_id: "$b",
            sender: "@a:example.org",
            origin_server_ts: 10,
            content: { title: "one" },
        },
        {
            type: "net.nordeck.whiteboard",
            state_key: "other",
            event_id: "$o",
            sender: "@b:example.org",
            origin_server_ts: 11,
            content: {},
        },
        {
            type: "m.room.name",
            state_key: "",
            event_id: "$n",
            sender: "@a:example.org",
            origin_server_ts: 12,
            content: { name: "Room" },
        },
    ];

    it("keeps only the requested type when no state key is given", () => {
        const out = filterStateEvents(
            events,
            ROOM,
            "net.nordeck.whiteboard",
            undefined,
        );
        expect(out.map((e) => e.state_key)).toEqual(["board", "other"]);
    });

    it("narrows to one state key", () => {
        const out = filterStateEvents(
            events,
            ROOM,
            "net.nordeck.whiteboard",
            "board",
        );
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({
            type: "net.nordeck.whiteboard",
            state_key: "board",
            event_id: "$b",
            sender: "@a:example.org",
            origin_server_ts: 10,
            content: { title: "one" },
            room_id: ROOM,
            unsigned: {},
        });
    });

    it("returns nothing for a type the room does not have", () => {
        expect(
            filterStateEvents(events, ROOM, "im.vector.modular.widgets", ""),
        ).toEqual([]);
    });

    it("treats an empty state key as a real key, not a wildcard", () => {
        const out = filterStateEvents(events, ROOM, "m.room.name", "");
        expect(out.map((e) => e.event_id)).toEqual(["$n"]);
    });
});

describe("coalescedFetch", () => {
    it("shares one fetch between calls inside the window", async () => {
        let t = 1000;
        const fetch = vi.fn(async () => "state");
        const get = coalescedFetch(fetch, 2000, () => t);
        await expect(get()).resolves.toBe("state");
        t += 1500;
        await expect(get()).resolves.toBe("state");
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("fetches again once the window has passed", async () => {
        let t = 1000;
        const fetch = vi.fn(async () => "state");
        const get = coalescedFetch(fetch, 2000, () => t);
        await get();
        t += 2000;
        await get();
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("forgets a failed fetch so the next call retries", async () => {
        const t = 1000;
        const fetch = vi
            .fn<() => Promise<string>>()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce("state");
        const get = coalescedFetch(fetch, 2000, () => t);
        await expect(get()).rejects.toThrow("offline");
        await expect(get()).resolves.toBe("state");
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});

describe("mountWidget", () => {
    beforeEach(() => fakeClient.removeAllListeners());
    afterEach(() => vi.restoreAllMocks());

    it("tells the widget API which room is viewed", () => {
        // Without it the API drops every fed event and never pushes room state.
        const spy = vi.spyOn(ClientWidgetApi.prototype, "setViewedRoomId");
        const m = mount();
        expect(spy).toHaveBeenCalledWith(ROOM);
        m.dispose();
    });

    it("feeds live state events from the timeline once ready", () => {
        const feed = vi
            .spyOn(ClientWidgetApi.prototype, "feedEvent")
            .mockResolvedValue(undefined);
        let api: ClientWidgetApi | null = null;
        const orig = ClientWidgetApi.prototype.setViewedRoomId;
        vi.spyOn(
            ClientWidgetApi.prototype,
            "setViewedRoomId",
        ).mockImplementation(function (this: ClientWidgetApi, id) {
            api = this;
            return orig.call(this, id);
        });
        const m = mount();
        api!.emit("ready");
        const ev = new MatrixEvent({
            type: "net.nordeck.whiteboard",
            state_key: "board",
            room_id: ROOM,
            event_id: "$s1",
            sender: "@me:example.org",
            content: {},
        });
        fakeClient.emit(RoomEvent.Timeline, ev, { roomId: ROOM }, false, false);
        expect(feed).toHaveBeenCalledTimes(1);
        expect(feed.mock.calls[0][0]).toMatchObject({ event_id: "$s1" });
        m.dispose();
    });

    it("marks fallback sticky events as sticky for the widget", () => {
        // NeoBoard ignores RTC members without the marker, and with them all
        // their LiveKit data, on a server without MSC4354.
        const feed = vi
            .spyOn(ClientWidgetApi.prototype, "feedEvent")
            .mockResolvedValue(undefined);
        let api: ClientWidgetApi | null = null;
        const orig = ClientWidgetApi.prototype.setViewedRoomId;
        vi.spyOn(
            ClientWidgetApi.prototype,
            "setViewedRoomId",
        ).mockImplementation(function (this: ClientWidgetApi, id) {
            api = this;
            return orig.call(this, id);
        });
        const m = mount();
        api!.emit("ready");
        const ev = new MatrixEvent({
            type: "org.matrix.msc4143.rtc.member",
            room_id: ROOM,
            event_id: "$r1",
            sender: "@me:example.org",
            origin_server_ts: Date.now(),
            content: { msc4354_sticky_key: "member1" },
        });
        fakeClient.emit(RoomEvent.Timeline, ev, { roomId: ROOM }, false, false);
        expect(feed.mock.calls[0][0]).toMatchObject({
            msc4354_sticky: { duration_ms: 3_600_000 },
        });
        expect(ev.event).not.toHaveProperty("msc4354_sticky");
        m.dispose();
    });
});

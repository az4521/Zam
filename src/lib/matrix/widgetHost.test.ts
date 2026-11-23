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

import { mountWidget } from "./widgetHost";
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
});

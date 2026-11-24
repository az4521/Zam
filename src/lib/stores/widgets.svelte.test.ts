import { beforeEach, describe, expect, it } from "vitest";
import {
    forgetWidgetApproval,
    getWidgetApproval,
    setActiveWidget,
    setWidgetApproval,
    widgetsState,
} from "./widgets.svelte";
import type { RoomWidget } from "$lib/utils/widgets";

const USER = "@alice:example.org";
const ROOM = "!room:example.org";

function widget(overrides: Partial<RoomWidget> = {}): RoomWidget {
    return {
        id: "w1",
        stateType: "m.widget",
        type: "m.custom",
        url: "https://widgets.example.org/poll",
        name: "Poll",
        data: {},
        creatorUserId: USER,
        senderId: USER,
        waitForIframeLoad: true,
        avatarUrl: null,
        ...overrides,
    };
}

describe("widget approvals", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("returns null when nothing was stored", () => {
        expect(getWidgetApproval(USER, ROOM, widget())).toBeNull();
    });

    it("stores and reads back an approval", () => {
        const w = widget();
        setWidgetApproval(USER, ROOM, w, {
            load: true,
            capabilities: ["m.always_on_screen"],
            denied: [],
            openId: false,
        });
        expect(getWidgetApproval(USER, ROOM, w)).toEqual({
            load: true,
            capabilities: ["m.always_on_screen"],
            denied: [],
            openId: false,
        });
    });

    it("keeps approvals separate per room, widget and user", () => {
        const w = widget();
        setWidgetApproval(USER, ROOM, w, {
            load: true,
            capabilities: [],
            denied: [],
            openId: null,
        });
        expect(getWidgetApproval(USER, "!other:example.org", w)).toBeNull();
        expect(getWidgetApproval(USER, ROOM, widget({ id: "w2" }))).toBeNull();
        expect(getWidgetApproval("@bob:example.org", ROOM, w)).toBeNull();
    });

    it("invalidates the approval when the widget url changes", () => {
        const w = widget();
        setWidgetApproval(USER, ROOM, w, {
            load: true,
            capabilities: ["x"],
            denied: [],
            openId: true,
        });
        const changed = widget({ url: "https://widgets.example.org/poll-v2" });
        expect(getWidgetApproval(USER, ROOM, changed)).toBeNull();
        expect(getWidgetApproval(USER, ROOM, w)).not.toBeNull();
    });

    it("forgets an approval", () => {
        const w = widget();
        setWidgetApproval(USER, ROOM, w, {
            load: false,
            capabilities: [],
            denied: [],
            openId: null,
        });
        forgetWidgetApproval(USER, ROOM, w);
        expect(getWidgetApproval(USER, ROOM, w)).toBeNull();
    });

    it("forgetting a missing approval is a no-op", () => {
        expect(() => forgetWidgetApproval(USER, ROOM, widget())).not.toThrow();
    });

    it("treats a corrupt stored value as empty", () => {
        localStorage.setItem(`zam_widget_approvals:${USER}`, "{not json");
        expect(getWidgetApproval(USER, ROOM, widget())).toBeNull();
        // A later write still works after the corrupt value.
        setWidgetApproval(USER, ROOM, widget(), {
            load: true,
            capabilities: [],
            denied: [],
            openId: null,
        });
        expect(getWidgetApproval(USER, ROOM, widget())).not.toBeNull();
    });

    it("drops malformed entries but keeps valid ones", () => {
        const w = widget();
        const good = { load: true, capabilities: [], denied: [], openId: null };
        localStorage.setItem(
            `zam_widget_approvals:${USER}`,
            JSON.stringify({
                [`${ROOM}|${w.id}|${w.url}`]: "nope",
                "other|key|here": good,
            }),
        );
        expect(getWidgetApproval(USER, ROOM, w)).toBeNull();
        setWidgetApproval(USER, ROOM, widget({ id: "w9" }), good);
        expect(getWidgetApproval(USER, ROOM, widget({ id: "w9" }))).toEqual(
            good,
        );
    });

    it("uses the unscoped key when no user is known", () => {
        setWidgetApproval(null, ROOM, widget(), {
            load: true,
            capabilities: [],
            denied: [],
            openId: null,
        });
        expect(localStorage.getItem("zam_widget_approvals")).not.toBeNull();
        expect(getWidgetApproval(null, ROOM, widget())).not.toBeNull();
    });
});

describe("widget approval storage shape", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("reads a legacy record without denied as having no refusals", () => {
        const w = widget();
        localStorage.setItem(
            `zam_widget_approvals:${USER}`,
            JSON.stringify({
                [`${ROOM}|${w.id}|${w.url}`]: {
                    load: true,
                    capabilities: ["m.always_on_screen"],
                    openId: null,
                },
            }),
        );
        expect(getWidgetApproval(USER, ROOM, w)).toEqual({
            load: true,
            capabilities: ["m.always_on_screen"],
            denied: [],
            openId: null,
        });
    });

    it("persists refusals alongside approvals", () => {
        const w = widget();
        setWidgetApproval(USER, ROOM, w, {
            load: true,
            capabilities: ["a"],
            denied: ["b"],
            openId: null,
        });
        expect(getWidgetApproval(USER, ROOM, w)?.denied).toEqual(["b"]);
    });

    it("drops a refusal that is also an approval on read", () => {
        const w = widget();
        localStorage.setItem(
            `zam_widget_approvals:${USER}`,
            JSON.stringify({
                [`${ROOM}|${w.id}|${w.url}`]: {
                    load: true,
                    capabilities: ["a"],
                    denied: ["a", "b"],
                    openId: null,
                },
            }),
        );
        expect(getWidgetApproval(USER, ROOM, w)?.denied).toEqual(["b"]);
    });
});

describe("active widget state", () => {
    it("records the open widget and room", () => {
        setActiveWidget(ROOM, "w1");
        expect(widgetsState.activeRoomId).toBe(ROOM);
        expect(widgetsState.activeWidgetId).toBe("w1");
        setActiveWidget(null, null);
        expect(widgetsState.activeRoomId).toBeNull();
        expect(widgetsState.activeWidgetId).toBeNull();
    });
});

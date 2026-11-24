import { describe, expect, it } from "vitest";
import {
    WIDGET_CAP_KEYS,
    buildWidgetUrl,
    dedupeWidgets,
    describeCapability,
    isCallWidget,
    isUnsafeWidgetUrl,
    parseWidgetState,
    widgetOrigin,
    type RoomWidget,
    type WidgetUrlContext,
} from "./widgets";

const SENDER = "@alice:example.org";

function widget(overrides: Partial<RoomWidget> = {}): RoomWidget {
    return {
        id: "w1",
        stateType: "m.widget",
        type: "m.custom",
        url: "https://example.org/app",
        name: "App",
        data: {},
        creatorUserId: SENDER,
        senderId: SENDER,
        waitForIframeLoad: true,
        avatarUrl: null,
        ...overrides,
    };
}

describe("parseWidgetState", () => {
    const content = {
        type: "m.custom",
        url: "https://widgets.example.org/poll?x=1",
        name: "Poll",
        data: { title: "Votes" },
        creatorUserId: "@bob:example.org",
        waitForIframeLoad: false,
        avatar_url: "mxc://example.org/abc",
    };

    it("parses the im.vector.modular.widgets state type", () => {
        const w = parseWidgetState(
            "im.vector.modular.widgets",
            "w1",
            content,
            SENDER,
        );
        expect(w).toEqual({
            id: "w1",
            stateType: "im.vector.modular.widgets",
            type: "m.custom",
            url: "https://widgets.example.org/poll?x=1",
            name: "Poll",
            data: { title: "Votes" },
            creatorUserId: "@bob:example.org",
            senderId: SENDER,
            waitForIframeLoad: false,
            avatarUrl: "mxc://example.org/abc",
        });
    });

    it("parses the m.widget state type", () => {
        const w = parseWidgetState(
            "m.widget",
            "w2",
            { type: "jitsi", url: "https://j.example/x" },
            SENDER,
        );
        expect(w?.stateType).toBe("m.widget");
        expect(w?.id).toBe("w2");
    });

    it("treats empty or removed content as no widget", () => {
        expect(parseWidgetState("m.widget", "w1", {}, SENDER)).toBeNull();
        expect(parseWidgetState("m.widget", "w1", null, SENDER)).toBeNull();
        expect(parseWidgetState("m.widget", "w1", "text", SENDER)).toBeNull();
        expect(parseWidgetState("m.widget", "w1", [], SENDER)).toBeNull();
    });

    it("rejects unknown state types and empty state keys", () => {
        expect(
            parseWidgetState("m.room.name", "w1", content, SENDER),
        ).toBeNull();
        expect(parseWidgetState("m.widget", "", content, SENDER)).toBeNull();
        expect(parseWidgetState("m.widget", "   ", content, SENDER)).toBeNull();
    });

    it("rejects a missing type or url", () => {
        expect(
            parseWidgetState(
                "m.widget",
                "w1",
                { url: "https://a.example" },
                SENDER,
            ),
        ).toBeNull();
        expect(
            parseWidgetState("m.widget", "w1", { type: "m.custom" }, SENDER),
        ).toBeNull();
    });

    it("rejects non-http(s) and unparsable urls", () => {
        expect(
            parseWidgetState(
                "m.widget",
                "w1",
                { type: "m.custom", url: "javascript:alert(1)" },
                SENDER,
            ),
        ).toBeNull();
        expect(
            parseWidgetState(
                "m.widget",
                "w1",
                { type: "m.custom", url: "data:text/html,hi" },
                SENDER,
            ),
        ).toBeNull();
        expect(
            parseWidgetState(
                "m.widget",
                "w1",
                { type: "m.custom", url: "not a url" },
                SENDER,
            ),
        ).toBeNull();
    });

    it("falls back to the url host for the name", () => {
        const w = parseWidgetState(
            "m.widget",
            "w1",
            { type: "m.custom", url: "https://apps.example.org/x" },
            SENDER,
        );
        expect(w?.name).toBe("apps.example.org");
    });

    it("falls back to the sender for the creator and defaults the flags", () => {
        const w = parseWidgetState(
            "m.widget",
            "w1",
            { type: "m.custom", url: "https://a.example", name: "  " },
            SENDER,
        );
        expect(w?.creatorUserId).toBe(SENDER);
        expect(w?.name).toBe("a.example");
        expect(w?.waitForIframeLoad).toBe(true);
        expect(w?.data).toEqual({});
        expect(w?.avatarUrl).toBeNull();
    });

    it("ignores a non-mxc avatar", () => {
        const w = parseWidgetState(
            "m.widget",
            "w1",
            {
                type: "m.custom",
                url: "https://a.example",
                avatar_url: "https://x",
            },
            SENDER,
        );
        expect(w?.avatarUrl).toBeNull();
    });
});

describe("isCallWidget", () => {
    it("hides the Element Call widget types only", () => {
        expect(isCallWidget({ type: "m.call" })).toBe(true);
        expect(isCallWidget({ type: "io.element.call" })).toBe(true);
        expect(isCallWidget({ type: "org.matrix.msc3401.call" })).toBe(true);
        expect(isCallWidget({ type: "m.custom" })).toBe(false);
        expect(isCallWidget({ type: "jitsi" })).toBe(false);
        expect(isCallWidget({ type: "M.CALL" })).toBe(false);
    });
});

describe("dedupeWidgets", () => {
    it("prefers m.widget when the same id is under both state types", () => {
        const legacy = widget({
            id: "dup",
            stateType: "im.vector.modular.widgets",
            name: "Old",
        });
        const modern = widget({
            id: "dup",
            stateType: "m.widget",
            name: "New",
        });
        const out = dedupeWidgets([legacy, modern]);
        expect(out).toHaveLength(1);
        expect(out[0].stateType).toBe("m.widget");
        expect(out[0].name).toBe("New");
    });

    it("keeps the legacy entry when no m.widget copy exists", () => {
        const legacy = widget({
            id: "only",
            stateType: "im.vector.modular.widgets",
        });
        expect(dedupeWidgets([legacy])[0].stateType).toBe(
            "im.vector.modular.widgets",
        );
    });

    it("sorts by name then id", () => {
        const out = dedupeWidgets([
            widget({ id: "b", name: "Beta" }),
            widget({ id: "z", name: "Alpha" }),
            widget({ id: "a", name: "Alpha" }),
        ]);
        expect(out.map((w) => w.id)).toEqual(["a", "z", "b"]);
    });
});

describe("buildWidgetUrl", () => {
    const ctx: WidgetUrlContext = {
        userId: "@alice:example.org",
        displayName: "Alice & Bob",
        avatarUrl: "mxc://example.org/av",
        roomId: "!room:example.org",
        deviceId: "DEV1",
        baseUrl: "https://matrix.example.org",
        theme: "dark",
        language: "en-GB",
        clientId: "moe.crafty.zam",
    };

    it("replaces every built-in template variable", () => {
        const url = buildWidgetUrl(
            {
                id: "w1",
                data: {},
                url:
                    "https://app.example/?u=$matrix_user_id&r=$matrix_room_id&n=$matrix_display_name" +
                    "&a=$matrix_avatar_url&w=$matrix_widget_id&c=$org.matrix.msc2873.client_id" +
                    "&t=$org.matrix.msc2873.client_theme&l=$org.matrix.msc2873.client_language" +
                    "&d=$org.matrix.msc3819.matrix_device_id&b=$org.matrix.msc4039.matrix_base_url",
            },
            ctx,
            "https://zam.example/",
        );
        const u = new URL(url);
        expect(u.searchParams.get("u")).toBe("@alice:example.org");
        expect(u.searchParams.get("r")).toBe("!room:example.org");
        expect(u.searchParams.get("n")).toBe("Alice & Bob");
        expect(u.searchParams.get("a")).toBe("mxc://example.org/av");
        expect(u.searchParams.get("w")).toBe("w1");
        expect(u.searchParams.get("c")).toBe("moe.crafty.zam");
        expect(u.searchParams.get("t")).toBe("dark");
        expect(u.searchParams.get("l")).toBe("en-GB");
        expect(u.searchParams.get("d")).toBe("DEV1");
        expect(u.searchParams.get("b")).toBe("https://matrix.example.org");
    });

    it("substitutes data keys as $key and encodes their values", () => {
        const url = buildWidgetUrl(
            {
                id: "w1",
                data: {
                    title: "a b&c",
                    count: 3,
                    flag: true,
                    nested: { x: 1 },
                },
                url: "https://app.example/?t=$title&c=$count&f=$flag&n=$nested",
            },
            ctx,
            "https://zam.example/",
        );
        const u = new URL(url);
        expect(u.searchParams.get("t")).toBe("a b&c");
        expect(u.searchParams.get("c")).toBe("3");
        expect(u.searchParams.get("f")).toBe("true");
        expect(u.searchParams.get("n")).toBe("$nested");
    });

    it("encodes spaces and ampersands in the substituted value", () => {
        const url = buildWidgetUrl(
            {
                id: "w1",
                data: {},
                url: "https://app.example/?n=$matrix_display_name",
            },
            ctx,
            "https://zam.example/",
        );
        // URLSearchParams form-encodes the space as "+"; the decoded value is intact.
        expect(url).toContain("n=Alice+%26+Bob");
        expect(new URL(url).searchParams.get("n")).toBe("Alice & Bob");
    });

    it("prefers the longer built-in name over a shorter data key", () => {
        const url = buildWidgetUrl(
            {
                id: "w1",
                data: { matrix_user: "short" },
                url: "https://app.example/?a=$matrix_user_id&b=$matrix_user",
            },
            ctx,
            "https://zam.example/",
        );
        const u = new URL(url);
        expect(u.searchParams.get("a")).toBe("@alice:example.org");
        expect(u.searchParams.get("b")).toBe("short");
    });

    it("preserves an existing query string and hash", () => {
        const url = buildWidgetUrl(
            {
                id: "w1",
                data: {},
                url: "https://app.example/path?existing=yes#frag",
            },
            ctx,
            "https://zam.example/",
        );
        const u = new URL(url);
        expect(u.searchParams.get("existing")).toBe("yes");
        expect(u.hash).toBe("#frag");
    });

    it("appends widgetId and parentUrl", () => {
        const url = buildWidgetUrl(
            { id: "abc", data: {}, url: "https://app.example/" },
            ctx,
            "https://zam.example/#/room",
        );
        const u = new URL(url);
        expect(u.searchParams.get("widgetId")).toBe("abc");
        expect(u.searchParams.get("parentUrl")).toBe(
            "https://zam.example/#/room",
        );
    });
});

describe("widgetOrigin and isUnsafeWidgetUrl", () => {
    it("returns the origin or null", () => {
        expect(widgetOrigin("https://a.example:8443/x?y")).toBe(
            "https://a.example:8443",
        );
        expect(widgetOrigin("nope")).toBeNull();
    });

    it("refuses non-http(s), unparsable and same-origin urls", () => {
        const app = "https://matrix.example.org";
        expect(isUnsafeWidgetUrl("javascript:alert(1)", app)).toBe(true);
        expect(isUnsafeWidgetUrl("ftp://a.example/x", app)).toBe(true);
        expect(isUnsafeWidgetUrl("not a url", app)).toBe(true);
        expect(isUnsafeWidgetUrl("https://matrix.example.org/app", app)).toBe(
            true,
        );
    });

    it("allows other http(s) origins", () => {
        const app = "https://matrix.example.org";
        expect(isUnsafeWidgetUrl("https://widgets.example.org/app", app)).toBe(
            false,
        );
        expect(isUnsafeWidgetUrl("http://localhost:8080/app", app)).toBe(false);
        // Same host, different port is a different origin.
        expect(
            isUnsafeWidgetUrl("https://matrix.example.org:8443/app", app),
        ).toBe(false);
    });
});

describe("describeCapability", () => {
    it("maps the simple capabilities", () => {
        expect(describeCapability("m.always_on_screen")).toEqual({
            key: "widgets.cap.alwaysOnScreen",
            params: {},
        });
        expect(
            describeCapability("org.matrix.msc2931.always_on_screen"),
        ).toEqual({ key: "widgets.cap.alwaysOnScreen", params: {} });
        expect(describeCapability("m.capability.screenshot").key).toBe(
            "widgets.cap.screenshot",
        );
        expect(describeCapability("org.matrix.msc2931.navigate").key).toBe(
            "widgets.cap.navigate",
        );
        expect(describeCapability("io.element.requires_client").key).toBe(
            "widgets.cap.requiresClient",
        );
        expect(
            describeCapability("org.matrix.msc3973.user_directory_search").key,
        ).toBe("widgets.cap.userDirectory");
        expect(describeCapability("org.matrix.msc4039.upload_file").key).toBe(
            "widgets.cap.uploadFile",
        );
        expect(describeCapability("org.matrix.msc4039.download_file").key).toBe(
            "widgets.cap.downloadFile",
        );
    });

    it("maps the MatrixRTC widget capabilities", () => {
        expect(
            describeCapability("org.matrix.msc4157.send.delayed_event").key,
        ).toBe("widgets.cap.sendDelayed");
        expect(
            describeCapability("org.matrix.msc4157.update_delayed_event").key,
        ).toBe("widgets.cap.updateDelayed");
        expect(
            describeCapability("org.matrix.msc4407.send.sticky_event").key,
        ).toBe("widgets.cap.sendSticky");
        expect(
            describeCapability("org.matrix.msc4407.receive.sticky_event").key,
        ).toBe("widgets.cap.receiveSticky");
        expect(
            describeCapability("org.matrix.msc4515.rtc_transports").key,
        ).toBe("widgets.cap.rtcTransports");
    });

    it("maps timeline capabilities", () => {
        expect(describeCapability("org.matrix.msc2762.timeline:*")).toEqual({
            key: "widgets.cap.timelineAll",
            params: {},
        });
        expect(
            describeCapability("org.matrix.msc2762.timeline:!r:example.org"),
        ).toEqual({
            key: "widgets.cap.timelineRoom",
            params: { roomId: "!r:example.org" },
        });
    });

    it("maps state send and receive capabilities", () => {
        expect(
            describeCapability(
                "org.matrix.msc2762.send.state_event:m.room.topic#",
            ),
        ).toEqual({
            key: "widgets.cap.sendStateAny",
            params: { eventType: "m.room.topic" },
        });
        expect(
            describeCapability(
                "org.matrix.msc2762.send.state_event:m.room.topic#abc",
            ),
        ).toEqual({
            key: "widgets.cap.sendState",
            params: { eventType: "m.room.topic", stateKey: "abc" },
        });
        expect(
            describeCapability(
                "org.matrix.msc2762.receive.state_event:m.room.topic#",
            ),
        ).toEqual({
            key: "widgets.cap.receiveStateAny",
            params: { eventType: "m.room.topic" },
        });
        expect(
            describeCapability(
                "org.matrix.msc2762.receive.state_event:m.room.topic#abc",
            ),
        ).toEqual({
            key: "widgets.cap.receiveState",
            params: { eventType: "m.room.topic", stateKey: "abc" },
        });
    });

    it("maps room event and message capabilities", () => {
        expect(
            describeCapability("org.matrix.msc2762.send.event:com.example.x"),
        ).toEqual({
            key: "widgets.cap.sendEvent",
            params: { eventType: "com.example.x" },
        });
        expect(
            describeCapability(
                "org.matrix.msc2762.receive.event:com.example.x",
            ),
        ).toEqual({
            key: "widgets.cap.receiveEvent",
            params: { eventType: "com.example.x" },
        });
        expect(
            describeCapability(
                "org.matrix.msc2762.send.event:m.room.message#m.text",
            ),
        ).toEqual({
            key: "widgets.cap.sendMessage",
            params: { msgtype: "m.text" },
        });
        expect(
            describeCapability(
                "org.matrix.msc2762.receive.event:m.room.message#m.image",
            ),
        ).toEqual({
            key: "widgets.cap.receiveMessage",
            params: { msgtype: "m.image" },
        });
    });

    it("maps to-device capabilities", () => {
        expect(
            describeCapability(
                "org.matrix.msc3819.send.to_device:com.example.td",
            ),
        ).toEqual({
            key: "widgets.cap.sendToDevice",
            params: { eventType: "com.example.td" },
        });
        expect(
            describeCapability(
                "org.matrix.msc3819.receive.to_device:com.example.td",
            ),
        ).toEqual({
            key: "widgets.cap.receiveToDevice",
            params: { eventType: "com.example.td" },
        });
    });

    it("maps room account data and sticker capabilities", () => {
        expect(
            describeCapability(
                "com.beeper.capabilities.receive.room_account_data:com.example.x",
            ),
        ).toEqual({
            key: "widgets.cap.receiveAccountData",
            params: { eventType: "com.example.x" },
        });
        expect(describeCapability("m.sticker")).toEqual({
            key: "widgets.cap.sticker",
            params: {},
        });
    });

    it("falls back to unknown with the raw capability", () => {
        expect(describeCapability("com.example.mystery")).toEqual({
            key: "widgets.cap.unknown",
            params: { capability: "com.example.mystery" },
        });
    });

    it("lists every key it can return", () => {
        const produced = new Set(
            [
                "m.always_on_screen",
                "m.capability.screenshot",
                "org.matrix.msc2931.navigate",
                "io.element.requires_client",
                "org.matrix.msc3973.user_directory_search",
                "org.matrix.msc4039.upload_file",
                "org.matrix.msc4039.download_file",
                "org.matrix.msc4157.send.delayed_event",
                "org.matrix.msc4157.update_delayed_event",
                "org.matrix.msc4407.send.sticky_event",
                "org.matrix.msc4407.receive.sticky_event",
                "org.matrix.msc4515.rtc_transports",
                "org.matrix.msc2762.timeline:*",
                "org.matrix.msc2762.timeline:!r:x",
                "org.matrix.msc2762.send.state_event:a#",
                "org.matrix.msc2762.send.state_event:a#b",
                "org.matrix.msc2762.receive.state_event:a#",
                "org.matrix.msc2762.receive.state_event:a#b",
                "org.matrix.msc2762.send.event:a",
                "org.matrix.msc2762.send.event:m.room.message#m.text",
                "org.matrix.msc2762.receive.event:a",
                "org.matrix.msc2762.receive.event:m.room.message#m.text",
                "org.matrix.msc3819.send.to_device:a",
                "org.matrix.msc3819.receive.to_device:a",
                "com.beeper.capabilities.receive.room_account_data:a",
                "m.sticker",
                "x.unknown",
            ].map((c) => describeCapability(c).key),
        );
        expect([...produced].sort()).toEqual([...WIDGET_CAP_KEYS].sort());
    });
});

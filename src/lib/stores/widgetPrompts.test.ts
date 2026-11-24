import { beforeEach, describe, expect, it } from "vitest";
import {
    capabilityDecisionDelta,
    effectiveApproval,
    mergeApproval,
    planCapabilityRequest,
    resolveCapabilityRequest,
    resolveOpenIdRequest,
    widgetPrompts,
} from "./widgetPrompts.svelte";
import { getWidgetApproval } from "./widgets.svelte";
import type { RoomWidget } from "$lib/utils/widgets";

const USER = "@alice:example.org";

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

/** Each test uses its own room: session approvals are module state. */
let roomSeq = 0;
function freshRoom(): string {
    return `!room${++roomSeq}:example.org`;
}

describe("planCapabilityRequest", () => {
    it("grants approved and never re-prompts refused capabilities", () => {
        const plan = planCapabilityRequest(["a", "b", "c"], {
            capabilities: ["a"],
            denied: ["b"],
        });
        expect(plan).toEqual({ granted: ["a"], undecided: ["c"] });
    });

    it("asks only about undecided capabilities", () => {
        const plan = planCapabilityRequest(["a", "b"], {
            capabilities: [],
            denied: ["a"],
        });
        expect(plan.undecided).toEqual(["b"]);
    });

    it("has nothing undecided when every request is decided", () => {
        const plan = planCapabilityRequest(["a", "b"], {
            capabilities: ["a"],
            denied: ["b"],
        });
        expect(plan.undecided).toEqual([]);
    });

    it("treats no approval at all as everything undecided", () => {
        expect(planCapabilityRequest(["a", "b"], null)).toEqual({
            granted: [],
            undecided: ["a", "b"],
        });
    });
});

describe("capabilityDecisionDelta", () => {
    it("approves the ticked undecided ones and refuses the rest", () => {
        expect(capabilityDecisionDelta(["b", "c"], ["c"])).toEqual({
            capabilities: ["c"],
            denied: ["b"],
        });
    });
});

describe("mergeApproval (latest decision wins)", () => {
    it("a refusal removes an earlier approval", () => {
        const merged = mergeApproval(
            { load: true, capabilities: ["a"], denied: [], openId: null },
            { denied: ["a"] },
        );
        expect(merged.capabilities).toEqual([]);
        expect(merged.denied).toEqual(["a"]);
    });

    it("an approval removes an earlier refusal", () => {
        const merged = mergeApproval(
            { load: false, capabilities: [], denied: ["a"], openId: null },
            { capabilities: ["a"] },
        );
        expect(merged.capabilities).toEqual(["a"]);
        expect(merged.denied).toEqual([]);
    });

    it("keeps the base openId and load when the delta has none", () => {
        const merged = mergeApproval(
            { load: true, capabilities: [], denied: [], openId: false },
            { denied: ["a"] },
        );
        expect(merged.load).toBe(true);
        expect(merged.openId).toBe(false);
    });
});

describe("resolveCapabilityRequest", () => {
    it("prompts once, then stays silent for remembered answers", async () => {
        const room = freshRoom();
        const w = widget();
        const first = resolveCapabilityRequest(
            USER,
            room,
            w,
            new Set(["a", "b"]),
        );
        expect(widgetPrompts.current?.capabilities).toEqual(["a", "b"]);
        widgetPrompts.current?.settle({ approved: ["a"], remember: true });
        await expect(first).resolves.toEqual(new Set(["a"]));

        const again = resolveCapabilityRequest(
            USER,
            room,
            w,
            new Set(["a", "b"]),
        );
        await expect(again).resolves.toEqual(new Set(["a"]));
        expect(widgetPrompts.current).toBeNull();
        expect(getWidgetApproval(USER, room, w)?.denied).toEqual(["b"]);
    });

    it("re-prompts only for the undecided capabilities", async () => {
        const room = freshRoom();
        const w = widget();
        const first = resolveCapabilityRequest(
            USER,
            room,
            w,
            new Set(["a", "b"]),
        );
        widgetPrompts.current?.settle({ approved: ["a"], remember: true });
        await first;

        const next = resolveCapabilityRequest(
            USER,
            room,
            w,
            new Set(["a", "b", "c"]),
        );
        expect(widgetPrompts.current?.capabilities).toEqual(["c"]);
        widgetPrompts.current?.settle({ approved: ["c"], remember: false });
        await expect(next).resolves.toEqual(new Set(["a", "c"]));
    });

    it("does not ask again in the same session when not remembered", async () => {
        const room = freshRoom();
        const w = widget();
        const first = resolveCapabilityRequest(USER, room, w, new Set(["x"]));
        widgetPrompts.current?.settle({ approved: [], remember: false });
        await expect(first).resolves.toEqual(new Set());

        const again = resolveCapabilityRequest(USER, room, w, new Set(["x"]));
        await expect(again).resolves.toEqual(new Set());
        expect(widgetPrompts.current).toBeNull();
        expect(getWidgetApproval(USER, room, w)).toBeNull();
        expect(effectiveApproval(USER, room, w)?.denied).toEqual(["x"]);
    });

    it("stays silent for a remembered refusal with nothing granted", async () => {
        const room = freshRoom();
        const w = widget();
        const first = resolveCapabilityRequest(USER, room, w, new Set(["a"]));
        widgetPrompts.current?.settle({ approved: [], remember: true });
        await first;

        // Refused and remembered: silent, nothing granted.
        await expect(
            resolveCapabilityRequest(USER, room, w, new Set(["a"])),
        ).resolves.toEqual(new Set());
        expect(widgetPrompts.current).toBeNull();
    });
});

describe("resolveOpenIdRequest", () => {
    it("remembers a refusal for this session even without remember", async () => {
        const room = freshRoom();
        const w = widget();
        const first = resolveOpenIdRequest(USER, room, w);
        expect(widgetPrompts.current?.mode).toBe("openid");
        widgetPrompts.current?.settle({ approved: [], remember: false });
        await expect(first).resolves.toBe(false);

        await expect(resolveOpenIdRequest(USER, room, w)).resolves.toBe(false);
        expect(widgetPrompts.current).toBeNull();
        expect(getWidgetApproval(USER, room, w)).toBeNull();
    });

    it("grants and remembers an approval", async () => {
        const room = freshRoom();
        const w = widget();
        const first = resolveOpenIdRequest(USER, room, w);
        widgetPrompts.current?.settle({ approved: ["openid"], remember: true });
        await expect(first).resolves.toBe(true);
        expect(getWidgetApproval(USER, room, w)?.openId).toBe(true);
    });
});

describe("dismissed prompts are not decisions", () => {
    it("a dismissed capability prompt records nothing and asks again later", async () => {
        const room = freshRoom();
        const w = widget();
        const first = resolveCapabilityRequest(USER, room, w, new Set(["a"]));
        widgetPrompts.current?.settle({
            approved: [],
            remember: false,
            dismissed: true,
        });
        await expect(first).resolves.toEqual(new Set());
        expect(effectiveApproval(USER, room, w)).toBeNull();

        const again = resolveCapabilityRequest(USER, room, w, new Set(["a"]));
        expect(widgetPrompts.current?.capabilities).toEqual(["a"]);
        widgetPrompts.current?.settle({ approved: ["a"], remember: false });
        await expect(again).resolves.toEqual(new Set(["a"]));
    });

    it("a dismissal keeps already granted capabilities and asks only the rest", async () => {
        const room = freshRoom();
        const w = widget();
        const first = resolveCapabilityRequest(USER, room, w, new Set(["a"]));
        widgetPrompts.current?.settle({ approved: ["a"], remember: true });
        await first;

        const next = resolveCapabilityRequest(
            USER,
            room,
            w,
            new Set(["a", "b"]),
        );
        expect(widgetPrompts.current?.capabilities).toEqual(["b"]);
        widgetPrompts.current?.settle({
            approved: [],
            remember: true,
            dismissed: true,
        });
        await expect(next).resolves.toEqual(new Set(["a"]));
        expect(getWidgetApproval(USER, room, w)?.denied).toEqual([]);
    });

    it("a superseded prompt is dismissed, not refused", async () => {
        const room = freshRoom();
        const w = widget();
        const older = resolveCapabilityRequest(USER, room, w, new Set(["a"]));
        const newer = resolveOpenIdRequest(USER, freshRoom(), widget());
        await expect(older).resolves.toEqual(new Set());
        expect(effectiveApproval(USER, room, w)).toBeNull();
        widgetPrompts.current?.settle({ approved: [], remember: false });
        await expect(newer).resolves.toBe(false);
    });

    it("a dismissed OpenID prompt records nothing and asks again later", async () => {
        const room = freshRoom();
        const w = widget();
        const first = resolveOpenIdRequest(USER, room, w);
        widgetPrompts.current?.settle({
            approved: [],
            remember: true,
            dismissed: true,
        });
        await expect(first).resolves.toBe(false);
        expect(getWidgetApproval(USER, room, w)).toBeNull();
        expect(effectiveApproval(USER, room, w)).toBeNull();

        const again = resolveOpenIdRequest(USER, room, w);
        expect(widgetPrompts.current?.mode).toBe("openid");
        widgetPrompts.current?.settle({
            approved: ["openid"],
            remember: false,
        });
        await expect(again).resolves.toBe(true);
    });
});

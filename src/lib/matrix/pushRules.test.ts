import { describe, expect, it, vi } from "vitest";
import { PushRuleKind, type MatrixClient } from "matrix-js-sdk";
import {
    actionsForLevel,
    getRoomNotificationSettingForClient,
    isHighlightAction,
    setDefaultPushRuleLevelForClient,
    setRoomNotificationSettingForClient,
    type DefaultRuleLevelWrite,
    type PushRuleLevel,
} from "./pushRules";

// Spec-default action templates (as stored on each DEFAULT_PUSH_RULES entry).
const MENTION_DEFAULT = [
    "notify",
    { set_tweak: "sound", value: "default" },
    { set_tweak: "highlight" },
];
const MESSAGE_DEFAULT = ["notify", { set_tweak: "sound", value: "default" }];

const hasSound = (a: unknown[]) =>
    a.some((x) => typeof x === "object" && (x as any).set_tweak === "sound");
const emitsHighlightFalse = (a: unknown[]) =>
    a.some(
        (x) =>
            typeof x === "object" &&
            (x as any).set_tweak === "highlight" &&
            (x as any).value === false,
    );

describe("actionsForLevel", () => {
    it("loud returns the default actions verbatim (mention)", () => {
        expect(actionsForLevel(MENTION_DEFAULT, "loud")).toEqual(
            MENTION_DEFAULT,
        );
    });
    it("loud returns the default actions verbatim (message)", () => {
        expect(actionsForLevel(MESSAGE_DEFAULT, "loud")).toEqual(
            MESSAGE_DEFAULT,
        );
    });
    it("silent drops the sound tweak but KEEPS highlight (mention)", () => {
        const a = actionsForLevel(MENTION_DEFAULT, "silent");
        expect(a).toEqual(["notify", { set_tweak: "highlight" }]);
        expect(hasSound(a)).toBe(false);
    });
    it("silent drops the sound tweak (message -> notify only)", () => {
        expect(actionsForLevel(MESSAGE_DEFAULT, "silent")).toEqual(["notify"]);
    });
    it("off returns [] for both", () => {
        expect(actionsForLevel(MENTION_DEFAULT, "off")).toEqual([]);
        expect(actionsForLevel(MESSAGE_DEFAULT, "off")).toEqual([]);
    });
    it("NEVER emits {set_tweak:'highlight', value:false} for a highlight-default rule", () => {
        for (const level of ["loud", "silent", "off"] as const) {
            expect(
                emitsHighlightFalse(actionsForLevel(MENTION_DEFAULT, level)),
            ).toBe(false);
        }
    });
    it("does not mutate the input array", () => {
        const input = [...MENTION_DEFAULT];
        actionsForLevel(input, "silent");
        expect(input).toEqual(MENTION_DEFAULT);
    });
});

describe("isHighlightAction", () => {
    // A sound tweak means "make a noise", NOT "this mentions you". The default
    // DM rule (.m.rule.room_one_to_one) sets sound with no highlight, so
    // treating sound as a highlight painted EVERY incoming DM message with the
    // mention styling. Reported 2026-07-25.
    it("sound-only -> false (the DM rule; not a mention)", () => {
        expect(
            isHighlightAction({ notify: true, tweaks: { sound: "default" } }),
        ).toBe(false);
    });
    it("highlight-only -> true", () => {
        expect(
            isHighlightAction({ notify: true, tweaks: { highlight: true } }),
        ).toBe(true);
    });
    it("notify-only (no tweaks) -> false", () => {
        expect(isHighlightAction({ notify: true, tweaks: {} })).toBe(false);
    });
    it("a real mention keeps its highlight even alongside a sound", () => {
        expect(
            isHighlightAction({
                notify: true,
                tweaks: { highlight: true, sound: "default" },
            }),
        ).toBe(true);
    });
    it("highlight:false + sound -> false", () => {
        expect(
            isHighlightAction({
                notify: true,
                tweaks: { highlight: false, sound: "default" },
            }),
        ).toBe(false);
    });
    it("null / undefined -> false", () => {
        expect(isHighlightAction(null)).toBe(false);
        expect(isHighlightAction(undefined)).toBe(false);
    });
});

function clientWithRules(global: Record<string, unknown[]> = {}) {
    return {
        pushRules: { global: { room: [], override: [], ...global } },
        addPushRule: vi.fn().mockResolvedValue({}),
        deletePushRule: vi
            .fn()
            .mockRejectedValue({ httpStatus: 404, errcode: "M_NOT_FOUND" }),
        getPushRules: vi.fn().mockResolvedValue({}),
        setPushRules: vi.fn(),
    } as any;
}

describe("room notification settings", () => {
    it("distinguishes all four settings", () => {
        expect(
            getRoomNotificationSettingForClient(clientWithRules(), "!r"),
        ).toBe("default");
        expect(
            getRoomNotificationSettingForClient(
                clientWithRules({
                    room: [{ rule_id: "!r", actions: ["notify"] }],
                }),
                "!r",
            ),
        ).toBe("all");
        expect(
            getRoomNotificationSettingForClient(
                clientWithRules({
                    room: [{ rule_id: "!r", actions: [] }],
                }),
                "!r",
            ),
        ).toBe("mentions");
        expect(
            getRoomNotificationSettingForClient(
                clientWithRules({
                    override: [{ rule_id: "!r", actions: [] }],
                }),
                "!r",
            ),
        ).toBe("mute");
    });

    it("installs mentions-only before removing a mute override", async () => {
        const calls: string[] = [];
        const client = clientWithRules();
        client.addPushRule.mockImplementation(async () => {
            calls.push("add");
            return {};
        });
        client.deletePushRule.mockImplementation(async () => {
            calls.push("delete");
            return {};
        });

        await setRoomNotificationSettingForClient(
            client,
            "!room:example.org",
            "mentions",
        );

        expect(calls).toEqual(["add", "delete"]);
        expect(client.addPushRule).toHaveBeenCalledWith(
            "global",
            PushRuleKind.RoomSpecific,
            "!room:example.org",
            { actions: [] },
        );
        expect(client.getPushRules).toHaveBeenCalledTimes(1);
    });

    it("does not swallow a real delete failure", async () => {
        const client = clientWithRules();
        client.deletePushRule.mockRejectedValue(new Error("offline"));
        await expect(
            setRoomNotificationSettingForClient(client, "!r", "all"),
        ).rejects.toThrow("offline");
        expect(client.getPushRules).toHaveBeenCalledTimes(1);
    });
});

describe("setDefaultPushRuleLevelForClient", () => {
    const MENTION = [
        "notify",
        { set_tweak: "sound", value: "default" },
        { set_tweak: "highlight" },
    ];

    function harness(opts: {
        observedAfter: PushRuleLevel;
        enabledFails?: unknown;
        actionsFails?: unknown;
        refreshFails?: boolean;
        createFails?: unknown;
        canCreate?: boolean;
    }) {
        const optimistic = vi.fn();
        const createRule = vi.fn(async () => {
            if (opts.createFails) throw opts.createFails;
        });
        const client = {
            setPushRuleEnabled: vi.fn(async () => {
                if (opts.enabledFails) throw opts.enabledFails;
                return {};
            }),
            setPushRuleActions: vi.fn(async () => {
                if (opts.actionsFails) throw opts.actionsFails;
                return {};
            }),
            getPushRules: vi.fn(async () => {
                if (opts.refreshFails) throw new Error("offline");
                return {};
            }),
        } as unknown as MatrixClient;
        const write = (level: PushRuleLevel): DefaultRuleLevelWrite => ({
            ruleId: ".m.rule.is_room_mention",
            targetId: ".m.rule.is_room_mention",
            kind: PushRuleKind.Override,
            level,
            defaultActions: MENTION,
            label: "@room mentions",
            createRule: opts.canCreate ? createRule : null,
            readLevel: () => opts.observedAfter,
            applyOptimistic: optimistic,
        });
        return { client, write, optimistic, createRule };
    }

    it("off: disables the rule, re-reads canonical rules, resolves", async () => {
        const h = harness({ observedAfter: "off" });
        await expect(
            setDefaultPushRuleLevelForClient(h.client, h.write("off")),
        ).resolves.toBeUndefined();
        expect(h.client.setPushRuleEnabled).toHaveBeenCalledWith(
            "global",
            PushRuleKind.Override,
            ".m.rule.is_room_mention",
            false,
        );
        expect(h.client.getPushRules).toHaveBeenCalled();
        expect(h.optimistic).not.toHaveBeenCalled();
    });

    it("loud: writes actions then enables", async () => {
        const h = harness({ observedAfter: "loud" });
        await setDefaultPushRuleLevelForClient(h.client, h.write("loud"));
        expect(h.client.setPushRuleActions).toHaveBeenCalledWith(
            "global",
            PushRuleKind.Override,
            ".m.rule.is_room_mention",
            MENTION,
        );
        expect(h.client.setPushRuleEnabled).toHaveBeenCalledWith(
            "global",
            PushRuleKind.Override,
            ".m.rule.is_room_mention",
            true,
        );
    });

    // NOTIF-01: this is the whole finding. The server kept the old rule, so the
    // caller must see an error and the cache must NOT be told it changed.
    it("a failed write rejects and never touches the cache", async () => {
        const h = harness({
            observedAfter: "loud",
            enabledFails: { httpStatus: 500 },
        });
        await expect(
            setDefaultPushRuleLevelForClient(h.client, h.write("off")),
        ).rejects.toThrow(/@room mentions/);
        expect(h.optimistic).not.toHaveBeenCalled();
    });

    it("a transport failure never creates a rule on top of it", async () => {
        const h = harness({
            observedAfter: "loud",
            enabledFails: new Error("Failed to fetch"),
            canCreate: true,
        });
        await expect(
            setDefaultPushRuleLevelForClient(h.client, h.write("off")),
        ).rejects.toThrow();
        expect(h.createRule).not.toHaveBeenCalled();
    });

    it("a missing custom rule is created, then verified", async () => {
        const h = harness({
            observedAfter: "loud",
            actionsFails: { httpStatus: 404 },
            canCreate: true,
        });
        await expect(
            setDefaultPushRuleLevelForClient(h.client, h.write("loud")),
        ).resolves.toBeUndefined();
        expect(h.createRule).toHaveBeenCalledWith(MENTION);
    });

    it("a create that also fails rejects, and still re-reads canonical rules", async () => {
        const h = harness({
            observedAfter: "loud",
            actionsFails: { httpStatus: 404 },
            createFails: { httpStatus: 500 },
            canCreate: true,
        });
        await expect(
            setDefaultPushRuleLevelForClient(h.client, h.write("off")),
        ).rejects.toThrow();
        expect(h.client.getPushRules).toHaveBeenCalled();
        expect(h.optimistic).not.toHaveBeenCalled();
    });

    // The case above asks for "off", which only ever calls setPushRuleEnabled —
    // so it never reaches the create path at all. Drive that path with a level
    // that does, and pin the message to the CREATE failure's reason: a create
    // that dies on the network must not be reported as "no such rule".
    it("a create that dies mid-flight rejects with the create's own reason", async () => {
        const h = harness({
            observedAfter: "off",
            actionsFails: { httpStatus: 404 },
            createFails: { httpStatus: 500 },
            canCreate: true,
        });
        await expect(
            setDefaultPushRuleLevelForClient(h.client, h.write("loud")),
        ).rejects.toThrow(/Check your connection/);
        expect(h.createRule).toHaveBeenCalled();
        expect(h.optimistic).not.toHaveBeenCalled();
    });

    // A server-default rule the homeserver simply does not have: turning it off
    // is already true, so this is success, not an error toast.
    it("a rule the server does not have is already off", async () => {
        const h = harness({
            observedAfter: "off",
            enabledFails: { httpStatus: 404 },
        });
        await expect(
            setDefaultPushRuleLevelForClient(h.client, h.write("off")),
        ).resolves.toBeUndefined();
        expect(h.optimistic).not.toHaveBeenCalled();
    });

    // setPushRuleActions landed, setPushRuleEnabled did not: half-applied state
    // must not be reported as the requested level.
    it("a half-applied write rejects", async () => {
        const h = harness({
            observedAfter: "off",
            enabledFails: { httpStatus: 500 },
        });
        await expect(
            setDefaultPushRuleLevelForClient(h.client, h.write("loud")),
        ).rejects.toThrow();
        expect(h.optimistic).not.toHaveBeenCalled();
    });

    it("a write the server accepted but ignored rejects", async () => {
        const h = harness({ observedAfter: "loud" });
        await expect(
            setDefaultPushRuleLevelForClient(h.client, h.write("off")),
        ).rejects.toThrow(/did not change/);
    });

    it("a successful write whose re-read fails mirrors locally and resolves", async () => {
        const h = harness({ observedAfter: "off", refreshFails: true });
        await expect(
            setDefaultPushRuleLevelForClient(h.client, h.write("silent")),
        ).resolves.toBeUndefined();
        expect(h.optimistic).toHaveBeenCalledWith([
            "notify",
            { set_tweak: "highlight" },
        ]);
    });

    it("a failed write whose re-read also fails still rejects and mirrors nothing", async () => {
        const h = harness({
            observedAfter: "loud",
            enabledFails: { httpStatus: 500 },
            refreshFails: true,
        });
        await expect(
            setDefaultPushRuleLevelForClient(h.client, h.write("off")),
        ).rejects.toThrow();
        expect(h.optimistic).not.toHaveBeenCalled();
    });
});

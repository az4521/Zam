import { describe, expect, it, vi } from "vitest";
import { PushRuleKind } from "matrix-js-sdk";
import {
    actionsForLevel,
    getRoomNotificationSettingForClient,
    isHighlightAction,
    setRoomNotificationSettingForClient,
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

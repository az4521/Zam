import { describe, expect, it, vi } from "vitest";
import { PushRuleKind } from "matrix-js-sdk";
import {
    getRoomNotificationSettingForClient,
    setRoomNotificationSettingForClient,
} from "./pushRules";

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

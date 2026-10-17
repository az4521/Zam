import { describe, it, expect, vi } from "vitest";

vi.mock("@matrix-org/matrix-sdk-crypto-wasm", () => ({
    RequestType: { KeysQuery: 1, ToDevice: 3 },
    UserId: class {
        constructor(public readonly id: string) {}
        toString() {
            return this.id;
        }
    },
}));

import { findRekeyedDevices, installRekeyRepair } from "./rekeyRepair";

const own = { userId: "@me:x", deviceId: "MINE" };
const response = (devices: Record<string, Record<string, string>>) => ({
    device_keys: Object.fromEntries(
        Object.entries(devices).map(([user, byDevice]) => [
            user,
            Object.fromEntries(
                Object.entries(byDevice).map(([id, ed]) => [
                    id,
                    { keys: { [`ed25519:${id}`]: ed } },
                ]),
            ),
        ]),
    ),
});

describe("findRekeyedDevices", () => {
    const stored = new Map([
        [
            "@them:x",
            new Map<string, string | undefined>([
                ["A", "edA"],
                ["B", "edB"],
            ]),
        ],
        ["@me:x", new Map<string, string | undefined>([["MINE", "edMine"]])],
    ]);

    it("finds a known device whose signing key changed", () => {
        expect(
            findRekeyedDevices(
                response({ "@them:x": { A: "edA", B: "edB-new" } }),
                stored,
                own,
            ),
        ).toEqual([{ userId: "@them:x", deviceId: "B" }]);
    });

    it("ignores new devices and unchanged ones", () => {
        expect(
            findRekeyedDevices(
                response({ "@them:x": { A: "edA", C: "edC" } }),
                stored,
                own,
            ),
        ).toEqual([]);
    });

    // Our own device re-keying is a different problem (ownDeviceKeysReplaced);
    // dropping it here would make the engine forget itself.
    it("never touches our own device", () => {
        expect(
            findRekeyedDevices(
                response({ "@me:x": { MINE: "edOther" } }),
                stored,
                own,
            ),
        ).toEqual([]);
    });
});

function makeEngine(stored: Record<string, Record<string, string>>) {
    const sent: { id: string; type: number; response: unknown }[] = [];
    const original = vi.fn((id: string, type: number, response: string) => {
        sent.push({ id, type, response: JSON.parse(response) });
        return Promise.resolve(true);
    });
    const queryKeysForUsers = vi.fn((users: { id: string }[]) => ({
        id: "requery",
        users: users.map((u) => u.id),
    }));
    const makeOutgoingRequest = vi.fn(() => Promise.resolve());
    const machine = {
        markRequestAsSent: original,
        getUserDevices: (user: { id: string }) =>
            Promise.resolve({
                devices: () =>
                    Object.entries(stored[user.id] ?? {}).map(([id, ed]) => ({
                        deviceId: { toString: () => id },
                        ed25519Key: { toBase64: () => ed },
                    })),
            }),
        queryKeysForUsers,
    };
    return {
        crypto: {
            olmMachine: machine,
            outgoingRequestProcessor: { makeOutgoingRequest },
        },
        machine,
        sent,
        original,
        queryKeysForUsers,
        makeOutgoingRequest,
    };
}

describe("installRekeyRepair", () => {
    it("drops a re-keyed device from the response, then queries again", async () => {
        const e = makeEngine({ "@them:x": { A: "edA", B: "edB" } });
        expect(await installRekeyRepair(e.crypto, own)).toBe(true);

        await e.machine.markRequestAsSent(
            "q1",
            1,
            JSON.stringify(response({ "@them:x": { A: "edA", B: "edB-new" } })),
        );

        expect(e.sent).toEqual([
            {
                id: "q1",
                type: 1,
                response: response({ "@them:x": { A: "edA" } }),
            },
        ]);
        expect(e.queryKeysForUsers).toHaveBeenCalledWith([
            expect.objectContaining({ id: "@them:x" }),
        ]);
        expect(e.makeOutgoingRequest).toHaveBeenCalledWith({
            id: "requery",
            users: ["@them:x"],
        });
    });

    it("passes an ordinary response through untouched", async () => {
        const e = makeEngine({ "@them:x": { A: "edA" } });
        await installRekeyRepair(e.crypto, own);
        const raw = JSON.stringify(response({ "@them:x": { A: "edA" } }));

        await e.machine.markRequestAsSent("q1", 1, raw);

        expect(e.original).toHaveBeenCalledWith("q1", 1, raw);
        expect(e.makeOutgoingRequest).not.toHaveBeenCalled();
    });

    it("leaves other request types alone", async () => {
        const e = makeEngine({});
        await installRekeyRepair(e.crypto, own);
        await e.machine.markRequestAsSent("t1", 3, "{}");
        expect(e.original).toHaveBeenCalledWith("t1", 3, "{}");
    });

    it("does nothing without the engine's internals", async () => {
        expect(await installRekeyRepair({}, own)).toBe(false);
    });
});

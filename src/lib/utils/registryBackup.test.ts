import { describe, expect, it } from "vitest";
import { emptyRegistry, type AccountRegistry } from "./accounts";
import { pickRecoveredRegistry } from "./registryBackup";

const account = {
    userId: "@alice:example.org",
    accessToken: "token",
    deviceId: "DEVICE",
    homeserverUrl: "https://example.org",
};
const full: AccountRegistry = {
    version: 1,
    activeUserId: account.userId,
    accounts: [account],
};

describe("pickRecoveredRegistry", () => {
    it("restores the backup into an empty registry", () => {
        expect(
            pickRecoveredRegistry(emptyRegistry(), JSON.stringify(full)),
        ).toEqual(full);
    });

    it("never overwrites a registry that still has accounts", () => {
        const other = { ...full, accounts: [{ ...account, userId: "@b:x" }] };
        expect(pickRecoveredRegistry(other, JSON.stringify(full))).toBeNull();
    });

    it("ignores a missing, corrupt or empty backup", () => {
        expect(pickRecoveredRegistry(emptyRegistry(), null)).toBeNull();
        expect(pickRecoveredRegistry(emptyRegistry(), undefined)).toBeNull();
        expect(pickRecoveredRegistry(emptyRegistry(), "{not json")).toBeNull();
        expect(
            pickRecoveredRegistry(
                emptyRegistry(),
                JSON.stringify(emptyRegistry()),
            ),
        ).toBeNull();
    });

    it("keeps an inactive registry inactive (expiry must not auto sign in)", () => {
        const inactive = { ...full, activeUserId: null };
        expect(
            pickRecoveredRegistry(emptyRegistry(), JSON.stringify(inactive))
                ?.activeUserId,
        ).toBeNull();
    });
});

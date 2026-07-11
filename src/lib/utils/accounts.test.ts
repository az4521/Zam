import { describe, it, expect } from "vitest";
import {
    emptyRegistry,
    parseRegistry,
    migrateLegacySession,
    upsertAccount,
    setActive,
    removeAccount,
    getActive,
    type StoredAccount,
} from "./accounts";

const acct = (userId: string): StoredAccount => ({
    userId,
    accessToken: `tok-${userId}`,
    deviceId: `dev-${userId}`,
    homeserverUrl: "https://hs.example.org",
});

describe("parseRegistry", () => {
    it("returns an empty registry for null, junk and unknown versions", () => {
        for (const raw of [null, "", "not json", '{"version":99}', "[1,2]"]) {
            expect(parseRegistry(raw)).toEqual(emptyRegistry());
        }
    });

    it("round-trips a valid registry", () => {
        const reg = upsertAccount(emptyRegistry(), acct("@a:x.org"));
        expect(parseRegistry(JSON.stringify(reg))).toEqual(reg);
    });

    it("drops malformed account entries but keeps valid ones", () => {
        const raw = JSON.stringify({
            version: 1,
            activeUserId: "@a:x.org",
            accounts: [acct("@a:x.org"), { userId: "@broken:x.org" }],
        });
        const reg = parseRegistry(raw);
        expect(reg.accounts.map((a) => a.userId)).toEqual(["@a:x.org"]);
    });

    it("nulls activeUserId when it points at no account", () => {
        const raw = JSON.stringify({
            version: 1,
            activeUserId: "@gone:x.org",
            accounts: [acct("@a:x.org")],
        });
        expect(parseRegistry(raw).activeUserId).toBeNull();
    });
});

describe("migrateLegacySession", () => {
    it("wraps a legacy matrix_session into an active single-account registry", () => {
        const legacy = JSON.stringify({
            userId: "@a:x.org",
            accessToken: "t",
            deviceId: "d",
            homeserverUrl: "https://hs.example.org",
        });
        const reg = migrateLegacySession(legacy);
        expect(reg?.activeUserId).toBe("@a:x.org");
        expect(reg?.accounts).toHaveLength(1);
    });

    it("returns null for absent or malformed legacy data", () => {
        expect(migrateLegacySession(null)).toBeNull();
        expect(migrateLegacySession("junk")).toBeNull();
        expect(migrateLegacySession('{"userId":"@a:x.org"}')).toBeNull();
    });
});

describe("upsertAccount", () => {
    it("appends new accounts and replaces existing ones by userId", () => {
        let reg = upsertAccount(emptyRegistry(), acct("@a:x.org"));
        reg = upsertAccount(reg, acct("@b:x.org"));
        expect(reg.accounts.map((a) => a.userId)).toEqual([
            "@a:x.org",
            "@b:x.org",
        ]);
        reg = upsertAccount(reg, { ...acct("@a:x.org"), accessToken: "new" });
        expect(reg.accounts).toHaveLength(2);
        expect(reg.accounts[0].accessToken).toBe("new");
    });

    it("keeps cached profile fields when the upsert omits them", () => {
        let reg = upsertAccount(emptyRegistry(), {
            ...acct("@a:x.org"),
            displayName: "Alice",
            avatarUrl: "https://x/avatar",
        });
        reg = upsertAccount(reg, { ...acct("@a:x.org"), accessToken: "new" });
        expect(reg.accounts[0].displayName).toBe("Alice");
        expect(reg.accounts[0].avatarUrl).toBe("https://x/avatar");
    });

    it("does not mutate its input", () => {
        const before = upsertAccount(emptyRegistry(), acct("@a:x.org"));
        const snapshot = JSON.parse(JSON.stringify(before));
        upsertAccount(before, acct("@b:x.org"));
        expect(before).toEqual(snapshot);
    });
});

describe("setActive / getActive", () => {
    it("activates a known account and ignores unknown ids", () => {
        let reg = upsertAccount(emptyRegistry(), acct("@a:x.org"));
        reg = setActive(reg, "@a:x.org");
        expect(getActive(reg)?.userId).toBe("@a:x.org");
        expect(setActive(reg, "@nope:x.org").activeUserId).toBe("@a:x.org");
    });

    it("getActive returns null when nothing is active", () => {
        expect(getActive(emptyRegistry())).toBeNull();
    });
});

describe("removeAccount", () => {
    it("removing the active account activates the first remaining one", () => {
        let reg = upsertAccount(emptyRegistry(), acct("@a:x.org"));
        reg = upsertAccount(reg, acct("@b:x.org"));
        reg = setActive(reg, "@a:x.org");
        reg = removeAccount(reg, "@a:x.org");
        expect(reg.accounts.map((a) => a.userId)).toEqual(["@b:x.org"]);
        expect(reg.activeUserId).toBe("@b:x.org");
    });

    it("removing an inactive account keeps the active one", () => {
        let reg = upsertAccount(emptyRegistry(), acct("@a:x.org"));
        reg = upsertAccount(reg, acct("@b:x.org"));
        reg = setActive(reg, "@a:x.org");
        reg = removeAccount(reg, "@b:x.org");
        expect(reg.activeUserId).toBe("@a:x.org");
    });

    it("removing the last account leaves an empty registry", () => {
        let reg = setActive(
            upsertAccount(emptyRegistry(), acct("@a:x.org")),
            "@a:x.org",
        );
        reg = removeAccount(reg, "@a:x.org");
        expect(reg).toEqual(emptyRegistry());
    });
});

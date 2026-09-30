import { describe, it, expect } from "vitest";
import {
    emptyRegistry,
    parseRegistry,
    migrateLegacySession,
    upsertAccount,
    setActive,
    removeAccount,
    getActive,
    updateAccountTokens,
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

describe("OAuth accounts", () => {
    const oauthAcct = (userId: string): StoredAccount => ({
        ...acct(userId),
        refreshToken: `refresh-${userId}`,
        oauth: { clientId: "client-1", issuer: "https://auth.example/" },
        accessTokenExpiresAt: 1_000,
    });

    it("round-trips refresh token, client id and issuer through the registry", () => {
        const reg = upsertAccount(emptyRegistry(), oauthAcct("@a:x.org"));
        expect(parseRegistry(JSON.stringify(reg))).toEqual(reg);
    });

    it("drops malformed OAuth fields but keeps the account signed in", () => {
        const raw = JSON.stringify({
            version: 1,
            activeUserId: "@a:x.org",
            accounts: [
                {
                    ...acct("@a:x.org"),
                    refreshToken: "r",
                    oauth: { clientId: "", issuer: "https://auth.example/" },
                    accessTokenExpiresAt: 5,
                },
                {
                    ...oauthAcct("@b:x.org"),
                    refreshToken: 42,
                    accessTokenExpiresAt: "soon",
                },
            ],
        });
        const [a, b] = parseRegistry(raw).accounts;
        // No usable client id: the refresh token is useless, so it goes too.
        expect(a).toEqual(acct("@a:x.org"));
        expect(b.oauth).toEqual({
            clientId: "client-1",
            issuer: "https://auth.example/",
        });
        expect(b.refreshToken).toBeUndefined();
        expect(b.accessTokenExpiresAt).toBeUndefined();
    });

    it("writes a rotated token pair back onto the account", () => {
        let reg = upsertAccount(emptyRegistry(), oauthAcct("@a:x.org"));
        reg = upsertAccount(reg, oauthAcct("@b:x.org"));
        reg = updateAccountTokens(reg, "@a:x.org", {
            accessToken: "new-access",
            refreshToken: "new-refresh",
            expiresAt: 9_000,
        });
        const a = reg.accounts.find((x) => x.userId === "@a:x.org")!;
        expect(a).toMatchObject({
            accessToken: "new-access",
            refreshToken: "new-refresh",
            accessTokenExpiresAt: 9_000,
            oauth: { clientId: "client-1" },
        });
        // Only that account changed.
        expect(reg.accounts.find((x) => x.userId === "@b:x.org")).toEqual(
            oauthAcct("@b:x.org"),
        );
    });

    it("keeps the old refresh token when a refresh does not rotate it", () => {
        const reg = updateAccountTokens(
            upsertAccount(emptyRegistry(), oauthAcct("@a:x.org")),
            "@a:x.org",
            { accessToken: "new-access" },
        );
        expect(reg.accounts[0].refreshToken).toBe("refresh-@a:x.org");
        expect(reg.accounts[0].accessTokenExpiresAt).toBeUndefined();
    });

    it("ignores a refresh for an account that has since signed out", () => {
        const reg = upsertAccount(emptyRegistry(), oauthAcct("@a:x.org"));
        expect(
            updateAccountTokens(reg, "@gone:x.org", { accessToken: "t" }),
        ).toBe(reg);
    });
});
